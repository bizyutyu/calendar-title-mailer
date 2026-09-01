export interface CalendarEventSummary {
  title: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isAllDay: boolean;
}

export interface DailyScheduleInput {
  date: string; // yyyy-MM-dd
  events: CalendarEventSummary[];
}

export interface TitleResult {
  title: string;
  summary: string;
}

export interface GeminiGenerateContentRequest {
  contents: Array<{ role?: 'user'; parts: Array<{ text: string }> }>;
  generationConfig?: {
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    temperature?: number;
  };
}

export interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export interface ThemeState {
  weekId: string; // ISO週識別子 "YYYY-Www"
  themeIndex: number; // themes配列上の現在位置
}

export interface AppConfig {
  geminiApiKey: string;
  geminiModel: string;
  slackWebhookUrl: string;
  skipNotificationWhenNoEvents: boolean;
  themes: string[];
}

export type AppErrorCode =
  | 'CONFIG_MISSING_API_KEY'
  | 'CONFIG_MISSING_SLACK_WEBHOOK_URL'
  | 'CALENDAR_FETCH_FAILED'
  | 'GEMINI_REQUEST_FAILED'
  | 'GEMINI_RESPONSE_INVALID'
  | 'SLACK_SEND_FAILED';

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
