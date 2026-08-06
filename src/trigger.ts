export interface TriggerLike {
  getHandlerFunction(): string;
}

export function hasExistingTrigger(
  triggers: readonly TriggerLike[],
  functionName: string,
): boolean {
  return triggers.some((trigger) => trigger.getHandlerFunction() === functionName);
}

const DAILY_MAILER_FUNCTION_NAME = 'runDailyMailer';

export function setupDailyTrigger(): void {
  const existingTriggers = ScriptApp.getProjectTriggers();
  if (hasExistingTrigger(existingTriggers, DAILY_MAILER_FUNCTION_NAME)) {
    return;
  }

  ScriptApp.newTrigger(DAILY_MAILER_FUNCTION_NAME)
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .nearMinute(0)
    .create();
}
