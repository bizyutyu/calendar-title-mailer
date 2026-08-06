import type { DailyScheduleInput, Result, TitleResult } from './types.js';
import { err, ok } from './types.js';

const TITLE_MAX_LENGTH = 15;
const SUMMARY_MAX_LENGTH = 80;

function formatEventsForPrompt(input: DailyScheduleInput): string {
  if (input.events.length === 0) {
    return '本日の予定は登録されていません。';
  }
  return input.events
    .map((event) => {
      const time = event.isAllDay ? '終日' : `${event.startTime}-${event.endTime}`;
      return `- ${time} ${event.title}`;
    })
    .join('\n');
}

export function buildPrompt(input: DailyScheduleInput, theme: string): string {
  return [
    `あなたは今週の「世界観テーマ: ${theme}」に沿って、ユーザーの1日を彩るメールの見出しと本文を作る担当です。`,
    `以下は${input.date}の予定一覧です。予定の詳細をそのまま書き写さず、テーマの世界観・文体を反映した短いタイトルと、その日の予定内容が伝わる要約文（summary）を作成してください。`,
    '',
    formatEventsForPrompt(input),
    '',
    '制約:',
    `- title は${TITLE_MAX_LENGTH}文字以内`,
    `- summary は${SUMMARY_MAX_LENGTH}文字以内で、その日ならではの内容が伝わる一意な文章にする`,
    '- 絵文字は使わない',
    '- 予定のタイトルや時刻をそのまま列挙しない',
    '- 出力は指定されたJSONスキーマに厳密に従う',
  ].join('\n');
}

export function buildResponseSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      summary: { type: 'STRING' },
    },
    required: ['title', 'summary'],
  };
}

export function parseGeminiResponseText(text: string): Result<TitleResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Geminiのレスポンスをパースできませんでした',
      cause,
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Geminiのレスポンスがオブジェクトではありません',
    });
  }

  const candidate = parsed as Record<string, unknown>;
  const title = candidate.title;
  const summary = candidate.summary;

  if (typeof title !== 'string' || title.trim() === '') {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Geminiのレスポンスにtitleが含まれていません',
    });
  }

  if (typeof summary !== 'string' || summary.trim() === '') {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Geminiのレスポンスにsummaryが含まれていません',
    });
  }

  return ok({ title, summary });
}

export function buildFallbackTitleResult(input: DailyScheduleInput, theme: string): TitleResult {
  if (input.events.length === 0) {
    return {
      title: `今日はゆとりの日`,
      summary: `予定なし。テーマ「${theme}」の一日を自由に。`,
    };
  }
  return {
    title: `今日の予定 (${input.events.length}件)`,
    summary: `テーマ「${theme}」で1日が始まります。`,
  };
}
