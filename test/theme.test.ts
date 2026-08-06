import { describe, expect, it } from 'vitest';
import { getIsoWeekId, resolveThemeForWeek } from '../src/theme.js';
import type { ThemeState } from '../src/types.js';

describe('getIsoWeekId', () => {
  it('通常の週内の日付を正しく計算する', () => {
    expect(getIsoWeekId(new Date(2007, 0, 1))).toBe('2007-W01');
  });

  it('年末が翌年の第1週に属するケースを正しく扱う', () => {
    expect(getIsoWeekId(new Date(2008, 11, 29))).toBe('2009-W01');
  });

  it('年始が前年の最終週に属するケースを正しく扱う', () => {
    expect(getIsoWeekId(new Date(2005, 0, 1))).toBe('2004-W53');
  });

  it('年始が前年の第53週に属するケース(2010-01-03)を正しく扱う', () => {
    expect(getIsoWeekId(new Date(2010, 0, 3))).toBe('2009-W53');
  });

  it('その翌日は新年の第1週になる(2010-01-04)', () => {
    expect(getIsoWeekId(new Date(2010, 0, 4))).toBe('2010-W01');
  });
});

describe('resolveThemeForWeek', () => {
  const themes = ['A', 'B', 'C'];

  it('storedStateがnullの場合は先頭のテーマを選ぶ', () => {
    const { theme, nextState } = resolveThemeForWeek(themes, '2026-W32', null);
    expect(theme).toBe('A');
    expect(nextState).toEqual({ weekId: '2026-W32', themeIndex: 0 });
  });

  it('同じ週の場合はテーマを据え置く', () => {
    const stored: ThemeState = { weekId: '2026-W32', themeIndex: 1 };
    const { theme, nextState } = resolveThemeForWeek(themes, '2026-W32', stored);
    expect(theme).toBe('B');
    expect(nextState).toBe(stored);
  });

  it('週が変わったら次のテーマへ進める', () => {
    const stored: ThemeState = { weekId: '2026-W32', themeIndex: 0 };
    const { theme, nextState } = resolveThemeForWeek(themes, '2026-W33', stored);
    expect(theme).toBe('B');
    expect(nextState).toEqual({ weekId: '2026-W33', themeIndex: 1 });
  });

  it('末尾のテーマの次は先頭へ循環する', () => {
    const stored: ThemeState = { weekId: '2026-W32', themeIndex: 2 };
    const { theme, nextState } = resolveThemeForWeek(themes, '2026-W33', stored);
    expect(theme).toBe('A');
    expect(nextState).toEqual({ weekId: '2026-W33', themeIndex: 0 });
  });

  it('themes配列が縮小されてstoredIndexが範囲外でも安全に扱う', () => {
    const stored: ThemeState = { weekId: '2026-W32', themeIndex: 5 };
    const { theme } = resolveThemeForWeek(themes, '2026-W32', stored);
    expect(theme).toBe(themes[5 % themes.length]);
  });

  it('themesが空配列の場合は例外を投げる', () => {
    expect(() => resolveThemeForWeek([], '2026-W32', null)).toThrow();
  });
});
