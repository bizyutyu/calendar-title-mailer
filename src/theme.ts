import type { ThemeState } from './types.js';

export const DEFAULT_THEMES: readonly string[] = [
  'SF風',
  '時代劇風',
  'スポーツ実況風',
  '詩的・文学風',
  'ビジネス視点',
  'レトロゲーム風',
  'ミステリー風',
  '冒険物語風',
  'ドキュメンタリー風',
  '昔話風',
];

export function getIsoWeekId(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // 月曜=0 ... 日曜=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // その週の木曜日

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  const weekNumber =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

export function resolveThemeForWeek(
  themes: readonly string[],
  currentWeekId: string,
  storedState: ThemeState | null,
): { theme: string; nextState: ThemeState } {
  if (themes.length === 0) {
    throw new Error('themes must not be empty');
  }

  if (storedState === null || storedState.weekId !== currentWeekId) {
    const previousIndex = storedState ? storedState.themeIndex % themes.length : -1;
    const nextIndex = (previousIndex + 1) % themes.length;
    const nextState: ThemeState = { weekId: currentWeekId, themeIndex: nextIndex };
    return { theme: themes[nextIndex]!, nextState };
  }

  const currentIndex = storedState.themeIndex % themes.length;
  return { theme: themes[currentIndex]!, nextState: storedState };
}
