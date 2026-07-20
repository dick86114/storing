import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const collectService = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');

function getWechatJobImplementation() {
  const match = collectService.match(/async function processWechatJob[\s\S]*?\n}\n\ntype PreparedCapture/);
  assert.ok(match, 'processWechatJob implementation should be present');
  return match[0];
}

test('WeChat collection refuses to complete when every body fetch fallback is empty', () => {
  const processWechat = getWechatJobImplementation();

  assert.match(processWechat, /const contentResults = await Promise\.allSettled\(/);
  assert.match(processWechat, /result\.status === 'fulfilled'\s*&&\s*typeof result\.value === 'string'\s*&&\s*result\.value\.trim\(\)\.length > 0/);
  assert.match(processWechat, /throw new Error\('微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文'/);

  const guardIndex = processWechat.indexOf('微信公众号正文抓取失败');
  const completedIndex = processWechat.indexOf("status: 'completed'");
  assert.ok(guardIndex >= 0 && completedIndex > guardIndex, 'the job must be guarded before it can be marked completed');
});
