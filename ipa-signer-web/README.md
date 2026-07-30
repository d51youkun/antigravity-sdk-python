# IPA Signer Web

Web上で完結するIPA署名ツール。Apple IDでログインし、無料のApple Developer証明書を取得してIPAを再署名できます。

**iPad / iPhone の Safari から利用可能** — App Store 風 UI、PWA 対応。

## 公開 URL（Cloudflare）

[bluechat](https://bluechat.by-youhei.workers.dev) と同様、**Cloudflare Worker 1本**で公開します。

```
https://ipa-signer.by-youhei.workers.dev
```

（Workers サブドomain が `by-youhei` の場合。初回は下記デプロイが必要）

```bash
cd ipa-signer-web
npm install && npm --prefix frontend install
npm run deploy
```

詳細: **[DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md)**

---

## 特徴

- **App Store 風 UI** — Today / Sign / Library / Account タブ、大型タイトル、シート型ログイン
- **iOSGods App+ 風フロー** — 端末内完結・PC 不要・独自 IPA 署名
- **Apple ID ログイン** — SRP認証 + 二要素認証（信頼済みデバイス / SMS）
- **無料証明書** — 開発用証明書とプロビジョニングプロファイルを自動取得
- **ブラウザ内署名** — IPA は端末内で署名（署名サーバーへアップロードしない）
- **PWA 対応** — iPad のホーム画面に追加可能
- **Cloudflare Pages 公開** — フロントエンドを CDN 配信

## 構成（Cloudflare 完結）

```
https://ipa-signer.by-youhei.workers.dev
  ├─ /           フロント（Pages Assets / App Store UI）
  └─ /api/*      Python API（Cloudflare Container + Anisette）
```

iPad からは **上記 URL だけ** 開けば OK。Fly.io や別サーバーは不要（Containers 利用時）。

---

## 旧構成（Pages + 外部 API）

Containers が使えない場合のみ:

| レイヤ | 役割 |
|--------|------|
| Cloudflare Pages | フロント + `/api` プロキシ |
| Fly.io 等 | Python API |

`BACKEND_URL` 環境変数が必要。→ [DEPLOY-CLOUDFLARE.md](./DEPLOY-CLOUDFLARE.md) の Fly.io フォールバック参照。

---

## 必要環境（開発）

1. Safari で `https://ipa-signer.by-youhei.workers.dev` を開く
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
| `ANISETTE_URL` | Container / Fly.io | 外部 Anisette（省略時 Linux 内蔵 anisette） |
| `BACKEND_URL` | Pages のみ（旧方式） | 外部 API URL |

Cloudflare Worker 統合デプロイでは `BACKEND_URL` は不要です。

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
