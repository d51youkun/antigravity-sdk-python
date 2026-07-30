import "./style.css";
import JSZip from "jszip";

/** 同一オリジン (/api) または VITE_API_BASE を使用 */
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const state = {
  sessionId: null,
  teams: [],
  ipaFile: null,
  bundleId: "",
  appName: "",
};

const app = document.getElementById("app");

app.innerHTML = `
  <header class="hero">
    <h1>IPA Signer Web</h1>
    <p>
      Apple IDでログインし、無料開発者証明書を取得してIPAを署名します。
      iPad / iPhone の Safari からそのまま使えます。IPA の署名は端末内で完結します。
    </p>
  </header>

  <div class="steps" id="steps">
    <span class="step active" data-step="1">1. Apple ID</span>
    <span class="step" data-step="2">2. 2FA</span>
    <span class="step" data-step="3">3. IPA / UDID</span>
    <span class="step" data-step="4">4. 署名</span>
  </div>

  <div class="grid">
    <section class="card" id="login-card">
      <h2>Apple ID ログイン</h2>
      <p class="hint">パスワードはAppleのSRP認証で直接送信されます。サーバーに平文保存はしません。</p>
      <div class="field">
        <label for="apple-id">Apple ID</label>
        <input id="apple-id" type="email" autocomplete="username" placeholder="name@example.com" />
      </div>
      <div class="field">
        <label for="password">パスワード</label>
        <input id="password" type="password" autocomplete="current-password" />
      </div>
      <div class="actions">
        <button class="primary" id="login-btn">ログイン</button>
      </div>
      <div class="status hidden" id="login-status"></div>
    </section>

    <section class="card hidden" id="tfa-card">
      <h2>二要素認証</h2>
      <p class="hint" id="tfa-hint">信頼済みデバイスまたはSMSに届いた6桁コードを入力してください。</p>
      <div class="field">
        <label for="tfa-code">認証コード</label>
        <input id="tfa-code" type="text" inputmode="numeric" maxlength="8" placeholder="123456" />
      </div>
      <div class="actions">
        <button class="primary" id="tfa-btn">確認</button>
      </div>
      <div class="status hidden" id="tfa-status"></div>
    </section>

    <section class="card hidden" id="sign-card">
      <h2>IPA とデバイス</h2>
      <p class="hint">
        インストール先 iPhone / iPad の UDID を登録し、署名する IPA を選択します。
        iPad から操作する場合、UDID は別デバイスで確認して入力してください。
      </p>

      <div class="field">
        <label for="team-id">開発チーム</label>
        <select id="team-id"></select>
      </div>

      <div class="field">
        <label for="udid">デバイス UDID</label>
        <input id="udid" type="text" placeholder="00008030-001234567890001E" />
      </div>

      <div class="field">
        <label>IPA ファイル</label>
        <label class="file-drop" id="file-drop">
          <input id="ipa-input" type="file" accept=".ipa,application/octet-stream" hidden />
          <strong id="file-label">IPA を選択またはドロップ</strong>
          <span>Bundle ID は IPA から自動読み取りします</span>
        </label>
        <div class="meta" id="ipa-meta"></div>
      </div>

      <div class="actions">
        <button class="primary" id="sign-btn">証明書を取得して署名</button>
        <button class="secondary hidden" id="download-btn">署名済み IPA をダウンロード</button>
      </div>
      <div class="status hidden" id="sign-status"></div>
    </section>
  </div>

  <div class="notice">
    無料Apple IDで署名したアプリは約7日間有効です。App IDは週10件まで、同時にサイドロードできるアプリ数にも制限があります。
    本番配布やApp Store公開には有料のApple Developer Programが必要です。
  </div>
`;

