import { describe, expect, it, vi } from 'vitest';
import { buildDailyMessageText, buildErrorMessageText, sendDailyNotification, sendErrorNotification } from '../src/slack.js';
import type { HttpFetcher } from '../src/ports.js';

function fakeFetcher(statusCode: number, contentText = 'ok'): HttpFetcher {
  return {
    fetch: vi.fn().mockReturnValue({
      getResponseCode: () => statusCode,
      getContentText: () => contentText,
    }),
  } as unknown as HttpFetcher;
}

describe('buildDailyMessageText', () => {
  it('固定プレフィックスのみを太字にし、titleは太字の外に続けて出力する', () => {
    const text = buildDailyMessageText({ title: '今日のタイトル', summary: '今日の要約' });
    expect(text).toBe('*【本日のタイトル】*今日のタイトル\n今日の要約');
  });

  it('titleに*が含まれても太字装飾が崩れない（太字はプレフィックスのみで完結する）', () => {
    const text = buildDailyMessageText({ title: '退屈な*重要*会議', summary: '要約' });
    expect(text).toBe('*【本日のタイトル】*退屈な*重要*会議\n要約');
  });

  it('titleとsummaryに含まれる & < > をSlack mrkdwn仕様通りにエスケープする', () => {
    const text = buildDailyMessageText({
      title: '<!channel> & <b>test</b>',
      summary: 'a < b && c > d',
    });
    expect(text).toBe(
      '*【本日のタイトル】*&lt;!channel&gt; &amp; &lt;b&gt;test&lt;/b&gt;\na &lt; b &amp;&amp; c &gt; d',
    );
  });
});

describe('buildErrorMessageText', () => {
  it('contextに含まれる & < > をエスケープする', () => {
    const text = buildErrorMessageText('<failure> & more');
    expect(text).toBe(':warning: calendar-title-mailerでエラーが発生しました\n&lt;failure&gt; &amp; more');
  });
});

describe('sendDailyNotification', () => {
  it('Webhook URLへ組み立てたテキストをJSONでPOSTする', () => {
    const fetcher = fakeFetcher(200);

    const result = sendDailyNotification(fetcher, 'https://hooks.slack.com/services/xxx', {
      title: 'タイトル',
      summary: '要約',
    });

    expect(result.ok).toBe(true);
    expect(fetcher.fetch).toHaveBeenCalledWith('https://hooks.slack.com/services/xxx', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: '*【本日のタイトル】*タイトル\n要約' }),
      muteHttpExceptions: true,
    });
  });

  it('エラーステータスの場合はSLACK_SEND_FAILEDを返す', () => {
    const fetcher = fakeFetcher(400, 'invalid_payload');

    const result = sendDailyNotification(fetcher, 'https://hooks.slack.com/services/xxx', {
      title: 'タイトル',
      summary: '要約',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SLACK_SEND_FAILED');
    }
  });
});

describe('sendErrorNotification', () => {
  it('エラー内容を含むテキストをPOSTする', () => {
    const fetcher = fakeFetcher(200);

    const result = sendErrorNotification(fetcher, 'https://hooks.slack.com/services/xxx', '失敗理由');

    expect(result.ok).toBe(true);
    const call = (fetcher.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const payload = JSON.parse(call[1].payload as string);
    expect(payload.text).toContain('失敗理由');
  });
});
