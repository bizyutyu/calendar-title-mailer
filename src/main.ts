import { fetchTodayEvents } from './calendar.js';
import { loadAppConfig } from './config.js';
import { fetchGeminiTitleResult } from './gemini.js';
import { sendDailyNotification, sendErrorNotification } from './slack.js';
import { getIsoWeekId, resolveThemeForWeek } from './theme.js';
import { setupDailyTrigger as setupDailyTriggerImpl } from './trigger.js';
import { buildFallbackTitleResult } from './prompt.js';
import type { AppConfig, DailyScheduleInput, ThemeState, TitleResult } from './types.js';

function logError(context: string, error: unknown): void {
  console.error(`[calendar-title-mailer] ${context}`, error);
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

function readThemeState(properties: GoogleAppsScript.Properties.Properties): ThemeState | null {
  const weekId = properties.getProperty('THEME_WEEK_ID');
  const themeIndexRaw = properties.getProperty('THEME_INDEX');
  if (weekId === null || themeIndexRaw === null) {
    return null;
  }
  const themeIndex = Number.parseInt(themeIndexRaw, 10);
  if (Number.isNaN(themeIndex)) {
    return null;
  }
  return { weekId, themeIndex };
}

function resolveWeeklyTheme(config: AppConfig, properties: GoogleAppsScript.Properties.Properties): string {
  const currentWeekId = getIsoWeekId(new Date());
  const storedState = readThemeState(properties);
  const { theme, nextState } = resolveThemeForWeek(config.themes, currentWeekId, storedState);

  if (storedState === null || storedState.weekId !== nextState.weekId) {
    properties.setProperty('THEME_WEEK_ID', nextState.weekId);
    properties.setProperty('THEME_INDEX', String(nextState.themeIndex));
  }

  return theme;
}

export function runDailyMailer(): void {
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
    const events = fetchTodayEvents(CalendarApp.getDefaultCalendar());
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    scheduleInput = { date: today, events };
  } catch (cause) {
    logError('カレンダー予定の取得に失敗しました', cause);
    notifyFailure(config, 'カレンダー予定の取得に失敗したため、本日の通知は送信されませんでした');
    return;
  }

  const theme = resolveWeeklyTheme(config, properties);

  if (scheduleInput.events.length === 0 && config.skipNotificationWhenNoEvents) {
    console.log('[calendar-title-mailer] 予定がないため送信をスキップしました');
    return;
  }

  const geminiResult = fetchGeminiTitleResult(
    UrlFetchApp,
    config.geminiApiKey,
    config.geminiModel,
    scheduleInput,
    theme,
  );

  let titleResult: TitleResult;
  if (geminiResult.ok) {
    titleResult = geminiResult.value;
  } else {
    logError('Gemini APIの呼び出しに失敗しました。フォールバック文言を使用します', geminiResult.error);
    titleResult = buildFallbackTitleResult(scheduleInput, theme);
  }

  const sendResult = sendDailyNotification(UrlFetchApp, config.slackWebhookUrl, titleResult);
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