const els = {
  steps: document.getElementById("steps"),
  loginCard: document.getElementById("login-card"),
  tfaCard: document.getElementById("tfa-card"),
  signCard: document.getElementById("sign-card"),
  loginBtn: document.getElementById("login-btn"),
  tfaBtn: document.getElementById("tfa-btn"),
  signBtn: document.getElementById("sign-btn"),
  downloadBtn: document.getElementById("download-btn"),
  appleId: document.getElementById("apple-id"),
  password: document.getElementById("password"),
  tfaCode: document.getElementById("tfa-code"),
  teamId: document.getElementById("team-id"),
  udid: document.getElementById("udid"),
  ipaInput: document.getElementById("ipa-input"),
  fileDrop: document.getElementById("file-drop"),
  fileLabel: document.getElementById("file-label"),
  ipaMeta: document.getElementById("ipa-meta"),
  loginStatus: document.getElementById("login-status"),
  tfaStatus: document.getElementById("tfa-status"),
  signStatus: document.getElementById("sign-status"),
  tfaHint: document.getElementById("tfa-hint"),
};

let signedBlobUrl = null;

function setStep(step) {
  els.steps.querySelectorAll(".step").forEach((node) => {
    const n = Number(node.dataset.step);
    node.classList.toggle("active", n === step);
    node.classList.toggle("done", n < step);
  });
}

function showStatus(el, message, kind = "info") {
  el.textContent = message;
  el.className = `status ${kind}`;
  el.classList.remove("hidden");
}

function hideStatus(...elements) {
  for (const el of elements) el.classList.add("hidden");
}

async function api(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || `HTTP ${response.status}`);
  }
  return data;
}

function populateTeams(teams) {
  els.teamId.innerHTML = teams
    .map(
      (team) =>
        `<option value="${team.team_id}">${team.name} (${team.team_id})</option>`,
    )
    .join("");
}

async function parseIpaMetadata(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const infoPath = Object.keys(zip.files).find(
    (name) => name.endsWith("/Info.plist") && name.startsWith("Payload/") && name.split("/").length === 3,
  );
  if (!infoPath) {
    throw new Error("IPA内に Info.plist が見つかりません");
  }

  const plistBytes = await zip.file(infoPath).async("uint8array");
  const text = new TextDecoder("utf-8").decode(plistBytes);
  const bundleMatch = text.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
  const nameMatch = text.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)<\/string>/)
    || text.match(/<key>CFBundleName<\/key>\s*<string>([^<]+)<\/string>/);

  if (!bundleMatch) {
    throw new Error("Bundle ID を IPA から読み取れませんでした");
  }

  return {
    bundleId: bundleMatch[1],
    appName: nameMatch?.[1] || bundleMatch[1].split(".").pop(),
  };
}

async function handleIpaFile(file) {
  state.ipaFile = file;
  els.fileLabel.textContent = file.name;
  showStatus(els.signStatus, "IPA を解析しています...", "info");

  try {
    const meta = await parseIpaMetadata(file);
    state.bundleId = meta.bundleId;
    state.appName = meta.appName;
    els.ipaMeta.textContent = `Bundle ID: ${meta.bundleId} / 表示名: ${meta.appName}`;
    hideStatus(els.signStatus);
  } catch (error) {
    showStatus(els.signStatus, error.message, "error");
  }
}

async function signInBrowser(ipaFile, credentials) {
  const { createResigner } = await import("zsign-wasm");
  const resigner = await createResigner();

  const ipaBytes = new Uint8Array(await ipaFile.arrayBuffer());
  const p12Bytes = Uint8Array.from(atob(credentials.p12_base64), (c) => c.charCodeAt(0));
  const profileBytes = Uint8Array.from(atob(credentials.profile_base64), (c) => c.charCodeAt(0));

  const result = await resigner.signIpa(ipaBytes, {
    pkey: p12Bytes,
    prov: profileBytes,
    password: credentials.p12_password || "",
    bundleId: credentials.bundle_id,
    adhoc: false,
    forceSign: true,
  });

  return result.data || result;
}

