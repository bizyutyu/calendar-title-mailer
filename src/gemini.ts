import type { HttpFetcher } from './ports.js';
import { buildPrompt, buildResponseSchema, parseGeminiResponseText } from './prompt.js';
import type { DailyScheduleInput, GeminiGenerateContentRequest, Result, TitleResult } from './types.js';
import { err } from './types.js';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function buildGeminiRequest(
  input: DailyScheduleInput,
  theme: string,
): GeminiGenerateContentRequest {
  return {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input, theme) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(),
      temperature: 0.7,
    },
  };
}

export function fetchGeminiTitleResult(
  fetcher: HttpFetcher,
  apiKey: string,
  model: string,
  input: DailyScheduleInput,
  theme: string,
): Result<TitleResult> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const request = buildGeminiRequest(input, theme);

  let response: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    response = fetcher.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(request),
      muteHttpExceptions: true,
    });
  } catch (cause) {
    return err({
      code: 'GEMINI_REQUEST_FAILED',
      message: 'Gemini APIへのリクエストに失敗しました',
      cause,
    });
  }

  const statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    return err({
      code: 'GEMINI_REQUEST_FAILED',
      message: `Gemini APIがエラーステータスを返しました: ${statusCode}`,
      cause: response.getContentText(),
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(response.getContentText());
  } catch (cause) {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Gemini APIのレスポンス全体をパースできませんでした',
      cause,
    });
  }

  const candidateText = extractCandidateText(body);
  if (candidateText === null) {
    return err({
      code: 'GEMINI_RESPONSE_INVALID',
      message: 'Gemini APIのレスポンスに候補テキストが含まれていません',
    });
  }

  return parseGeminiResponseText(candidateText);
}

function extractCandidateText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidates = (body as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }
  const text = (parts[0] as Record<string, unknown> | undefined)?.text;
  return typeof text === 'string' ? text : null;
}
