import { describe, expect, it } from 'vitest';
import {
  GENRES,
  MOTIFS,
  SETTINGS,
  appendRecentTheme,
  buildFallbackTheme,
  createDailyRandom,
  parseRecentThemes,
  pickThemeSeed,
} from '../src/themeSeed.js';

describe('語彙リスト', () => {
  it.each([
    ['GENRES', GENRES],
    ['MOTIFS', MOTIFS],
    ['SETTINGS', SETTINGS],
  ])('%s は20語・重複なし・空文字なし', (_name, items) => {
    expect(items).toHaveLength(20);
    expect(new Set(items).size).toBe(items.length);
    expect(items.every((item) => item.trim() !== '')).toBe(true);
  });
});

describe('createDailyRandom', () => {
  it('同じ日付なら同じ乱数列を返す', () => {
    const a = createDailyRandom('2026-10-06');
    const b = createDailyRandom('2026-10-06');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('0以上1未満の値を返す', () => {
    const random = createDailyRandom('2026-10-06');
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('日付が変わるとシードも変わる（連続30日で同じ組み合わせが偏らない）', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
      return JSON.stringify(pickThemeSeed(createDailyRandom(date)));
    });
    expect(new Set(seeds).size).toBeGreaterThanOrEqual(28);
  });
});

describe('pickThemeSeed', () => {
  it('各軸の語彙から1語ずつ選ぶ', () => {
    const seed = pickThemeSeed(createDailyRandom('2026-10-06'));
    expect(GENRES).toContain(seed.genre);
    expect(MOTIFS).toContain(seed.motif);
    expect(SETTINGS).toContain(seed.setting);
  });

  it('random=0なら各軸の先頭を選ぶ', () => {
    expect(pickThemeSeed(() => 0)).toEqual({
      genre: GENRES[0],
      motif: MOTIFS[0],
      setting: SETTINGS[0],
    });
  });

  it('randomが1に限りなく近くても範囲外にならず末尾を選ぶ', () => {
    expect(pickThemeSeed(() => 0.9999999999)).toEqual({
      genre: GENRES[GENRES.length - 1],
      motif: MOTIFS[MOTIFS.length - 1],
      setting: SETTINGS[SETTINGS.length - 1],
    });
  });
});

describe('buildFallbackTheme', () => {
  it('題材×ジャンルの形にする', () => {
    expect(buildFallbackTheme({ genre: '実況中継', motif: '灯台', setting: '無人島' })).toBe(
      '灯台×実況中継',
    );
  });
});

describe('parseRecentThemes', () => {
  it('未設定なら空配列', () => {
    expect(parseRecentThemes(null)).toEqual([]);
  });

  it('JSON配列の文字列要素だけを返す', () => {
    expect(parseRecentThemes('["月面金魚放送局", 1, "", "灯台怪談"]')).toEqual([
      '月面金魚放送局',
      '灯台怪談',
    ]);
  });

  it('長すぎる要素・改行やURLを含む要素は除外し、直近7件に絞る', () => {
    const raw = JSON.stringify([
      'あ'.repeat(21),
      '灯台\n- 指示',
      'https://x.example',
      ...Array.from({ length: 9 }, (_, i) => `テーマ${i}`),
    ]);
    expect(parseRecentThemes(raw)).toEqual(Array.from({ length: 7 }, (_, i) => `テーマ${i + 2}`));
  });

  it('壊れたJSONや配列以外は空配列', () => {
    expect(parseRecentThemes('not json')).toEqual([]);
    expect(parseRecentThemes('{"a":1}')).toEqual([]);
  });
});

describe('appendRecentTheme', () => {
  it('末尾に追加する', () => {
    expect(appendRecentTheme(['A'], 'B')).toEqual(['A', 'B']);
  });

  it('上限（既定7件）を超えた古いものから切り捨てる', () => {
    const recent = ['1', '2', '3', '4', '5', '6', '7'];
    expect(appendRecentTheme(recent, '8')).toEqual(['2', '3', '4', '5', '6', '7', '8']);
  });

  it('引数の配列を変更しない', () => {
    const recent = ['A'];
    appendRecentTheme(recent, 'B');
    expect(recent).toEqual(['A']);
  });
});