els.loginBtn.addEventListener("click", async () => {
  hideStatus(els.loginStatus, els.tfaStatus, els.signStatus);
  els.loginBtn.disabled = true;

  try {
    const result = await api("/api/auth/login", {
      apple_id: els.appleId.value.trim(),
      password: els.password.value,
    });

    state.sessionId = result.session_id;

    if (result.needs_2fa) {
      setStep(2);
      els.tfaCard.classList.remove("hidden");
      els.tfaHint.textContent =
        result.tfa_type === "trusted_device"
          ? "信頼済みデバイスに届いた6桁コードを入力してください。"
          : "SMSに届いた6桁コードを入力してください。";
      showStatus(els.loginStatus, "二要素認証が必要です。", "info");
      return;
    }

    state.teams = result.teams || [];
    populateTeams(state.teams);
    setStep(3);
    els.signCard.classList.remove("hidden");
    showStatus(els.loginStatus, "ログインに成功しました。", "ok");
  } catch (error) {
    showStatus(els.loginStatus, error.message, "error");
  } finally {
    els.loginBtn.disabled = false;
  }
});

els.tfaBtn.addEventListener("click", async () => {
  els.tfaBtn.disabled = true;
  try {
    const result = await api("/api/auth/2fa", {
      session_id: state.sessionId,
      code: els.tfaCode.value.trim(),
    });
    state.teams = result.teams || [];
    populateTeams(state.teams);
    setStep(3);
    els.signCard.classList.remove("hidden");
    showStatus(els.tfaStatus, "認証に成功しました。", "ok");
  } catch (error) {
    showStatus(els.tfaStatus, error.message, "error");
  } finally {
    els.tfaBtn.disabled = false;
  }
});

els.signBtn.addEventListener("click", async () => {
  if (!state.sessionId) {
    showStatus(els.signStatus, "先に Apple ID でログインしてください。", "error");
    return;
  }
  if (!state.ipaFile) {
    showStatus(els.signStatus, "IPA ファイルを選択してください。", "error");
    return;
  }
  if (!state.bundleId) {
    showStatus(els.signStatus, "Bundle ID を読み取れていません。", "error");
    return;
  }
  if (!els.udid.value.trim()) {
    showStatus(els.signStatus, "デバイス UDID を入力してください。", "error");
    return;
  }

  els.signBtn.disabled = true;
  els.downloadBtn.classList.add("hidden");
  if (signedBlobUrl) {
    URL.revokeObjectURL(signedBlobUrl);
    signedBlobUrl = null;
  }

  try {
    setStep(4);
    showStatus(els.signStatus, "Apple から無料証明書とプロビジョニングプロファイルを取得しています...", "info");

    const credentials = await api("/api/provision", {
      session_id: state.sessionId,
      udid: els.udid.value.trim(),
      bundle_id: state.bundleId,
      app_name: state.appName,
      team_id: els.teamId.value || undefined,
    });

    showStatus(
      els.signStatus,
      `証明書を取得しました (Team: ${credentials.team_id})。\nブラウザ内で IPA を署名しています...`,
      "info",
    );

    const signedBytes = await signInBrowser(state.ipaFile, credentials);
    const blob = new Blob([signedBytes], { type: "application/octet-stream" });
    signedBlobUrl = URL.createObjectURL(blob);

    els.downloadBtn.classList.remove("hidden");
    els.downloadBtn.onclick = () => {
      const anchor = document.createElement("a");
      anchor.href = signedBlobUrl;
      anchor.download = state.ipaFile.name.replace(/\.ipa$/i, "") + "_signed.ipa";
      anchor.click();
    };

    showStatus(
      els.signStatus,
      `署名が完了しました。\nBundle ID: ${credentials.bundle_id}\n「署名済み IPA をダウンロード」から保存してください。`,
      "ok",
    );
  } catch (error) {
    showStatus(els.signStatus, error.message, "error");
  } finally {
    els.signBtn.disabled = false;
  }
});

els.ipaInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (file) await handleIpaFile(file);
});

els.fileDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.fileDrop.classList.add("dragover");
});

els.fileDrop.addEventListener("dragleave", () => {
  els.fileDrop.classList.remove("dragover");
});

els.fileDrop.addEventListener("drop", async (event) => {
  event.preventDefault();
  els.fileDrop.classList.remove("dragover");
  const file = event.dataTransfer.files?.[0];
  if (file) await handleIpaFile(file);
});
