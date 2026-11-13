import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const card = readFileSync(new URL('../src/components/article/WechatArticleCard.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('文章卡片在现有页脚展示深度报告状态', () => {
  assert.match(card, /article\.deepAnalysis/);
  assert.match(card, /article-deep-state/);
  assert.match(card, /深度解析中|深度报告|解析失败/);
});

test('详情层摘要下方包含入口卡和二级抽屉', () => {
  assert.match(detail, /<DeepAnalysisPanel/);
  assert.match(detail, /articleTitle=\{article\.title\}/);
  assert.match(detail, /summaryCollapsed/);
});

test('列表状态样式使用状态色变量', () => {
  assert.match(css, /\.article-deep-state\.is-running/);
  assert.match(css, /\.article-deep-state\.is-failed/);
});
