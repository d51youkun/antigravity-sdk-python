"""IPA Signer Web — FastAPI backend for Apple ID auth and provisioning."""

from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from apple_auth import DEFAULT_ANISETTE_URL, WebSigningSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 60 * 30


@dataclass
class StoredSession:
    session: WebSigningSession
    created_at: float = field(default_factory=time.time)


sessions: dict[str, StoredSession] = {}

app = FastAPI(
    title="IPA Signer Web",
    description="Apple ID login and free developer certificate provisioning",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    apple_id: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class TwoFactorRequest(BaseModel):
    session_id: str
    code: str = Field(..., min_length=4, max_length=8)


class ProvisionRequest(BaseModel):
    session_id: str
    udid: str = Field(..., min_length=8)
    bundle_id: str = Field(..., min_length=3)
    app_name: Optional[str] = None
    team_id: Optional[str] = None


def _cleanup_sessions() -> None:
    now = time.time()
    expired = [
        sid
        for sid, stored in sessions.items()
        if now - stored.created_at > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        sessions.pop(sid, None)


def _get_session(session_id: str) -> WebSigningSession:
    _cleanup_sessions()
    stored = sessions.get(session_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Session expired or not found")
    return stored.session


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "ipa-signer-web"}


@app.post("/api/auth/login")
def login(body: LoginRequest):
    _cleanup_sessions()
    session_id = str(uuid.uuid4())
    anisette_url = os.environ.get("ANISETTE_URL", DEFAULT_ANISETTE_URL)

    try:
        web_session = WebSigningSession(anisette_url=anisette_url)
        result = web_session.start_login(body.apple_id, body.password)
    except Exception as exc:
        logger.exception("Login failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sessions[session_id] = StoredSession(session=web_session)
    return {"session_id": session_id, **result}


@app.post("/api/auth/2fa")
def submit_2fa(body: TwoFactorRequest):
    web_session = _get_session(body.session_id)

    try:
        result = web_session.submit_2fa(body.code.strip())
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("2FA failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


@app.post("/api/provision")
def provision(body: ProvisionRequest):
    web_session = _get_session(body.session_id)

    if not web_session.logged_in:
        raise HTTPException(status_code=401, detail="Complete Apple ID login first")

    app_name = body.app_name or body.bundle_id.split(".")[-1]

    try:
        result = web_session.provision(
            udid=body.udid.strip(),
            bundle_id=body.bundle_id.strip(),
            app_name=app_name,
            team_id=body.team_id,
        )
    except Exception as exc:
        logger.exception("Provisioning failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result


static_dir = os.environ.get("STATIC_DIR")
if static_dir and os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
