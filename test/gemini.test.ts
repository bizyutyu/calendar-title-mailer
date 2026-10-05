import { describe, expect, it, vi } from 'vitest';
import {
  buildSummaryRequest,
  buildThemeRequest,
  fetchGeminiSummary,
  fetchGeminiTheme,
} from '../src/gemini.js';
import type { GeminiClient } from '../src/gemini.js';
import type { HttpFetcher } from '../src/ports.js';
import type { DailyScheduleInput, ThemeSeed } from '../src/types.js';

function fakeResponse(code: number, body: string): GoogleAppsScript.URL_Fetch.HTTPResponse {
  return {
    getResponseCode: () => code,
    getContentText: () => body,
  } as unknown as GoogleAppsScript.URL_Fetch.HTTPResponse;
}

function candidateBody(text: string, finishReason = 'STOP'): string {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] });
}

function fakeClient(fetch: HttpFetcher['fetch']): GeminiClient & { sleep: ReturnType<typeof vi.fn> } {
  const sleep = vi.fn();
  return {
    fetcher: { fetch },
    apiKey: 'secret-api-key',
    model: 'gemini-3.5-flash-lite',
    retryPolicy: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      sleep,
      random: () => 0,
      now: () => 0,
      deadlineAt: Number.POSITIVE_INFINITY,
    },
    sleep,
  };
}

const input: DailyScheduleInput = {
  date: '2026-08-06',
  events: [{ title: '定例会議', startTime: '10:00', endTime: '11:00', isAllDay: false }],
};

const seed: ThemeSeed = { genre: '深夜ラジオ', motif: 'ロボット', setting: '月面都市' };

describe('buildThemeRequest', () => {
  it('シード語を含み、温度1.0・themeスキーマで組み立てる', () => {
    const request = buildThemeRequest(seed, []);
    expect(request.contents[0]?.parts[0]?.text).toContain('ロボット');
    expect(request.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { required: ['theme'] },
      temperature: 1.0,
    });
  });
});

describe('buildSummaryRequest', () => {
  it('テーマを含み、温度0.7・summaryスキーマで組み立てる', () => {
    const request = buildSummaryRequest(input, 'SF風');
    expect(request.contents[0]?.parts[0]?.text).toContain('SF風');
    expect(request.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { required: ['summary'] },
      temperature: 0.7,
    });
  });
});

describe('APIキーの渡し方', () => {
  it('URLにkey=を含めず、x-goog-api-keyヘッダーで送る', () => {
    const fetch = vi.fn(() => fakeResponse(200, candidateBody('{"theme":"月面ロボ深夜便"}')));

    fetchGeminiTheme(fakeClient(fetch), seed, []);

    const [url, options] = fetch.mock.calls[0] as unknown as [
      string,
      GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
    ];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect(url).not.toContain('secret-api-key');
    expect(options.headers).toEqual({ 'x-goog-api-key': 'secret-api-key' });
    expect(options.muteHttpExceptions).toBe(true);
  });
});

describe('fetchGeminiTheme', () => {
  it('成功レスポンスからthemeを取り出す', () => {
    const fetch = vi.fn(() => fakeResponse(200, candidateBody('{"theme":"月面ロボ深夜便"}')));

    expect(fetchGeminiTheme(fakeClient(fetch), seed, [])).toEqual({
      ok: true,
      value: '月面ロボ深夜便',
    });
  });

  it('503の後に成功すれば再試行で回復する', () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(fakeResponse(503, 'unavailable'))
      .mockReturnValueOnce(fakeResponse(200, candidateBody('{"theme":"月面ロボ深夜便"}')));
    const client = fakeClient(fetch);

    expect(fetchGeminiTheme(client, seed, []).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(client.sleep).toHaveBeenCalledWith(1000);
  });
});

describe('fetchGeminiSummary', () => {
  it('成功レスポンスからsummaryを取り出す', () => {
    const fetch = vi.fn(() => fakeResponse(200, candidateBody('{"summary":"要約"}')));

    expect(fetchGeminiSummary(fakeClient(fetch), input, 'SF風')).toEqual({ ok: true, value: '要約' });
  });

  it('400は再試行せずGEMINI_REQUEST_FAILEDを返す', () => {
    const fetch = vi.fn(() => fakeResponse(400, 'bad request'));

    const result = fetchGeminiSummary(fakeClient(fetch), input, 'SF風');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
    }
  });

  it('5xxが続いた場合は最大回数まで再試行してGEMINI_REQUEST_FAILEDを返す', () => {
    const fetch = vi.fn(() => fakeResponse(500, 'internal error'));

    const result = fetchGeminiSummary(fakeClient(fetch), input, 'SF風');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
    }
  });

  it('レスポンス全体が不正なJSONの場合はGEMINI_RESPONSE_INVALIDを返す', () => {
    const result = fetchGeminiSummary(fakeClient(vi.fn(() => fakeResponse(200, 'not json'))), input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_RESPONSE_INVALID');
    }
  });

  it('candidatesが欠落し停止理由もない場合はGEMINI_RESPONSE_INVALIDを返す', () => {
    const result = fetchGeminiSummary(fakeClient(vi.fn(() => fakeResponse(200, '{}'))), input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_RESPONSE_INVALID');
    }
  });

  it('promptFeedback.blockReasonがあればGEMINI_GENERATION_BLOCKEDで理由を含める', () => {
    const body = JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } });
    const fetch = vi.fn(() => fakeResponse(200, body));

    const result = fetchGeminiSummary(fakeClient(fetch), input, 'SF風');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_GENERATION_BLOCKED');
      expect(result.error.message).toContain('blockReason=SAFETY');
    }
  });

  it('finishReasonがMAX_TOKENSなら途中までのテキストがあってもGEMINI_GENERATION_BLOCKEDにする', () => {
    const fetch = vi.fn(() => fakeResponse(200, candidateBody('{"summary":"途中', 'MAX_TOKENS')));

    const result = fetchGeminiSummary(fakeClient(fetch), input, 'SF風');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_GENERATION_BLOCKED');
      expect(result.error.message).toContain('finishReason=MAX_TOKENS');
    }
  });

  it('fetch自体が例外を投げ続けた場合はGEMINI_REQUEST_FAILEDを返す', () => {
    const fetch = vi.fn(() => {
      throw new Error('network error');
    });

    const result = fetchGeminiSummary(fakeClient(fetch), input, 'SF風');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_REQUEST_FAILED');
    }
  });
});
