# calendar-title-mailer

毎朝、Google カレンダー（デフォルトカレンダー）の今日の予定をもとに、Gemini API でタイトルとサブタイトルを生成し、メールで自分宛てに通知する Google Apps Script (GAS) プロジェクトです。

メールの件名にはGeminiが生成したタイトル、本文にはサブタイトルのみが入ります（予定一覧そのものはメール本文に含まれません）。

毎週、固定リストの中から「世界観テーマ」（SF風、時代劇風、スポーツ実況風…）を1つ順番に選び、その週はGeminiにそのテーマの文体でタイトル・サブタイトルを生成させます。

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

6. `pnpm run open` で GAS エディタを開き、「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定する

   | プロパティ名 | 必須 | 説明 |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | ✅ | Google AI Studio で発行した Gemini API キー |
   | `GEMINI_MODEL` | - | Gemini のモデル名。未設定時は `gemini-2.5-flash-lite` |
   | `NOTIFY_EMAIL` | - | 通知先メールアドレス。未設定時は実行ユーザー自身 |
   | `SKIP_EMAIL_WHEN_NO_EVENTS` | - | `true`/`false`。予定が0件の日に送信をスキップするか（未設定時は`false`＝スキップしない） |
   | `THEME_LIST` | - | カンマ区切りの週替わりテーマ一覧。未設定時は `src/theme.ts` のデフォルト一覧を使用 |

7. ビルド＆デプロイ（型チェック→テスト→esbuildビルド→`clasp push` を一括実行）

   ```sh
   pnpm run push
   ```

   > `clasp push` はマニフェスト更新時に上書き確認のプロンプトを出します。非対話環境（`!` 実行・CI など）で止まる場合は `pnpm exec clasp push -f` のように `-f`（force）を付けてください。

8. GAS エディタで `setupDailyTrigger` を選択して手動実行する（OAuth 同意と時間主導トリガーの登録を行う。同じトリガーは重複登録されない）

9. `runDailyMailer` を一度手動実行し、メールが届くことを確認する

## 開発ループ

```sh
pnpm test          # vitest でユニットテスト
pnpm run typecheck  # tsc --noEmit で型チェック
pnpm run push       # typecheck → test → build → clasp push
```

`src/` 配下は通常の ES モジュール（`import`/`export`）で記述し、`esbuild` で `dist/main.js` に単一ファイルへバンドルしてから `clasp push` します。GAS ランタイム API（`CalendarApp`/`MailApp`/`UrlFetchApp`/`PropertiesService`）は `src/ports.ts` のインターフェース越しに `src/main.ts`（コンポジションルート）でのみ注入しているため、それ以外のロジックは vitest で GAS グローバルをモックせずにテストできます。

なお、esbuild は `bundle: true` でエントリを IIFE に包むため、GAS エディタの実行対象・トリガーから関数名で解決できるよう、`scripts/build.mjs` で `globalName` + `footer` を使い `runDailyMailer` / `setupDailyTrigger` をトップレベル関数として公開しています。

## ディレクトリ構成

```
src/
├── types.ts     # ドメイン型・Result型・AppError
├── ports.ts     # GASランタイムAPIを抽象化するインターフェース
├── config.ts    # Script Properties経由の設定読み込み
├── calendar.ts  # カレンダー予定の取得・変換
├── theme.ts     # 週替わりテーマのローテーション
├── prompt.ts    # Geminiへのプロンプト構築・レスポンス解析
├── gemini.ts    # Gemini API呼び出し
├── mailer.ts    # メール件名/本文の組み立て・送信
├── trigger.ts   # 時間主導トリガーのセットアップ
└── main.ts      # コンポジションルート（GASエントリポイント）
```
