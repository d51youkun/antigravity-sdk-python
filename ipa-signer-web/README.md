# IPA Signer Web

Web上で完結するIPA署名ツールです。Apple IDでログインし、無料のApple Developer証明書を取得してIPAを再署名できます。

## 特徴

- **Apple ID ログイン** — SRP認証 + 二要素認証（信頼済みデバイス / SMS）に対応
- **無料証明書** — Apple Developer Program（有料）なしで開発用証明書とプロビジョニングプロファイルを自動取得
- **ブラウザ内署名** — [zsign-wasm](https://github.com/lbr77/zsign-wasm) により IPA はブラウザ内で署名（サーバーへIPAを送信しない）
- **IPA アップロード** — ドラッグ&ドロップまたはファイル選択

## アーキテクチャ

```
ブラウザ (Vite)
  ├─ Apple ID / 2FA / UDID / IPA 選択 UI
  ├─ IPA メタデータ解析 (Bundle ID)
  └─ zsign-wasm でローカル署名

FastAPI バックエンド
  ├─ Anisette (Linux: pip install anisette)
  ├─ Apple GSA 認証
  └─ Developer Portal API (デバイス登録 / 証明書 / プロファイル)
```

## 必要環境

- Python 3.10+
- Node.js 20+
- Linux では `anisette` パッケージ（初回起動時に Apple ライブラリを約 3MB ダウンロード）

## セットアップ

```bash
# バックエンド
cd ipa-signer-web/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# フロントエンド（別ターミナル）
cd ipa-signer-web/frontend
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開きます。

### 本番ビルド（単一サーバー）

```bash
cd ipa-signer-web/frontend
npm run build

STATIC_DIR=../frontend/dist uvicorn main:app --host 0.0.0.0 --port 8000
```

## 使い方

1. Apple ID とパスワードでログイン
2. 2FA コードを入力（必要な場合）
3. インストール先 iPhone の **UDID** を入力
4. `.ipa` ファイルを選択
5. 「証明書を取得して署名」をクリック
6. 署名済み IPA をダウンロード

### UDID の確認方法

- macOS: Finder で iPhone を選択 → 一般 → シリアル番号をクリック
- Windows: iTunes / 3uTools 等
- iPhone: 設定 → 一般 → 情報（一部ツールが必要）

## 制限事項

無料 Apple ID 利用時の Apple 側制限:

- 署名の有効期限は **約7日**
- App ID 作成は **週10件** まで
- 同時サイドロード可能なアプリ数に制限あり

## セキュリティ

- パスワードはメモリ上のセッションのみで保持（ディスクに保存しない）
- IPA ファイルはブラウザ内で署名され、署名用にサーバーへアップロードされない
- Apple ID 認証のためバックエンドへ資格情報が送信される点に注意してください。自己ホスト利用を推奨します

## 環境変数

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `ANISETTE_URL` | 外部 Anisette HTTP サーバー URL | `http://localhost:6969` |
| `STATIC_DIR` | ビルド済みフロントエンドのパス | 未設定 |

## ライセンス

MIT

## 参考

Apple 認証・プロビジョニング実装は [iOS-sandbox-explorer/apple_account.py](https://github.com/test1ng-guy/iOS-sandbox-explorer/blob/main/tools/apple_account.py) を参考にしています。
