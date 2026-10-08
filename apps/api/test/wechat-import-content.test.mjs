import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('short locally imported WeChat transcripts do not use the web-fetch quality threshold', () => {
  const reader = read('src/services/reader.service.ts');

  assert.match(reader, /function isInternalWeChatImport\(/);
  assert.match(reader, /startsWith\('qiankunjie:\/\/wechat-import\/'\)/);
  assert.match(reader, /originalUrl: articles\.originalUrl/);
  assert.match(reader, /const trustStoredContent = isInternalWeChatImport\(meta\?\.originalUrl\)/);
  assert.match(reader, /if \(trustStoredContent\) \{\s*const importedHtml = await buildWeChatHtmlFromCache\(articleId, meta\?\.contentMd\);/);
  assert.match(reader, /saveArticleContentCache\(articleId, 'html', importedHtml, htmlVariant, userId\)/);
  assert.match(reader, /if \(cachedHtml && \(trustStoredContent || hasUsefulContent\(cachedHtml, format\)\)\)/);
  assert.match(reader, /if \(meta\?\.contentMd && \(trustStoredContent || hasUsefulContent\(meta\.contentMd, format\)\)\)/);
});

test('individual forwarded WeChat transcripts are rendered through the transcript pipeline', () => {
  const service = read('src/services/wechat-import.service.ts');

  assert.match(service, /parseWeChatIndividualTranscript\(transcriptText\)/);
  assert.match(service, /const standardRecords = transcriptText \? parseWeChatTranscript\(transcriptText\) : \[\]/);
  assert.match(service, /\? parseWeChatIndividualTranscript\(transcriptText\)/);
});
