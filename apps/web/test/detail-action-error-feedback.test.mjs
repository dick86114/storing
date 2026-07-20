import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const detailPanel = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');

function getRunArticleAction() {
  const match = detailPanel.match(/async function runArticleAction\([\s\S]*?\n  }\n\n  async function handleRefetchContent/);
  assert.ok(match, 'runArticleAction implementation should be present');
  return match[0];
}

test('detail actions show expected API failures without logging them as console errors', () => {
  const action = getRunArticleAction();

  assert.match(action, /const message = error instanceof Error && error\.message \? error\.message : failureMessage;/);
  assert.match(action, /showToast\(message\);/);
  assert.doesNotMatch(action, /console\.error\(error\);/);
});
