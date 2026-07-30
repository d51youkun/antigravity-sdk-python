# IPA Signer Web

Web上で完結するIPA署名ツールです。Apple IDでログインし、無料のApple Developer証明書を取得してIPAを再署名できます。

**iPad / iPhone の Safari から利用可能** — ローカル PC は不要です。

## 特徴

- **Apple ID ログイン** — SRP認証 + 二要素認証（信頼済みデバイス / SMS）
- **無料証明書** — 開発用証明書とプロビジョニングプロファイルを自動取得
- **ブラウザ内署名** — IPA は端末内で署名（署名サーバーへアップロードしない）
- **PWA 対応** — iPad のホーム画面に追加可能
- **Cloudflare Pages 公開** — フロントエンドを CDN 配信

## 構成（iPad 開発向け）

```
Cloudflare Pages          Fly.io / Docker
  (フロント + /api プロキシ)  →  (Python API + Anisette)
         ↑
    iPad Safari
```

iPad からは **Cloudflare Pages の URL だけ** 開けば OK です。Python API はクラウド上に常時起動させます。

---

## 1. バックエンドをクラウドにデプロイ（Fly.io 例）

```bash
cd ipa-signer-web

# 初回のみ
fly launch --no-deploy --name ipa-signer-api --region nrt
fly deploy

# 動作確認
curl https://ipa-signer-api.fly.dev/api/health
```

表示された URL（例: `https://ipa-signer-api.fly.dev`）を控えます。

### Docker で別 VPS に載せる場合

```bash
cd ipa-signer-web/backend
docker build -t ipa-signer-api .
docker run -p 8000:8000 ipa-signer-api
```

---

## 2. Cloudflare Pages に公開

### ダッシュボードから（おすすめ / iPad でも設定可）

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create**
2. **Pages** → Git リポジトリを接続
3. ビルド設定:

| 項目 | 値 |
|------|-----|
| ルートディレクトリ | `ipa-signer-web` |
| ビルドコマンド | `cd frontend && npm ci && npm run build` |
| 出力ディレクトリ | `frontend/dist` |

4. **Settings → Environment variables** に追加:

| 名前 | 値 |
|------|-----|
| `BACKEND_URL` | `https://ipa-signer-api.fly.dev`（手順1の URL） |

5. デプロイ完了後、`https://<project>.pages.dev` にアクセス

### Wrangler CLI から

```bash
cd ipa-signer-web/frontend
npm ci && npm run build
cd ..
npx wrangler pages deploy frontend/dist --project-name=ipa-signer-web
```

環境変数 `BACKEND_URL` は Pages ダッシュボードで設定してください。

---

## 3. iPad で使う

1. Safari で Pages の URL を開く
2. 共有ボタン → **ホーム画面に追加**（PWA として起動可能）
3. Apple ID でログイン → 2FA
4. インストール先デバイスの **UDID** を入力（iPad 本体の UDID ではなく、署名先 iPhone/iPad の UDID）
5. IPA を「ファイル」アプリから選択
6. 署名後、署名済み IPA をダウンロード → AltStore / Sideloadly 等でインストール

### UDID の確認

- Mac: Finder → デバイス → シリアル番号をクリック
- Windows: iTunes / 3uTools
- デバイス本体: 設定 → 一般 → 情報（ツールが必要な場合あり）

---

## ローカル開発

```bash
# ターミナル 1: API
cd ipa-signer-web/backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000

# ターミナル 2: フロント
cd ipa-signer-web/frontend
npm install
npm run dev
```

`http://localhost:5173` — Vite が `/api` を 8000 番へプロキシします。

### Pages Functions をローカル確認

```bash
cd ipa-signer-web
cp .dev.vars.example .dev.vars   # BACKEND_URL を編集
cd frontend && npm run build && cd ..
npx wrangler pages dev frontend/dist
```

---

## 環境変数

| 変数 | 設定場所 | 説明 |
|------|----------|------|
| `BACKEND_URL` | Cloudflare Pages | Python API の URL（必須） |
| `ANISETTE_URL` | Fly.io / Docker | 外部 Anisette サーバー（省略時は Linux 内蔵 anisette） |
| `VITE_API_BASE` | フロントビルド時 | API のベース URL（通常は空 = 同一オリジン） |
| `STATIC_DIR` | ローカル API のみ | ビルド済みフロントのパス |

---

## 制限事項

- 無料 Apple ID の署名は **約7日** で失効
- App ID 作成は **週10件** まで
- Apple ID 認証のため API サーバーへ資格情報が送信されます（自己ホスト推奨）

---

## ライセンス

MIT

## 参考

Apple 認証実装: [iOS-sandbox-explorer/apple_account.py](https://github.com/test1ng-guy/iOS-sandbox-explorer/blob/main/tools/apple_account.py)
