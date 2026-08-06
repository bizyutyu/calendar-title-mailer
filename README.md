# calendar-title-mailer

毎朝、Google カレンダー（デフォルトカレンダー）の今日の予定をもとに、Gemini API でタイトルとサブタイトルを生成し、Gmail で自分宛てに通知する Google Apps Script (GAS) プロジェクトです。

メールの件名にはGeminiが生成したタイトル、本文にはサブタイトルのみが入ります（予定一覧そのものはメール本文に含まれません）。

毎週、固定リストの中から「世界観テーマ」（SF風、時代劇風、スポーツ実況風…）を1つ順番に選び、その週はGeminiにそのテーマの文体でタイトル・サブタイトルを生成させます。

## セットアップ手順

1. 依存パッケージをインストール

   ```sh
   pnpm install
   ```

2. clasp にログイン（初回のみ）

   ```sh
   pnpm run login
   ```

3. GAS プロジェクトを作成

   ```sh
   npx clasp create --type standalone --title "calendar-title-mailer" --rootDir dist
   ```

   生成された `.clasp.json` は `scriptId` を含むため `.gitignore` 対象です（コミットしないでください）。

4. [Google AI Studio](https://aistudio.google.com/) で Gemini API キーを発行する

5. `pnpm run open` で GAS エディタを開き、「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定する

   | プロパティ名 | 必須 | 説明 |
   | --- | --- | --- |
   | `GEMINI_API_KEY` | ✅ | Google AI Studio で発行した Gemini API キー |
   | `GEMINI_MODEL` | - | Gemini のモデル名。未設定時は `gemini-2.5-flash-lite` |
   | `NOTIFY_EMAIL` | - | 通知先メールアドレス。未設定時は実行ユーザー自身 |
   | `SKIP_EMAIL_WHEN_NO_EVENTS` | - | `true`/`false`。予定が0件の日に送信をスキップするか（未設定時は`false`＝スキップしない） |
   | `THEME_LIST` | - | カンマ区切りの週替わりテーマ一覧。未設定時は `src/theme.ts` のデフォルト一覧を使用 |

6. ビルド＆デプロイ（型チェック→テスト→esbuildビルド→`clasp push` を一括実行）

   ```sh
   pnpm run push
   ```

7. GAS エディタで `setupDailyTrigger` を選択して手動実行する（OAuth 同意と時間主導トリガーの登録を行う。同じトリガーは重複登録されない）

8. `runDailyMailer` を一度手動実行し、Gmail にメールが届くことを確認する

## 開発ループ

```sh
pnpm test          # vitest でユニットテスト
pnpm run typecheck  # tsc --noEmit で型チェック
pnpm run push       # typecheck → test → build → clasp push
```

`src/` 配下は通常の ES モジュール（`import`/`export`）で記述し、`esbuild` で `dist/main.js` に単一ファイルへバンドルしてから `clasp push` します。GAS ランタイム API（`CalendarApp`/`GmailApp`/`UrlFetchApp`/`PropertiesService`）は `src/ports.ts` のインターフェース越しに `src/main.ts`（コンポジションルート）でのみ注入しているため、それ以外のロジックは vitest で GAS グローバルをモックせずにテストできます。

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
