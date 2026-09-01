import type { PropertyReader } from './ports.js';
import { DEFAULT_THEMES } from './theme.js';
import type { AppConfig, Result } from './types.js';
import { err, ok } from './types.js';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

function parseThemeList(raw: string | null): string[] {
  if (raw === null) {
    return [...DEFAULT_THEMES];
  }
  const themes = raw
    .split(',')
    .map((theme) => theme.trim())
    .filter((theme) => theme.length > 0);
  return themes.length > 0 ? themes : [...DEFAULT_THEMES];
}

function parseBoolean(raw: string | null, defaultValue: boolean): boolean {
  if (raw === null) {
    return defaultValue;
  }
  return raw.trim().toLowerCase() === 'true';
}

export function loadAppConfig(reader: PropertyReader): Result<AppConfig> {
  const geminiApiKey = reader.getProperty('GEMINI_API_KEY');
  if (geminiApiKey === null || geminiApiKey.trim() === '') {
    return err({
      code: 'CONFIG_MISSING_API_KEY',
      message: 'Script Property "GEMINI_API_KEY" が設定されていません',
    });
  }

  const slackWebhookUrl = reader.getProperty('SLACK_WEBHOOK_URL')?.trim();
  if (slackWebhookUrl === undefined || slackWebhookUrl === '') {
    return err({
      code: 'CONFIG_MISSING_SLACK_WEBHOOK_URL',
      message: 'Script Property "SLACK_WEBHOOK_URL" が設定されていません',
    });
  }

  const geminiModel = reader.getProperty('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
  const skipNotificationWhenNoEvents = parseBoolean(
    reader.getProperty('SKIP_NOTIFICATION_WHEN_NO_EVENTS'),
    false,
  );
  const themes = parseThemeList(reader.getProperty('THEME_LIST'));

  return ok({
    geminiApiKey,
    geminiModel,
    slackWebhookUrl,
    skipNotificationWhenNoEvents,
    themes,
  });
}
