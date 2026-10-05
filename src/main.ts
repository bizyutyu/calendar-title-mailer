import { fetchEventsForDay, getNextDay } from './calendar.js';
import { loadAppConfig } from './config.js';
import { fetchGeminiSummary, fetchGeminiTheme } from './gemini.js';
import type { GeminiClient } from './gemini.js';
import { buildFallbackSummary } from './prompt.js';
import { sendDailyNotification, sendErrorNotification } from './slack.js';
import {
  appendRecentTheme,
  buildFallbackTheme,
  createDailyRandom,
  parseRecentThemes,
  pickThemeSeed,
} from './themeSeed.js';
import { setupDailyTrigger as setupDailyTriggerImpl } from './trigger.js';
import type { AppConfig, DailyScheduleInput, RetryPolicy } from './types.js';

const RECENT_THEMES_PROPERTY = 'RECENT_THEMES';

// GASの実行時間上限は6分/実行（https://developers.google.com/apps-script/guides/services/quotas）。
// UrlFetchAppのタイムアウトは指定できず1回の所要時間が読めないため、待機時間ではなく経過時間で打ち切る。
// 開始から4分を過ぎたらGeminiの再試行・呼び出しをやめ、残り時間でフォールバック通知を確実に送る。
const GEMINI_DEADLINE_MS = 4 * 60 * 1000;

function createGeminiRetryPolicy(startedAt: number): RetryPolicy {
  return {
    maxAttempts: 3, // 待機は 1秒+ジッター → 2秒+ジッター
    baseDelayMs: 1000,
    sleep: (ms) => Utilities.sleep(ms),
    random: () => Math.random(),
    now: () => Date.now(),
    deadlineAt: startedAt + GEMINI_DEADLINE_MS,
  };
}

// UrlFetchAppの例外メッセージにリクエストURL（Slack Webhook URL等）が含まれる可能性を否定できないため、
// ログへ出す前にURLを伏せる
function redactUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s"'<>]+/g, '[URL]');
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return redactUrls(`${error.name}: ${error.message}`);
  }
  if (typeof error === 'object' && error !== null) {
    const { code, message, cause } = error as { code?: unknown; message?: unknown; cause?: unknown };
    const head = [code, message].filter((part) => part !== undefined).map(String).join(': ');
    const tail = cause === undefined ? '' : ` / cause: ${describeError(cause)}`;
    return redactUrls(`${head}${tail}`);
  }
  return redactUrls(String(error));
}

function logError(context: string, error: unknown): void {
  console.error(`[calendar-title-mailer] ${context}: ${describeError(error)}`);
}

function notifyFailure(config: AppConfig | null, context: string): void {
  if (config === null) {
    return;
  }
  const result = sendErrorNotification(UrlFetchApp, config.slackWebhookUrl, context);
  if (!result.ok) {
    logError('エラー通知のSlack送信にも失敗しました', result.error);
  }
}

function resolveDailyTheme(
  client: GeminiClient,
  properties: GoogleAppsScript.Properties.Properties,
  targetDate: string,
): string {
  const seed = pickThemeSeed(createDailyRandom(targetDate));
  const recentThemes = parseRecentThemes(properties.getProperty(RECENT_THEMES_PROPERTY));

  const themeResult = fetchGeminiTheme(client, seed, recentThemes);
  let theme: string;
  if (themeResult.ok) {
    theme = themeResult.value;
  } else {
    logError('テーマ生成に失敗しました。シード語から組み立てたテーマを使用します', themeResult.error);
    theme = buildFallbackTheme(seed);
  }

  try {
    properties.setProperty(
      RECENT_THEMES_PROPERTY,
      JSON.stringify(appendRecentTheme(recentThemes, theme)),
    );
  } catch (cause) {
    // 履歴の保存失敗で通知まで止めない（翌日の重複回避が弱まるだけ）
    logError('直近テーマの保存に失敗しました', cause);
  }

  return theme;
}

export function runDailyMailer(): void {
  const startedAt = Date.now();
  const properties = PropertiesService.getScriptProperties();

  const configResult = loadAppConfig(properties);
  if (!configResult.ok) {
    logError('設定の読み込みに失敗しました', configResult.error);
    notifyFailure(null, configResult.error.message);
    return;
  }
  const config = configResult.value;

  let scheduleInput: DailyScheduleInput;
  try {
    const targetDay = getNextDay(new Date());
    const events = fetchEventsForDay(CalendarApp.getDefaultCalendar(), targetDay);
    const targetDate = Utilities.formatDate(targetDay, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    scheduleInput = { date: targetDate, events };
  } catch (cause) {
    logError('カレンダー予定の取得に失敗しました', cause);
    notifyFailure(config, 'カレンダー予定の取得に失敗したため、明日の予定の通知は送信されませんでした');
    return;
  }

  if (scheduleInput.events.length === 0 && config.skipNotificationWhenNoEvents) {
    console.log('[calendar-title-mailer] 予定がないため送信をスキップしました');
    return;
  }

  const client: GeminiClient = {
    fetcher: UrlFetchApp,
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    retryPolicy: createGeminiRetryPolicy(startedAt),
  };

  const theme = resolveDailyTheme(client, properties, scheduleInput.date);

  const summaryResult = fetchGeminiSummary(client, scheduleInput, theme);
  let summary: string;
  if (summaryResult.ok) {
    summary = summaryResult.value;
  } else {
    logError('文章生成に失敗しました。フォールバック文言を使用します', summaryResult.error);
    summary = buildFallbackSummary(scheduleInput);
  }

  const sendResult = sendDailyNotification(UrlFetchApp, config.slackWebhookUrl, summary, theme);
  if (!sendResult.ok) {
    logError('Slackへの通知送信に失敗しました', sendResult.error);
  }
}

export function setupDailyTrigger(): void {
  setupDailyTriggerImpl();
}

// runDailyMailer / setupDailyTrigger は scripts/build.mjs の esbuild 設定
// （globalName + footer）で GAS グローバルのトップレベル関数として公開され、
// エディタの実行対象・時間主導トリガーから関数名で解決される。
