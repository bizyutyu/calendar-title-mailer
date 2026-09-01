import type { HttpFetcher } from './ports.js';
import type { AppErrorCode, Result } from './types.js';
import { err, ok } from './types.js';

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
      cause: response.getContentText(),
    });
  }

  return ok(response);
}
