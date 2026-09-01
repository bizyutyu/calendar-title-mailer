import { fetchOk } from './http.js';
import type { HttpFetcher } from './ports.js';
import type { Result, TitleResult } from './types.js';
import { ok } from './types.js';

const SUBJECT_PREFIX = '【本日のタイトル】';

// Slack mrkdwnは & < > を特殊文字として解釈するため、動的な本文はAPI仕様通りにエスケープする。
// https://api.slack.com/reference/surfaces/formatting#escaping
function escapeSlackMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildDailyMessageText(result: TitleResult): string {
  const title = escapeSlackMrkdwn(result.title);
  const summary = escapeSlackMrkdwn(result.summary);
  return `*${SUBJECT_PREFIX}*${title}\n${summary}`;
}

export function buildErrorMessageText(context: string): string {
  return `:warning: calendar-title-mailerでエラーが発生しました\n${escapeSlackMrkdwn(context)}`;
}

function postToSlack(fetcher: HttpFetcher, webhookUrl: string, text: string): Result<void> {
  const result = fetchOk(
    fetcher,
    webhookUrl,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text }),
      muteHttpExceptions: true,
    },
    'SLACK_SEND_FAILED',
    'Slack',
  );
  if (!result.ok) {
    return result;
  }
  return ok(undefined);
}

export function sendDailyNotification(
  fetcher: HttpFetcher,
  webhookUrl: string,
  result: TitleResult,
): Result<void> {
  return postToSlack(fetcher, webhookUrl, buildDailyMessageText(result));
}

export function sendErrorNotification(
  fetcher: HttpFetcher,
  webhookUrl: string,
  context: string,
): Result<void> {
  return postToSlack(fetcher, webhookUrl, buildErrorMessageText(context));
}
