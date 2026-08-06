import { describe, expect, it } from 'vitest';
import {
  buildFallbackTitleResult,
  buildPrompt,
  buildResponseSchema,
  parseGeminiResponseText,
} from '../src/prompt.js';
import type { DailyScheduleInput } from '../src/types.js';

describe('buildPrompt', () => {
  it('テーマ名と予定一覧をプロンプトに含める', () => {
    const input: DailyScheduleInput = {
      date: '2026-08-06',
      events: [{ title: '定例会議', startTime: '10:00', endTime: '11:00', isAllDay: false }],
    };
    const prompt = buildPrompt(input, 'SF風');
    expect(prompt).toContain('SF風');
    expect(prompt).toContain('定例会議');
    expect(prompt).toContain('2026-08-06');
  });

  it('予定が0件の場合は予定なしの旨を含める', () => {
    const input: DailyScheduleInput = { date: '2026-08-06', events: [] };
    const prompt = buildPrompt(input, 'SF風');
    expect(prompt).toContain('予定は登録されていません');
  });
});

describe('buildResponseSchema', () => {
  it('title/summaryを必須項目とするOBJECTスキーマを返す', () => {
    const schema = buildResponseSchema();
    expect(schema).toMatchObject({
      type: 'OBJECT',
      required: ['title', 'summary'],
    });
  });
});

describe('parseGeminiResponseText', () => {
  it('正しいJSONをパースできる', () => {
    const result = parseGeminiResponseText('{"title":"タイトル","summary":"要約"}');
    expect(result).toEqual({ ok: true, value: { title: 'タイトル', summary: '要約' } });
  });

  it('不正なJSONはエラーになる', () => {
    const result = parseGeminiResponseText('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('GEMINI_RESPONSE_INVALID');
    }
  });

  it('オブジェクトでないJSONはエラーになる', () => {
    const result = parseGeminiResponseText('[]');
    expect(result.ok).toBe(false);
  });

  it('titleが欠落している場合はエラーになる', () => {
    const result = parseGeminiResponseText('{"summary":"要約"}');
    expect(result.ok).toBe(false);
  });

  it('summaryが欠落している場合はエラーになる', () => {
    const result = parseGeminiResponseText('{"title":"タイトル"}');
    expect(result.ok).toBe(false);
  });

  it('titleが空文字の場合はエラーになる', () => {
    const result = parseGeminiResponseText('{"title":"  ","summary":"要約"}');
    expect(result.ok).toBe(false);
  });

  it('summaryが空文字の場合はエラーになる', () => {
    const result = parseGeminiResponseText('{"title":"タイトル","summary":""}');
    expect(result.ok).toBe(false);
  });
});

describe('buildFallbackTitleResult', () => {
  it('予定が0件の場合は「ゆとりの日」系の文言を返す', () => {
    const input: DailyScheduleInput = { date: '2026-08-06', events: [] };
    const result = buildFallbackTitleResult(input, 'SF風');
    expect(result.title).toContain('ゆとり');
    expect(result.summary).toContain('SF風');
  });

  it('予定がある場合は件数とテーマ名を含む文言を返す', () => {
    const input: DailyScheduleInput = {
      date: '2026-08-06',
      events: [
        { title: 'A', startTime: '09:00', endTime: '10:00', isAllDay: false },
        { title: 'B', startTime: '11:00', endTime: '12:00', isAllDay: false },
      ],
    };
    const result = buildFallbackTitleResult(input, 'ビジネス視点');
    expect(result.title).toContain('2件');
    expect(result.summary).toContain('ビジネス視点');
  });
});
