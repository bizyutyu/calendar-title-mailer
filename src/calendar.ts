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

export function fetchTodayEvents(
  calendar: GoogleAppsScript.Calendar.Calendar,
): CalendarEventSummary[] {
  const events = calendar.getEventsForDay(new Date());
  return toEventSummaries(events);
}
