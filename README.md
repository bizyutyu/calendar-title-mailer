# calendar-title-mailer

毎朝、Google カレンダー（デフォルトカレンダー）の翌日の予定をもとに、Gemini API で「世界観テーマ」とそのテーマに沿った文章を生成し、Slack（Incoming Webhook）で通知する Google Apps Script (GAS) プロジェクトです。

通知メッセージは `{文章}（テーマ：{テーマ}）` の1行です（予定一覧そのものはメッセージ本文に含まれません）。過去の通知は Slack で「テーマ：」と検索すると絞り込めます。

Gemini は1回の実行で最大2回呼び出します。

1. **テーマ生成**: 日付から決まる乱数で `src/themeSeed.ts` の3つの語彙（ジャンル・文体／題材／舞台・時代、各20語）から1語ずつ選び、Gemini にそこから連想した10文字以内のテーマを作らせます。乱数の値そのものではなく語を渡すことで、テーマの傾向がモデルの癖に寄りすぎないようにしています。同じ日に再実行すると同じ3語が選ばれます。直近7日分のテーマはスクリプトプロパティ `RECENT_THEMES` に自動保存され、重複を避けるようプロンプトに含めます。
2. **文章生成**: 翌日の予定とテーマを渡し、テーマの文体で80文字以内の文章を作らせます。

