# browser-app

[@browserbasehq/stagehand](https://github.com/browserbase/stagehand) でブラウザ操作を行う為のアプリケーションサンプルです。

## Getting Started

### Node.js のインストール（既に終わっている場合は省略）

22 系の最新安定版を利用する。

[mise](https://github.com/jdx/mise) などを使ってバージョン管理を出来るようにする事を推奨します。

### 環境変数の設定

[direnv](https://direnv.net/) などを使って環境変数を設定します。

```bash
export STAGEHAND_ENV=local
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
export BROWSERBASE_PROJECT_ID="YOUR_BROWSERBASE_PROJECT_ID"
export BROWSERBASE_API_KEY="YOUR_BROWSERBASE_API_KEY"
export R2_ENDPOINT_URL=R2バケットのエンドポイントURL
export R2_ACCESS_KEY_ID=R2アクセス キー ID
export R2_SECRET_ACCESS_KEY=R2シークレット アクセス キー
export R2_BUCKET_NAME="R2バケット名"
```

### 依存packageのインストール

以下で依存packageをインストール

```bash
npm ci
```

※ 初回のみ以下を実行する

```bash
npx playwright install
```

### 開発サーバー起動

サーバーは [Hono](https://hono.dev/) で動作します。

### 動作確認

以下のリクエストを送信する事で動作確認可能です。

```bash
curl -v \
-X POST \
-H "Content-Type: application/json" \
-d '
{
  "text": "ねこちゃん",
  "password": "password456789",
  "textarea": "こんにちは",
  "select": "Two",
  "checkDefaultCheckbox": true,
  "radio": "checked",
  "color": "#ffff00",
  "date": "2025-09-12",
  "range": 3,
  "waitAfterSubmitMs": 2000
}' \
http://localhost:8080/selenium/webform | jq
```

```bash
curl -v \
-X POST \
-H "Content-Type: application/json" \
-d '
{
  "text": "ねこちゃん",
  "password": "password456789",
  "textarea": "こんにちは",
  "select": "Two",
  "checkDefaultCheckbox": true,
  "radio": "checked",
  "color": "#ffff00",
  "date": "2025-09-12",
  "range": 3,
  "waitAfterSubmitMs": 2000
}' \
http://localhost:8080/selenium/webform/agent | jq
```

`/selenium/webform` がPlaywrightを直接使うバージョン `/selenium/webform/agent` がエージェントを使ったバージョンです。

以下のSelenium公式フォームを動作確認の為に利用しています。

https://www.selenium.dev/selenium/web/web-form.html

## npm scripts

### Linterの実行

```bash
npm run lint
```

### Formatterの実行

```bash
npm run format
```

### 開発サーバーの起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### サーバー起動（本番はこのコマンドでコンテナ内で動作する）

```bash
npm run start
```
