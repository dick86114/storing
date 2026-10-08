import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWeChatTranscript,
  parseWeChatIndividualTranscript,
  renderWeChatTranscriptMarkdown,
  renderWeChatTranscriptHtml,
  renderWeChatPlainTextHtml,
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
  '[图片] photo.jpg',
  '看这个视频',
].join('\r\n');

const mediaMap = new Map([
  ['photo.jpg', { url: 'https://img.example/p/photo.jpg', kind: 'image' }],
  ['video.mp4', { url: 'https://img.example/p/video.mp4', kind: 'video' }],
  ['voice.silk', { url: null, kind: 'audio' }],
]);

test('parses the native WeChat transcript format including BOM and CRLF', () => {
  const records = parseWeChatTranscript(sample);

  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => record.sender),
    ['张三', '李四'],
  );
  assert.equal(records[0].text, '第一条消息\n正文第二行');
  assert.equal(records[1].text, '[图片] photo.jpg\n看这个视频');
});

test('markdown keeps the WeChat timeline order with inline media', () => {
  const records = parseWeChatTranscript(sample);
  const markdown = renderWeChatTranscriptMarkdown({ records, mediaMap });

  // 微信排版：标题 + 日期头部，发送人 + 右侧时间。
  assert.match(markdown, /^# 聊天记录\n2026年1月2日\n/);
  assert.match(markdown, /\*\*张三\*\* · 09:05/);
  assert.match(markdown, /\*\*李四\*\* · 09:06/);

  // 图片内联在引用它的那条消息里，时间线顺序保持。
  const liSiBlock = markdown.slice(markdown.indexOf('**李四**'));
  assert.match(liSiBlock, /!\[photo\.jpg\]\(https:\/\/img\.example\/p\/photo\.jpg\)/);
  assert.match(liSiBlock, /看这个视频/);
  assert.ok(liSiBlock.indexOf('![photo.jpg]') < liSiBlock.indexOf('看这个视频'));

  // 未被消息引用的媒体进「其他附件」。
  assert.match(markdown, /### 其他附件/);
  assert.match(markdown, /voice\.silk（未能上传到图床）/);
  assert.match(markdown, /---/);
});

test('html mirrors the WeChat record layout with inline media', () => {
  const records = parseWeChatTranscript(sample);
  const html = renderWeChatTranscriptHtml({ records, mediaMap });

  assert.match(html, /<div class="wechat-chat">/);
  assert.match(html, /<p class="wechat-chat-title">聊天记录<\/p>/);
  assert.match(html, /<span class="wechat-msg-sender">张三<\/span><span class="wechat-msg-time">09:05<\/span>/);
  assert.match(html, /<p>第一条消息<\/p><p>正文第二行<\/p>/);

  const liSiBlock = html.slice(html.indexOf('>李四<'));
  assert.match(liSiBlock, /<img src="https:\/\/img\.example\/p\/photo\.jpg"/);
  assert.match(liSiBlock, /<p>看这个视频<\/p>/);
  assert.ok(liSiBlock.indexOf('<img') < liSiBlock.indexOf('看这个视频'));
  assert.match(html, /<h3>其他附件<\/h3>/);
  assert.doesNotMatch(html, /<script/);
});

test('unmatched media placeholders degrade to plain text', () => {
  const records = parseWeChatTranscript('·张三\n2026年1月2日 09:05\n[图片] missing.jpg');
  const markdown = renderWeChatTranscriptMarkdown({ records, mediaMap });
  const html = renderWeChatTranscriptHtml({ records, mediaMap });
  assert.match(markdown, /> 图片（未随聊天记录导出）/);
  assert.match(html, /（图片未随聊天记录导出）/);
});

test('individual forwarded WeChat messages render as an ordered local transcript', () => {
  const transcript = [
    '·[图片] photo.jpg',
    '',
    '·看这条消息',
    '',
    '·第二段消息',
    '还有第二行',
  ].join('\n');
  const records = parseWeChatIndividualTranscript(transcript);

  assert.equal(records.length, 3);
  assert.equal(records[0].text, '[图片] photo.jpg');
  assert.equal(records[1].text, '看这条消息');
  assert.equal(records[2].text, '第二段消息\n还有第二行');
  assert.equal(records.every((record) => record.date === null), true);

  const markdown = renderWeChatTranscriptMarkdown({ records, mediaMap });
  const html = renderWeChatTranscriptHtml({ records, mediaMap });

  assert.match(markdown, /!\[photo\.jpg\]\(https:\/\/img\.example\/p\/photo\.jpg\)/);
  assert.match(markdown, /\*\*消息 2\*\*/);
  assert.match(html, /<img src="https:\/\/img\.example\/p\/photo\.jpg"/);
  assert.match(html, /<span class="wechat-msg-sender">消息 2<\/span>/);
  assert.match(html, /<p>第二段消息<\/p><p>还有第二行<\/p>/);
});

test('plain shared text renders as a readable article', () => {
  const html = renderWeChatPlainTextHtml('第一段文字\n第二行\n\n第二段落');

  assert.match(html, /wechat-plain-text/);
  assert.match(html, /<p>第一段文字<br>第二行<\/p>/);
  assert.match(html, /<p>第二段落<\/p>/);
  assert.doesNotMatch(html, /<script/);
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
