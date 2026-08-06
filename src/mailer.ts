import type { MailSender } from './ports.js';
import type { TitleResult } from './types.js';

const SUBJECT_PREFIX = '【本日のタイトル】';

export function buildMailPayload(result: TitleResult): { subject: string; body: string } {
  return {
    subject: `${SUBJECT_PREFIX}${result.title}`,
    body: result.summary,
  };
}

export function sendDailyMail(mailSender: MailSender, to: string, result: TitleResult): void {
  const { subject, body } = buildMailPayload(result);
  mailSender.sendEmail(to, subject, body);
}
