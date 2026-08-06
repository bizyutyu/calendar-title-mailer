import { describe, expect, it } from 'vitest';
import { toEventSummaries } from '../src/calendar.js';
import type { CalendarEventLike } from '../src/calendar.js';

function fakeEvent(
  title: string,
  start: Date,
  end: Date,
  isAllDay = false,
): CalendarEventLike {
  return {
    getTitle: () => title,
    getStartTime: () => start,
    getEndTime: () => end,
    isAllDayEvent: () => isAllDay,
  };
}

describe('toEventSummaries', () => {
  it('開始時刻の昇順にソートする', () => {
    const afternoon = fakeEvent(
      '午後会議',
      new Date(2026, 7, 6, 14, 0),
      new Date(2026, 7, 6, 15, 0),
    );
    const morning = fakeEvent('朝会', new Date(2026, 7, 6, 9, 30), new Date(2026, 7, 6, 10, 0));

    const result = toEventSummaries([afternoon, morning]);

    expect(result.map((event) => event.title)).toEqual(['朝会', '午後会議']);
  });

  it('時刻をHH:mm形式でフォーマットする', () => {
    const event = fakeEvent('朝会', new Date(2026, 7, 6, 9, 5), new Date(2026, 7, 6, 9, 30));

    const [summary] = toEventSummaries([event]);

    expect(summary).toBeDefined();
    expect(summary!.startTime).toBe('09:05');
    expect(summary!.endTime).toBe('09:30');
  });

  it('終日イベントはisAllDay=trueになる', () => {
    const event = fakeEvent(
      '休暇',
      new Date(2026, 7, 6, 0, 0),
      new Date(2026, 7, 7, 0, 0),
      true,
    );

    const [summary] = toEventSummaries([event]);

    expect(summary!.isAllDay).toBe(true);
  });

  it('終日/時間指定イベントが混在してもそれぞれ正しく変換する', () => {
    const allDay = fakeEvent(
      '休暇',
      new Date(2026, 7, 6, 0, 0),
      new Date(2026, 7, 7, 0, 0),
      true,
    );
    const timed = fakeEvent('打ち合わせ', new Date(2026, 7, 6, 13, 0), new Date(2026, 7, 6, 14, 0));

    const result = toEventSummaries([timed, allDay]);

    expect(result).toEqual([
      { title: '休暇', startTime: '00:00', endTime: '00:00', isAllDay: true },
      { title: '打ち合わせ', startTime: '13:00', endTime: '14:00', isAllDay: false },
    ]);
  });

  it('空配列の場合は空配列を返す', () => {
    expect(toEventSummaries([])).toEqual([]);
  });
});
