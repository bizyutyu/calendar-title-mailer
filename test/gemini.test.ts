import { describe, expect, it, vi } from 'vitest';
import { buildGeminiRequest, fetchGeminiTitleResult } from '../src/gemini.js';
import type { HttpFetcher } from '../src/ports.js';
import type { DailyScheduleInput } from '../src/types.js';

function fakeResponse(
  code: number,
  body: string,
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return {
    getResponseCode: () => code,
    getContentText: () => body,
  } as unknown as GoogleAppsScript.URL_Fetch.HTTPResponse;
}

const input: DailyScheduleInput = {
  date: '2026-08-06',
  events: [{ title: '定例会議', startTime: '10:00', endTime: '11:00', isAllDay: false }],
};

describe('buildGeminiRequest', () => {
  it('テーマとプロンプトを含むリクエストを組み立てる', () => {
    const request = buildGeminiRequest(input, 'SF風');
    expect(request.contents[0]?.parts[0]?.text).toContain('SF風');
    expect(request.generationConfig?.responseMimeType).toBe('application/json');
  });
});

describe('fetchGeminiTitleResult', () => {
  it('成功レスポンスからTitleResultを取り出す', () => {
    const body = JSON.stringify({
      candidates: [
        { content: { parts: [{ text: '{"title":"タイトル","subtitle":"サブタイトル"}' }] } },
      ],
    });
    const fetcher: HttpFetcher = { fetch: vi.fn(() => fakeResponse(200, body)) };

    const result = fetchGeminiTitleResult(fetcher, 'api-key', 'gemini-2.5-flash-lite', input, 'SF風');

    expect(result).toEqual({ ok: true, value: { title: 'タイトル', subtitle: 'サブタイトル' } });
  });

  it('4xx/5xxステータスの場合はGEMINI_REQUEST_FAILEDを返す', () => {
    const fetcher: HttpFetcher = { fetch: vi.fn(() => fakeResponse(500, 'internal error')) };

    const result = fetchGeminiTitleResult(fetcher, 'api-key', 'gemini-2.5-flash-lite', input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
    }
  });

  it('レスポンス全体が不正なJSONの場合はGEMINI_RESPONSE_INVALIDを返す', () => {
    const fetcher: HttpFetcher = { fetch: vi.fn(() => fakeResponse(200, 'not json')) };

    const result = fetchGeminiTitleResult(fetcher, 'api-key', 'gemini-2.5-flash-lite', input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_RESPONSE_INVALID');
    }
  });

  it('candidatesが欠落している場合はGEMINI_RESPONSE_INVALIDを返す', () => {
    const fetcher: HttpFetcher = { fetch: vi.fn(() => fakeResponse(200, '{}')) };

    const result = fetchGeminiTitleResult(fetcher, 'api-key', 'gemini-2.5-flash-lite', input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_RESPONSE_INVALID');
    }
  });

  it('fetch自体が例外を投げた場合はGEMINI_REQUEST_FAILEDを返す', () => {
    const fetcher: HttpFetcher = {
      fetch: vi.fn(() => {
        throw new Error('network error');
      }),
    };

    const result = fetchGeminiTitleResult(fetcher, 'api-key', 'gemini-2.5-flash-lite', input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
    }
  });
});
