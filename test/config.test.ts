import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../src/config.js';
import { DEFAULT_THEMES } from '../src/theme.js';
import type { PropertyReader } from '../src/ports.js';

function fakeReader(values: Record<string, string>): PropertyReader {
  return {
    getProperty(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key]! : null;
    },
  };
}

const BASE_PROPERTIES = { GEMINI_API_KEY: 'key', NOTIFY_EMAIL: 'me@example.com' };

describe('loadAppConfig', () => {
  it('APIキー未設定時はCONFIG_MISSING_API_KEYエラーを返す', () => {
    const result = loadAppConfig(fakeReader({ NOTIFY_EMAIL: 'me@example.com' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_MISSING_API_KEY');
    }
  });

  it('APIキーが空文字の場合もエラーを返す', () => {
    const result = loadAppConfig(
      fakeReader({ GEMINI_API_KEY: '   ', NOTIFY_EMAIL: 'me@example.com' }),
    );
    expect(result.ok).toBe(false);
  });

  it('NOTIFY_EMAIL未設定時はCONFIG_MISSING_NOTIFY_EMAILエラーを返す', () => {
    const result = loadAppConfig(fakeReader({ GEMINI_API_KEY: 'key' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONFIG_MISSING_NOTIFY_EMAIL');
    }
  });

  it('NOTIFY_EMAILが空文字の場合もエラーを返す', () => {
    const result = loadAppConfig(
      fakeReader({ GEMINI_API_KEY: 'key', NOTIFY_EMAIL: '   ' }),
    );
    expect(result.ok).toBe(false);
  });

  it('GEMINI_MODEL未設定時はデフォルトモデルを使用する', () => {
    const result = loadAppConfig(fakeReader(BASE_PROPERTIES));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.geminiModel).toBe('gemini-3.5-flash-lite');
    }
  });

  it('GEMINI_MODEL設定時はその値を使用する', () => {
    const result = loadAppConfig(
      fakeReader({ ...BASE_PROPERTIES, GEMINI_MODEL: 'gemini-2.5-flash' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.geminiModel).toBe('gemini-2.5-flash');
    }
  });

  it('SKIP_EMAIL_WHEN_NO_EVENTSを真偽値へ変換する', () => {
    expect(
      loadAppConfig(fakeReader({ ...BASE_PROPERTIES, SKIP_EMAIL_WHEN_NO_EVENTS: 'true' })),
    ).toMatchObject({ ok: true, value: { skipEmailWhenNoEvents: true } });
    expect(
      loadAppConfig(fakeReader({ ...BASE_PROPERTIES, SKIP_EMAIL_WHEN_NO_EVENTS: 'false' })),
    ).toMatchObject({ ok: true, value: { skipEmailWhenNoEvents: false } });
    expect(loadAppConfig(fakeReader(BASE_PROPERTIES))).toMatchObject({
      ok: true,
      value: { skipEmailWhenNoEvents: false },
    });
  });

  it('THEME_LIST未設定時はDEFAULT_THEMESを使用する', () => {
    const result = loadAppConfig(fakeReader(BASE_PROPERTIES));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.themes).toEqual([...DEFAULT_THEMES]);
    }
  });

  it('THEME_LIST設定時はカンマ区切りでパースし前後の空白を除去する', () => {
    const result = loadAppConfig(
      fakeReader({ ...BASE_PROPERTIES, THEME_LIST: ' 昭和レトロ風 , 未来都市風 ,,宇宙探索風 ' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.themes).toEqual(['昭和レトロ風', '未来都市風', '宇宙探索風']);
    }
  });

  it('NOTIFY_EMAIL設定時はその値を使用する', () => {
    const result = loadAppConfig(fakeReader(BASE_PROPERTIES));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.notifyEmail).toBe('me@example.com');
    }
  });
});
