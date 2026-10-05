import type { ThemeSeed } from './types.js';

// テーマのばらつきをモデルの癖に任せないため、乱数で選んだ語をGeminiに渡して連想させる。
// 語彙はユーザー確認済み。追加・差し替え時は各軸の語数と重複なしをテストで担保する。
export const GENRES: readonly string[] = [
  '実況中継',
  '航海日誌',
  '怪談',
  '料理番組',
  '天気予報',
  '落語',
  '探偵小説',
  '宇宙飛行士の交信',
  '自然ドキュメンタリー',
  '吟遊詩人の歌',
  '新聞号外',
  '取扱説明書',
  '昔話',
  '冒険の書',
  '博物館の解説',
  '深夜ラジオ',
  '時代劇',
  '通販番組',
  '学級日誌',
  '拝啓で始まる手紙',
];

export const MOTIFS: readonly string[] = [
  '灯台',
  '古時計',
  '路面電車',
  '万年筆',
  '星座',
  '喫茶店',
  '紙飛行機',
  '蒸気機関車',
  '望遠鏡',
  '古地図',
  '砂時計',
  '羅針盤',
  '雪解け',
  '風鈴',
  '渡り鳥',
  '宝箱',
  'ドラゴン',
  '魔法の杖',
  'ロボット',
  'タイムマシン',
];

export const SETTINGS: readonly string[] = [
  '昭和の商店街',
  '江戸の長屋',
  '深海基地',
  '月面都市',
  '中世の城下町',
  '砂漠のオアシス',
  '霧の港町',
  '南極観測船',
  '雲の上の王国',
  '大正のカフェー',
  '未来の空港',
  '山奥の温泉宿',
  '無人島',
  '古代の神殿',
  '蒸気都市',
  '夜の遊園地',
  '北欧の森',
  '宇宙ステーション',
  '朝市の通り',
  '魔法学校',
];

export const RECENT_THEMES_LIMIT = 7;

// プロンプトの指示は10文字以内。多少超える程度は採用し、明らかに文章になっているものだけ弾く
export const THEME_HARD_LIMIT = 20;

// テーマはSlack出力・当日の文章プロンプト・翌日以降のテーマプロンプトへ流れるため、
// 行構造を崩す制御文字や誘導用のURLを含むものは採用しない
export function isAcceptableThemeText(text: string): boolean {
  return (
    text.trim() !== '' &&
    text.length <= THEME_HARD_LIMIT &&
    !/[\u0000-\u001f\u007f]/.test(text) &&
    !/https?:\/\//i.test(text)
  );
}

// FNV-1a で日付文字列を32bit整数へ畳み込み、mulberry32 の初期値にする。
// 同じ日付なら同じ乱数列になるため、同日の再実行でも同じシード語が選ばれる。
// 日付は末尾数文字しか違わず、FNV-1a だけでは連続した日の初期値が似通って語の出現に偏りが出たため、
// MurmurHash3 の fmix32 でビットを拡散させる（10年分の検証で χ² が棄却点付近 → 期待値付近に改善）。
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function createDailyRandom(date: string): () => number {
  let state = hashString(date);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(items: readonly string[], random: () => number): string {
  const index = Math.min(Math.floor(random() * items.length), items.length - 1);
  return items[Math.max(index, 0)]!;
}

export function pickThemeSeed(random: () => number): ThemeSeed {
  return {
    genre: pickOne(GENRES, random),
    motif: pickOne(MOTIFS, random),
    setting: pickOne(SETTINGS, random),
  };
}

export function buildFallbackTheme(seed: ThemeSeed): string {
  return `${seed.motif}×${seed.genre}`;
}

export function parseRecentThemes(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  // 手編集などで不正な値が入っていても、プロンプトに流すのは妥当な直近分だけにする
  return parsed
    .filter((item): item is string => typeof item === 'string' && isAcceptableThemeText(item))
    .slice(-RECENT_THEMES_LIMIT);
}

export function appendRecentTheme(
  recentThemes: readonly string[],
  theme: string,
  limit = RECENT_THEMES_LIMIT,
): string[] {
  return [...recentThemes, theme].slice(-limit);
}
