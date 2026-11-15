import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const card = readFileSync(new URL('../src/components/article/WechatArticleCard.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');
const button = readFileSync(new URL('../src/components/article/DeepAnalysisButton.tsx', import.meta.url), 'utf8');
const taskHook = readFileSync(new URL('../src/hooks/useDeepAnalysisTask.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('文章卡片在现有页脚展示深度报告状态', () => {
  assert.match(card, /article\.deepAnalysis/);
  assert.match(card, /article-deep-state/);
  assert.match(card, /深度解析中|深度报告|解析失败/);
});

test('文章详情底部展示深度报告入口', () => {
  assert.match(detail, /<DeepAnalysisButton/);
  assert.match(detail, /detail-panel-footer-actions/);
  assert.match(button, /if \(!hasReport\) return null/);
  assert.match(button, /is-active/);
  assert.match(detail, /useDeepAnalysisTask/);
  assert.match(detail, /hasReport=\{deepAnalysisSucceeded\}/);
  assert.doesNotMatch(detail, /<DeepAnalysisPanel/);
});

test('详情菜单覆盖生成、生成中、失败和重新生成四种状态', () => {
  assert.match(detail, /生成深度解析报告/);
  assert.match(detail, /深度解析报告生成中/);
  assert.match(detail, /深度解析报告生成失败/);
  assert.match(detail, /重新生成深度解析报告/);
  assert.match(detail, /disabled=\{deepAnalysisBusy\}/);
  assert.match(detail, /deepAnalysisTask\.generate\(\)/);
});

test('深度报告状态按文章隔离，切换文章不会沿用上一篇状态', () => {
  assert.match(taskHook, /articleId: number \| null/);
  assert.match(taskHook, /state\.articleId === articleId/);
  assert.match(taskHook, /current\.articleId === articleId/);
});

test('列表状态样式使用状态色变量', () => {
  assert.match(css, /\.article-deep-state\.is-running/);
  assert.match(css, /\.article-deep-state\.is-failed/);
});
