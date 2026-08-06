import { describe, expect, it, vi } from 'vitest';
import { buildMailPayload, sendDailyMail } from '../src/mailer.js';
import type { MailSender } from '../src/ports.js';

describe('buildMailPayload', () => {
  it('件名にtitle、本文にsubtitleのみを設定し予定一覧は含めない', () => {
    const payload = buildMailPayload({ title: '今日のタイトル', subtitle: '今日のサブタイトル' });
    expect(payload).toEqual({ subject: '今日のタイトル', body: '今日のサブタイトル' });
  });
});

describe('sendDailyMail', () => {
  it('MailSender.sendEmailを正しい引数で呼び出す', () => {
    const sendEmail = vi.fn();
    const mailSender: MailSender = { sendEmail };

    sendDailyMail(mailSender, 'me@example.com', { title: 'タイトル', subtitle: 'サブタイトル' });

    expect(sendEmail).toHaveBeenCalledWith('me@example.com', 'タイトル', 'サブタイトル');
  });
});