Gemini の一時的なエラー（408 / 429 / 5xx・通信エラー）は、指数バックオフ＋ジッターで最大3回まで再試行します（[公式の推奨](https://ai.google.dev/gemini-api/docs/troubleshooting)に準拠）。それでも失敗した場合や、安全性フィルタなどで生成が停止された場合は、テーマは「題材×ジャンル」、文章は定型文に切り替えて通知自体は必ず送ります。

## 前提ツール

Node.js と pnpm のバージョンは `mise.toml` で固定しています（Node 24 / pnpm 11）。[mise](https://mise.jdx.dev/) を導入していれば、リポジトリ内で自動的に該当バージョンが使われます。

```sh
mise install   # mise.toml に記載のバージョンを取得
```

> `pnpm-workspace.yaml` は pnpm 11 の設定構文（`allowBuilds`）を使うため、pnpm 9 以前では `pnpm install` が `packages field missing or empty` で失敗します。必ず pnpm 11 を使ってください。

## セットアップ手順

1. 依存パッケージをインストール

   ```sh
   pnpm install
   ```

2. clasp にログイン（初回のみ）

   ```sh
   pnpm run login
   ```

   認可スコープは、最小構成として **「特定ファイルの参照/編集/作成/削除」（`drive.file`）** と **「Apps Script プロジェクトの作成/更新」（`script.projects`）** の2つがあれば `clasp create` / `clasp push` は動作します（他は任意）。

3. Apps Script API を有効化（初回のみ）

   [script.google.com/home/usersettings](https://script.google.com/home/usersettings) で「Google Apps Script API」をオンにする。未有効の場合、次の `clasp create` が `User has not enabled the Apps Script API` で失敗します。

4. GAS プロジェクトを作成

   ```sh
   pnpm exec clasp create --type standalone --title "calendar-title-mailer" --rootDir dist
   ```

   生成された `.clasp.json` は `scriptId` を含むため `.gitignore` 対象です（コミットしないでください）。

   > `--rootDir dist` 指定時、`.clasp.json` がリポジトリ直下に生成されないことがあります。その場合は、作成時に表示される URL `https://script.google.com/d/<scriptId>/edit` の `<scriptId>` を使い、`.clasp.json.example` と同じ形式で手動作成してください。

5. [Google AI Studio](https://aistudio.google.com/) で Gemini API キーを発行する

   > 本アプリは予定のタイトル・時刻を Gemini API に送信します。無料枠は送信内容が Google のモデル改善に利用され得るため、機密性の高い予定を扱う場合は有料（GCP / Vertex AI 経由）のキーを検討してください。

6. Slack Incoming Webhook を発行する

   1. [api.slack.com/apps](https://api.slack.com/apps) → 「Create New App」→「From scratch」で通知用のアプリを作成する
   2. 作成したアプリの設定画面で「Incoming Webhooks」を有効化（ON）にする
   3. 同じ画面の「Add New Webhook to Workspace」から通知先チャンネルを選んで許可する
   4. 発行された `https://hooks.slack.com/services/...` 形式の URL を控える

   > このURLを知っている人は誰でもそのチャンネルに投稿できるため、コードやコミット履歴に平文で残さないでください（後述のスクリプトプロパティにのみ保存します）。

7. `pnpm run open` で GAS エディタを開き、「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定する

   | プロパティ名 | 必須 | 説明 |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | ✅ | Google AI Studio で発行した Gemini API キー |
   | `GEMINI_MODEL` | - | Gemini のモデル名。未設定時は `gemini-3.5-flash-lite` |
   | `SLACK_WEBHOOK_URL` | ✅ | 手順6で発行した Slack Incoming Webhook の URL |
   | `SKIP_NOTIFICATION_WHEN_NO_EVENTS` | - | `true`/`false`。予定が0件の日に送信をスキップするか（未設定時は`false`＝スキップしない） |
   | `RECENT_THEMES` | - | 設定不要。直近7日分のテーマをアプリが自動で保存する |

   > 以前のバージョンで使っていた `THEME_LIST` / `THEME_WEEK_ID` / `THEME_INDEX` は現在使われていません。残っていても動作に影響はなく、手動で削除して構いません。

8. ビルド＆デプロイ（型チェック→テスト→esbuildビルド→`clasp push` を一括実行）

   ```sh
   pnpm run push
   ```

   > `clasp push` はマニフェスト更新時に上書き確認のプロンプトを出します。非対話環境（`!` 実行・CI など）で止まる場合は `pnpm exec clasp push -f` のように `-f`（force）を付けてください。

9. GAS エディタで `setupDailyTrigger` を選択して手動実行する（OAuth 同意と時間主導トリガーの登録を行う。同じトリガーは重複登録されない）

10. `runDailyMailer` を一度手動実行し、Slackにメッセージが届くことを確認する

## 開発ループ

```sh
pnpm test          # vitest でユニットテスト
pnpm run typecheck  # tsc --noEmit で型チェック
pnpm run push       # typecheck → test → build → clasp push
```

`src/` 配下は通常の ES モジュール（`import`/`export`）で記述し、`esbuild` で `dist/main.js` に単一ファイルへバンドルしてから `clasp push` します。GAS ランタイム API（`CalendarApp`/`UrlFetchApp`/`PropertiesService`）は `src/ports.ts` のインターフェース越しに `src/main.ts`（コンポジションルート）でのみ注入しているため、それ以外のロジックは vitest で GAS グローバルをモックせずにテストできます。

なお、esbuild は `bundle: true` でエントリを IIFE に包むため、GAS エディタの実行対象・トリガーから関数名で解決できるよう、`scripts/build.mjs` で `globalName` + `footer` を使い `runDailyMailer` / `setupDailyTrigger` をトップレベル関数として公開しています。

## ディレクトリ構成

```
src/
├── types.ts     # ドメイン型・Result型・AppError
├── ports.ts     # GASランタイムAPIを抽象化するインターフェース
├── config.ts    # Script Properties経由の設定読み込み
├── calendar.ts  # カレンダー予定の取得・変換
├── themeSeed.ts # テーマのシード語彙・日付からの乱数・直近テーマ履歴
├── prompt.ts    # Geminiへのプロンプト構築・レスポンス解析
├── http.ts      # UrlFetchAppのfetch＋ステータスチェック・再試行の共通処理
├── gemini.ts    # Gemini API呼び出し
├── slack.ts     # Slackメッセージの組み立て・Incoming Webhook送信
├── trigger.ts   # 時間主導トリガーのセットアップ
└── main.ts      # コンポジションルート（GASエントリポイント）
```
