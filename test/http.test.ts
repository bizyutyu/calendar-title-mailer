import { describe, expect, it, vi } from 'vitest';
import { fetchOk } from '../src/http.js';
import type { HttpFetcher } from '../src/ports.js';

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
