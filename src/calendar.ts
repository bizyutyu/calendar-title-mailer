import type { CalendarEventSummary } from './types.js';

export interface DateLike {
  getHours(): number;
  getMinutes(): number;
  getTime(): number;
}

export interface CalendarEventLike {
  getTitle(): string;
  getStartTime(): DateLike;
  getEndTime(): DateLike;
  isAllDayEvent(): boolean;
}

function formatTime(date: DateLike): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function toEventSummaries(events: readonly CalendarEventLike[]): CalendarEventSummary[] {
  return [...events]
    .sort((a, b) => a.getStartTime().getTime() - b.getStartTime().getTime())
    .map((event) => ({
      title: event.getTitle(),
      startTime: formatTime(event.getStartTime()),
      endTime: formatTime(event.getEndTime()),
      isAllDay: event.isAllDayEvent(),
    }));
}

/**
 * 基準日時の翌日（同時刻）を返す。月末・年末・うるう年の繰り上がりは Date に任せる。
 * 引数は変更しない。
 */
export function getNextDay(base: Date): Date {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + 1);
  return next;
}

export function fetchEventsForDay(
  calendar: GoogleAppsScript.Calendar.Calendar,
  day: Date,
): CalendarEventSummary[] {
  const events = calendar.getEventsForDay(day);
  return toEventSummaries(events);
}
