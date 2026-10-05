import { describe, expect, it, vi } from 'vitest';
import { fetchOk, fetchOkWithRetry } from '../src/http.js';
import type { HttpFetcher } from '../src/ports.js';
import type { RetryPolicy } from '../src/types.js';

describe('fetchOk', () => {
  it('2xxレスポンスの場合はokでレスポンスをそのまま返す', () => {
    const response = { getResponseCode: () => 200, getContentText: () => 'body' };
    const fetcher: HttpFetcher = { fetch: vi.fn().mockReturnValue(response) };

    const result = fetchOk(fetcher, 'https://example.com', {}, 'SLACK_SEND_FAILED', 'Example');

    expect(result).toEqual({ ok: true, value: response });
  });

  it('fetchが例外を投げた場合は指定したerrorCodeでerrを返す', () => {
    const fetcher: HttpFetcher = {
      fetch: vi.fn().mockImplementation(() => {
        throw new Error('network down');
      }),
    };

    const result = fetchOk(fetcher, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
      expect(result.error.message).toBe('Gemini APIへのリクエストに失敗しました');
    }
  });

  it('2xx範囲外のステータスコードの場合はerrを返し、本文をcauseに含める', () => {
    const fetcher: HttpFetcher = {
      fetch: vi.fn().mockReturnValue({ getResponseCode: () => 500, getContentText: () => 'boom' }),
    };

    const result = fetchOk(fetcher, 'https://example.com', {}, 'SLACK_SEND_FAILED', 'Slack');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SLACK_SEND_FAILED');
      expect(result.error.message).toBe('Slackがエラーステータスを返しました: 500');
      expect(result.error.cause).toBe('boom');
    }
  });
});

function response(code: number, body = ''): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return {
    getResponseCode: () => code,
    getContentText: () => body,
  } as unknown as GoogleAppsScript.URL_Fetch.HTTPResponse;
}

function fakePolicy(overrides: Partial<RetryPolicy> = {}): RetryPolicy & { sleep: ReturnType<typeof vi.fn> } {
  return {
    maxAttempts: 3,
    baseDelayMs: 1000,
    sleep: vi.fn(),
    random: () => 0,
    now: () => 0,
    deadlineAt: Number.POSITIVE_INFINITY,
    ...overrides,
  } as RetryPolicy & { sleep: ReturnType<typeof vi.fn> };
}

describe('fetchOkWithRetry', () => {
  it('503→503→200 の場合は再試行して成功し、待ち時間が指数的に伸びる', () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(response(503))
      .mockReturnValueOnce(response(503))
      .mockReturnValueOnce(response(200, 'ok'));
    const policy = fakePolicy();

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', policy);

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(policy.sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  it('ジッターとして baseDelayMs × random を加える', () => {
    const fetch = vi.fn().mockReturnValueOnce(response(429)).mockReturnValueOnce(response(200));
    const policy = fakePolicy({ random: () => 0.5 });

    fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', policy);

    expect(policy.sleep.mock.calls).toEqual([[1500]]);
  });

  it('429が続く場合は最大回数で諦め、最後のエラーを返す', () => {
    const fetch = vi.fn().mockReturnValue(response(429, 'quota'));
    const policy = fakePolicy();

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', policy);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Gemini APIがエラーステータスを返しました: 429（3/3回目）');
      expect(result.error.cause).toBe('quota');
    }
  });

  it.each([400, 403, 404])('%i は再試行せず1回で終わる', (code) => {
    const fetch = vi.fn().mockReturnValue(response(code));
    const policy = fakePolicy();

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', policy);

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(policy.sleep).not.toHaveBeenCalled();
  });

  it.each([408, 500, 502, 504])('%i は再試行対象になる', (code) => {
    const fetch = vi.fn().mockReturnValueOnce(response(code)).mockReturnValueOnce(response(200));

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy());

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fetchの例外（通信エラー）は再試行する', () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('network down');
      })
      .mockReturnValueOnce(response(200));

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy());

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('例外が続いた場合はリクエスト失敗のエラーを返す', () => {
    const fetch = vi.fn().mockImplementation(() => {
      throw new Error('network down');
    });

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy({ maxAttempts: 2 }));

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
      expect(result.error.message).toBe('Gemini APIへのリクエストに失敗しました（2/2回目）');
    }
  });

  it('maxAttemptsが0以下でも最低1回は実行する', () => {
    const fetch = vi.fn().mockReturnValue(response(200));

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy({ maxAttempts: 0 }));

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetchOkWithRetry の締め切り', () => {
  it('締め切りを過ぎていれば1回も呼び出さない', () => {
    const fetch = vi.fn();

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy({ now: () => 100, deadlineAt: 100 }));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('締め切り');
    }
  });

  it('待機すると締め切りを超える場合は再試行せず、直前のエラーを返す', () => {
    const fetch = vi.fn().mockReturnValue(response(503, 'unavailable'));
    const policy = fakePolicy({ now: () => 0, deadlineAt: 1500 }); // 1回目の待機1000msは可、2回目の2000msは不可

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', policy);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(policy.sleep.mock.calls).toEqual([[1000]]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('503（2/3回目）');
    }
  });
});

describe('fetchOkWithRetry の入力値・ログ対策', () => {
  it('maxAttemptsがNaNでも1回は実行し、nullを返さない', () => {
    const fetch = vi.fn().mockReturnValue(response(500));

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy({ maxAttempts: Number.NaN }));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it('エラー本文は500文字で切り詰めてcauseに入れる', () => {
    const fetch = vi.fn().mockReturnValue(response(400, 'x'.repeat(2000)));

    const result = fetchOkWithRetry({ fetch }, 'https://example.com', {}, 'GEMINI_REQUEST_FAILED', 'Gemini API', fakePolicy());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause).toBe(`${'x'.repeat(500)}…(truncated)`);
    }
  });
});

describe('fetchOk のエラー本文', () => {
  it('500文字で切り詰める', () => {
    const fetcher: HttpFetcher = { fetch: vi.fn().mockReturnValue(response(500, 'y'.repeat(501))) };

    const result = fetchOk(fetcher, 'https://example.com', {}, 'SLACK_SEND_FAILED', 'Slack');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.cause).toBe(`${'y'.repeat(500)}…(truncated)`);
    }
  });
});
