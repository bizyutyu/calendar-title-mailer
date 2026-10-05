import type { HttpFetcher } from './ports.js';
import type { AppErrorCode, Result, RetryPolicy } from './types.js';
import { err, ok } from './types.js';

// エラー本文はログに残すため、リクエスト内容の反射などで肥大・混入しないよう先頭のみ保持する
const ERROR_BODY_MAX_LENGTH = 500;

function truncateBody(body: string): string {
  return body.length > ERROR_BODY_MAX_LENGTH ? `${body.slice(0, ERROR_BODY_MAX_LENGTH)}…(truncated)` : body;
}

export function fetchOk(
  fetcher: HttpFetcher,
  url: string,
  options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
  errorCode: AppErrorCode,
  serviceName: string,
): Result<GoogleAppsScript.URL_Fetch.HTTPResponse> {
  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = fetcher.fetch(url, options);
  } catch (cause) {
    return err({
      code: errorCode,
      message: `${serviceName}へのリクエストに失敗しました`,
      cause,
    });
  }

  const statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    return err({
      code: errorCode,
      message: `${serviceName}がエラーステータスを返しました: ${statusCode}`,
      cause: truncateBody(response.getContentText()),
    });
  }

  return ok(response);
}

// Gemini公式のTroubleshootingに従い、一時的なエラー（408/429/5xx・通信例外）のみ再試行する。
// https://ai.google.dev/gemini-api/docs/troubleshooting
function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function backoffDelayMs(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.floor(policy.random() * policy.baseDelayMs);
  return exponential + jitter;
}

// Slack Webhookは再送で二重投稿になり得るため、この関数はGemini呼び出し専用で使う。
export function fetchOkWithRetry(
  fetcher: HttpFetcher,
  url: string,
  options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
  errorCode: AppErrorCode,
  serviceName: string,
  policy: RetryPolicy,
): Result<GoogleAppsScript.URL_Fetch.HTTPResponse> {
  const maxAttempts = Number.isFinite(policy.maxAttempts) ? Math.max(1, Math.floor(policy.maxAttempts)) : 1;
  if (policy.now() >= policy.deadlineAt) {
    return err({
      code: errorCode,
      message: `実行時間の締め切りを過ぎているため${serviceName}を呼び出しませんでした`,
    });
  }

  let lastResult: Result<GoogleAppsScript.URL_Fetch.HTTPResponse> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delayMs = backoffDelayMs(attempt - 1, policy);
      // GASの実行時間上限（6分）で強制終了するとフォールバック通知も送れないため、締め切りを超える再試行はしない
      if (policy.now() + delayMs >= policy.deadlineAt) {
        break;
      }
      policy.sleep(delayMs);
    }

    let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
    try {
      response = fetcher.fetch(url, options);
    } catch (cause) {
      lastResult = err({
        code: errorCode,
        message: `${serviceName}へのリクエストに失敗しました（${attempt}/${maxAttempts}回目）`,
        cause,
      });
      continue;
    }

    const statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      return ok(response);
    }

    lastResult = err({
      code: errorCode,
      message: `${serviceName}がエラーステータスを返しました: ${statusCode}（${attempt}/${maxAttempts}回目）`,
      cause: truncateBody(response.getContentText()),
    });
    if (!isRetryableStatus(statusCode)) {
      return lastResult;
    }
  }

  return lastResult!;
}
