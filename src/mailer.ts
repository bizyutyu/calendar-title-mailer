import type { MailSender } from './ports.js';
import type { TitleResult } from './types.js';

export function buildMailPayload(result: TitleResult): { subject: string; body: string } {
  return {
    subject: result.title,
    body: result.subtitle,
  };
}

export function sendDailyMail(mailSender: MailSender, to: string, result: TitleResult): void {
  const { subject, body } = buildMailPayload(result);
  mailSender.sendEmail(to, subject, body);
}
