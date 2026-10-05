import { fetchOkWithRetry } from './http.js';
import type { HttpFetcher } from './ports.js';
import {
  buildPrompt,
  buildResponseSchema,
  buildThemePrompt,
  buildThemeResponseSchema,
  parseSummaryResponseText,
  parseThemeResponseText,
} from './prompt.js';
import type {
  DailyScheduleInput,
  GeminiGenerateContentRequest,
  Result,
  RetryPolicy,
  ThemeSeed,
} from './types.js';
import { err, ok } from './types.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// テーマは発想の幅を優先し、文章は予定内容に沿わせるため温度を分ける
const THEME_TEMPERATURE = 1.0;
const SUMMARY_TEMPERATURE = 0.7;

export interface GeminiClient {
  fetcher: HttpFetcher;
  apiKey: string;
  model: string;
  retryPolicy: RetryPolicy;
}

export function buildThemeRequest(
  seed: ThemeSeed,
  recentThemes: readonly string[],
): GeminiGenerateContentRequest {
  return {
    contents: [{ role: 'user', parts: [{ text: buildThemePrompt(seed, recentThemes) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildThemeResponseSchema(),
      temperature: THEME_TEMPERATURE,
    },
  };
}

export function buildSummaryRequest(
  input: DailyScheduleInput,
  theme: string,
): GeminiGenerateContentRequest {
  return {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input, theme) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(),
      temperature: SUMMARY_TEMPERATURE,
    },
  };
}

export function fetchGeminiTheme(
  client: GeminiClient,
  seed: ThemeSeed,
  recentThemes: readonly string[],
): Result<string> {
  const text = generateJson(client, buildThemeRequest(seed, recentThemes));
  return text.ok ? parseThemeResponseText(text.value) : text;
}

export function fetchGeminiSummary(
  client: GeminiClient,
  input: DailyScheduleInput,
  theme: string,
): Result<string> {
  const text = generateJson(client, buildSummaryRequest(input, theme));
  return text.ok ? parseSummaryResponseText(text.value) : text;
}

function generateJson(client: GeminiClient, request: GeminiGenerateContentRequest): Result<string> {
  // APIキーはURLに載せずヘッダーで渡す（例外メッセージやログにURLごと残る経路をなくす）
  // https://ai.google.dev/gemini-api/docs/api-key
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(client.model)}:generateContent`;

  const fetchResult = fetchOkWithRetry(
    client.fetcher,
    url,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': client.apiKey },
      payload: JSON.stringify(request),
      muteHttpExceptions: true,
    },
    'GEMINI_REQUEST_FAILED',
    'Gemini API',
    client.retryPolicy,
  );
  if (!fetchResult.ok) {
    return fetchResult;
  }

  let body: unknown;
  try {
    body = JSON.parse(fetchResult.value.getContentText());
  } catch (cause) {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Gemini APIのレスポンス全体をパースできませんでした',
      cause,
    });
  }

  // 内容起因の停止（SAFETY / RECITATION / MAX_TOKENS など）は再試行しても結果が変わらないため、理由だけ残す。
  // MAX_TOKENS 等では途中までのテキストが返ることがあり、JSONとして壊れているので先に判定する。
  const stopReason = extractStopReason(body);
  if (stopReason !== null) {
    return err({
      code: 'GEMINI_GENERATION_BLOCKED',
      message: `Geminiの生成が停止されました: ${stopReason}`,
    });
  }

  const candidateText = extractCandidateText(body);
  if (candidateText !== null) {
    return ok(candidateText);
  }
  return err({
    code: 'GEMINI_RESPONSE_INVALID',
    message: 'Gemini APIのレスポンスに候補テキストが含まれていません',
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function firstCandidate(body: unknown): Record<string, unknown> | null {
  const candidates = asRecord(body)?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  return asRecord(candidates[0]);
}

function extractCandidateText(body: unknown): string | null {
  const parts = asRecord(firstCandidate(body)?.content)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }
  const text = asRecord(parts[0])?.text;
  return typeof text === 'string' ? text : null;
}

function extractStopReason(body: unknown): string | null {
  const blockReason = asRecord(asRecord(body)?.promptFeedback)?.blockReason;
  if (typeof blockReason === 'string' && blockReason !== '') {
    return `blockReason=${blockReason}`;
  }
  const finishReason = firstCandidate(body)?.finishReason;
  if (typeof finishReason === 'string' && finishReason !== '' && finishReason !== 'STOP') {
    return `finishReason=${finishReason}`;
  }
  return null;
}
