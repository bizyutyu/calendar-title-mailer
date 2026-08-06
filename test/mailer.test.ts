import { describe, expect, it, vi } from 'vitest';
import { buildMailPayload, sendDailyMail } from '../src/mailer.js';
import type { MailSender } from '../src/ports.js';

describe('buildMailPayload', () => {
  it('件名に固定プレフィックス+title、本文にsummaryのみを設定し予定一覧は含めない', () => {
    const payload = buildMailPayload({ title: '今日のタイトル', summary: '今日の要約' });
    expect(payload).toEqual({ subject: '【本日のタイトル】今日のタイトル', body: '今日の要約' });
  });
});

describe('sendDailyMail', () => {
  it('MailSender.sendEmailを正しい引数で呼び出す', () => {
    const sendEmail = vi.fn();
    const mailSender: MailSender = { sendEmail };

    sendDailyMail(mailSender, 'me@example.com', { title: 'タイトル', summary: '要約' });

    expect(sendEmail).toHaveBeenCalledWith('me@example.com', '【本日のタイトル】タイトル', '要約');
  });
});
