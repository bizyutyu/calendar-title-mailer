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

export interface ThemeSeed {
  genre: string; // ジャンル・文体（どう語るか）
  motif: string; // 題材（何をモチーフにするか）
  setting: string; // 舞台・時代（どこで・いつ）
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  sleep(ms: number): void;
  random(): number; // 0以上1未満。ジッター算出用
  now(): number; // epoch ms
  deadlineAt: number; // epoch ms。待機後にこれを超える再試行は行わない
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

export interface AppConfig {
  geminiApiKey: string;
  geminiModel: string;
  slackWebhookUrl: string;
  skipNotificationWhenNoEvents: boolean;
}

export type AppErrorCode =
  | 'CONFIG_MISSING_API_KEY'
  | 'CONFIG_MISSING_SLACK_WEBHOOK_URL'
  | 'CALENDAR_FETCH_FAILED'
  | 'GEMINI_REQUEST_FAILED'
  | 'GEMINI_RESPONSE_INVALID'
  | 'GEMINI_GENERATION_BLOCKED'
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
