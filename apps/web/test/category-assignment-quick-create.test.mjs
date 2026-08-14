import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const dialog = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../src/components/content/InboxContent.tsx', import.meta.url), 'utf8');

test('分类选择弹窗支持输入名称后创建并自动选择新分类', () => {
  assert.match(dialog, /新增分类/);
  assert.match(dialog, /创建并选择/);
  assert.match(dialog, /onCreateCategory\(quickCreateName\.trim\(\)\)/);
  assert.match(dialog, /onSelect\(created\.category\.id\)/);
});

test('收件箱归档复用支持新增分类的选择弹窗', () => {
  assert.match(inbox, /CategoryAssignmentDialog/);
  assert.match(inbox, /onSelectAi/);
  assert.match(inbox, /onCreateCategory/);
});
