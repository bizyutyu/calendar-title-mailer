import { describe, expect, it } from 'vitest';
import { DAILY_DIGEST_FUNCTION_NAME, hasExistingTrigger } from '../src/trigger.js';
import type { TriggerLike } from '../src/trigger.js';

function fakeTrigger(handlerFunction: string): TriggerLike {
  return { getHandlerFunction: () => handlerFunction };
}

describe('hasExistingTrigger', () => {
  it('一致するハンドラ関数名を持つトリガーがあればtrueを返す', () => {
    const triggers = [fakeTrigger('otherFunction'), fakeTrigger('runDailyDigest')];
    expect(hasExistingTrigger(triggers, 'runDailyDigest')).toBe(true);
  });

  it('一致するトリガーがなければfalseを返す', () => {
    const triggers = [fakeTrigger('otherFunction')];
    expect(hasExistingTrigger(triggers, 'runDailyDigest')).toBe(false);
  });

  it('トリガーが空配列の場合はfalseを返す', () => {
    expect(hasExistingTrigger([], 'runDailyDigest')).toBe(false);
  });
});

describe('DAILY_DIGEST_FUNCTION_NAME', () => {
  it('トリガーの登録先はrunDailyDigest', () => {
    expect(DAILY_DIGEST_FUNCTION_NAME).toBe('runDailyDigest');
  });
});
