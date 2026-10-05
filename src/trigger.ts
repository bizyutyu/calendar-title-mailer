export interface TriggerLike {
  getHandlerFunction(): string;
}

export const DAILY_DIGEST_FUNCTION_NAME = 'runDailyDigest';

export function hasExistingTrigger(
  triggers: readonly TriggerLike[],
  functionName: string,
): boolean {
  return triggers.some((trigger) => trigger.getHandlerFunction() === functionName);
}

export function setupDailyTrigger(): void {
  const existingTriggers = ScriptApp.getProjectTriggers();
  if (hasExistingTrigger(existingTriggers, DAILY_DIGEST_FUNCTION_NAME)) {
    return;
  }

  ScriptApp.newTrigger(DAILY_DIGEST_FUNCTION_NAME)
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(0)
    .create();
}
