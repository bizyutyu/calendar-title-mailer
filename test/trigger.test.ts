import { describe, expect, it } from 'vitest';
import { hasExistingTrigger } from '../src/trigger.js';
import type { TriggerLike } from '../src/trigger.js';

function fakeTrigger(handlerFunction: string): TriggerLike {
  return { getHandlerFunction: () => handlerFunction };
}

describe('hasExistingTrigger', () => {
  it('一致するハンドラ関数名を持つトリガーがあればtrueを返す', () => {
    const triggers = [fakeTrigger('otherFunction'), fakeTrigger('runDailyMailer')];
    expect(hasExistingTrigger(triggers, 'runDailyMailer')).toBe(true);
  });

  it('一致するトリガーがなければfalseを返す', () => {
    const triggers = [fakeTrigger('otherFunction')];
    expect(hasExistingTrigger(triggers, 'runDailyMailer')).toBe(false);
  });

  it('トリガーが空配列の場合はfalseを返す', () => {
    expect(hasExistingTrigger([], 'runDailyMailer')).toBe(false);
  });
});
