# Cloudflare デプロイ（bluechat と同じ workers.dev 方式）

IPA Signer は **1 つの Cloudflare Worker** にフロント（静的）と API（Container）をまとめています。  
bluechat と同様、`https://ipa-signer.by-youhei.workers.dev` のような URL で公開できます。

## 公開 URL

デプロイ後:

```
https://ipa-signer.<あなたのWorkersサブドメイン>.workers.dev
```

`bluechat.by-youhei.workers.dev` と同じアカウントなら、おそらく:

```
https://ipa-signer.by-youhei.workers.dev
```

`wrangler.jsonc` の `"name": "ipa-signer"` が Worker 名 (= サブドメイン) です。変更する場合はこの値を編集してください。

---

## 前提

- Cloudflare アカウント（bluechat デプロイ済みなら OK）
- Node.js 20+
- **Docker がローカルで起動していること**（`docker info` が成功すること）
- Wrangler ログイン済み: `npx wrangler login`

> Cloudflare **Containers** は Workers Paid プラン等が必要な場合があります。  
> デプロイできない場合は README 末尾の **Fly.io フォールバック** を参照。

---

## デプロイ手順

```bash
cd ipa-signer-web

# 依存関係
npm install
npm --prefix frontend install

# ビルド + デプロイ（フロントビルド → Docker イメージ → Worker 公開）
npm run deploy
```

初回は Docker イメージのビルドで数分かかります。

### デプロイ確認

```bash
# ヘルスチェック
curl https://ipa-signer.by-youhei.workers.dev/api/health

# コンテナ状態
npx wrangler containers list
```

---

## 構成

```
https://ipa-signer.by-youhei.workers.dev
├── /              → フロント（App Store UI / PWA）
├── /api/auth/*    → Python FastAPI（Cloudflare Container）
└── /api/provision → 同上
```

- **Worker** (`worker/src/index.ts`) — ルーティング
- **Assets** — `frontend/dist`（Vite ビルド）
- **Container** — `backend/Dockerfile`（Anisette + Apple 認証 API）

`BACKEND_URL` などの外部設定は **不要** です（すべて同一 Worker 内）。

---

## ローカル開発

```bash
# ターミナル 1: API のみ（従来）
cd backend && pip install -r requirements.txt
uvicorn main:app --port 8000

# ターミナル 2: フロント
cd frontend && npm run dev
```

Container 込みのローカル確認:

```bash
cd ipa-signer-web
npm run build:frontend
npx wrangler dev
```

---

## Fly.io フォールバック（API のみ）

Containers が使えない場合:

```bash
cd ipa-signer-web
fly deploy   # fly.toml 参照 → ipa-signer-api.fly.dev
```

Cloudflare Pages にフロントだけ載せ、`BACKEND_URL=https://ipa-signer-api.fly.dev` を設定（旧方式。`functions/api/[[path]].js` 使用）。

---

## カスタムドメイン（任意）

Cloudflare ダッシュボード → Workers & Pages → **ipa-signer** → Settings → Domains & Routes  
で `ipa.example.com` などを追加できます。
