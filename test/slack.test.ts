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
  it('「文章（テーマ：テーマ）」の1行にし、接頭辞は付けない', () => {
    const text = buildDailyMessageText('明日は灯台守として3つの航路を照らす。', '灯台怪談');
    expect(text).toBe('明日は灯台守として3つの航路を照らす。（テーマ：灯台怪談）');
    expect(text).not.toContain('【');
  });

  it('*が含まれてもそのまま出力される（太字装飾は使わないため崩れない）', () => {
    expect(buildDailyMessageText('退屈な*重要*会議', '*実況*')).toBe('退屈な*重要*会議（テーマ：*実況*）');
  });

  it('文章とテーマに含まれる & < > をSlack mrkdwn仕様通りにエスケープする', () => {
    const text = buildDailyMessageText('a < b && c > d', '<!channel> & <b>');
    expect(text).toBe('a &lt; b &amp;&amp; c &gt; d（テーマ：&lt;!channel&gt; &amp; &lt;b&gt;）');
  });
});

describe('buildErrorMessageText', () => {
  it('contextに含まれる & < > をエスケープする', () => {
    const text = buildErrorMessageText('<failure> & more');
    expect(text).toBe(':warning: tomorrow-calendar-digestでエラーが発生しました\n&lt;failure&gt; &amp; more');
  });
});

describe('sendDailyNotification', () => {
  it('Webhook URLへ組み立てたテキストをJSONでPOSTする', () => {
    const fetcher = fakeFetcher(200);

    const result = sendDailyNotification(fetcher, 'https://hooks.slack.com/services/xxx', '要約', 'テーマ');

    expect(result.ok).toBe(true);
    expect(fetcher.fetch).toHaveBeenCalledWith('https://hooks.slack.com/services/xxx', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: '要約（テーマ：テーマ）' }),
      muteHttpExceptions: true,
    });
  });

  it('エラーステータスの場合はSLACK_SEND_FAILEDを返す', () => {
    const fetcher = fakeFetcher(400, 'invalid_payload');

    const result = sendDailyNotification(fetcher, 'https://hooks.slack.com/services/xxx', '要約', 'テーマ');

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
