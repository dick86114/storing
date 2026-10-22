import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const collectService = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');
const captureService = readFileSync(new URL('../src/services/wechat-collect-capture.service.ts', import.meta.url), 'utf8');

function getWechatJobImplementation() {
  const match = collectService.match(/async function processWechatJob[\s\S]*?\n}\n\ntype PreparedCapture/);
  assert.ok(match, 'processWechatJob implementation should be present');
  return match[0];
}

test('WeChat collection refuses to complete when every body fetch fallback is empty', () => {
  const processWechat = getWechatJobImplementation();

  assert.match(captureService, /const contentHtml = await dependencies\.fetchContent\(article, 'html', 'desktop'\)/);
  assert.match(captureService, /const contentMarkdown = await dependencies\.fetchContent\(article, 'markdown', 'desktop'\)/);
  assert.match(captureService, /throw new Error\('微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文'/);

  const captureIndex = processWechat.indexOf('captureWechatArticleInMemory');
  const persistIndex = processWechat.indexOf('upsertArticleFromCapture');
  assert.ok(captureIndex >= 0 && persistIndex > captureIndex, '内存正文校验必须发生在持久化之前');
});
