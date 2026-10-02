import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWeChatTranscript,
  renderWeChatTranscriptMarkdown,
  safeZipEntryName,
} from '../src/services/wechat-transcript.ts';

// 运行方式：pnpm --filter api exec node --import tsx --test test/wechat-transcript.test.mjs
const sample = [
  '\uFEFF·张三',
  '2026年1月2日 09:05',
  '第一条消息',
  '正文第二行',
  '',
  '·李四',
  '2026年1月2日 09:06',
  '看这个视频',
].join('\r\n');

test('parses the native WeChat transcript format including BOM and CRLF', () => {
  const records = parseWeChatTranscript(sample);

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.sender),
    ['张三', '李四'],
  );
  assert.equal(records[0].text, '第一条消息\n正文第二行');
  assert.equal(records[0].date?.getFullYear(), 2026);
  assert.equal(records[0].date?.getMonth(), 0);
  assert.equal(records[0].date?.getDate(), 2);
  assert.equal(records[1].dateText, '2026年1月2日 09:06');
});

test('renders records and uploaded media into markdown', () => {
  const records = parseWeChatTranscript(sample);
  const markdown = renderWeChatTranscriptMarkdown({
    records,
    media: [
      { name: 'photo.jpg', url: 'https://img.example/p/photo.jpg', kind: 'image' },
      { name: 'video.mp4', url: 'https://img.example/p/video.mp4', kind: 'video' },
      { name: 'voice.silk', url: null, kind: 'audio' },
    ],
  });

  assert.match(markdown, /\*\*张三\*\* · 2026年1月2日 09:05/);
  assert.match(markdown, /!\[photo\.jpg\]\(https:\/\/img\.example\/p\/photo\.jpg\)/);
  assert.match(markdown, /\[视频：video\.mp4\]/);
  assert.match(markdown, /voice\.silk（未能上传到图床）/);
});

test('zip entry names with traversal or control characters are rejected', () => {
  assert.equal(safeZipEntryName('聊天记录.txt'), '聊天记录.txt');
  assert.equal(safeZipEntryName('folder/1.jpg'), '1.jpg');
  assert.equal(safeZipEntryName('../escape.txt'), null);
  assert.equal(safeZipEntryName('a/../../escape.txt'), null);
  assert.equal(safeZipEntryName('back\\slash.txt'), null);
  assert.equal(safeZipEntryName('bad\u0000name.txt'), null);
  assert.equal(safeZipEntryName('directory/'), null);
});
