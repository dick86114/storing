import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const detailPanel = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');

test('文章详情提供分类选择并在保存后刷新归档数据', () => {
  assert.match(detailPanel, /修改分类/);
  assert.match(detailPanel, /api\.getCategories\(\)/);
  assert.match(detailPanel, /api\.moveArticleToCategory\(article\.id, categoryId\)/);
  assert.match(detailPanel, /detailMutate\('categories'\)/);
  assert.match(detailPanel, /detailMutate\('categories:archive-action'\)/);
  assert.match(detailPanel, /categoryResult\?\.reviewStatus === 'needs_review'/);
  assert.match(detailPanel, /categoryResult\.reason/);
  assert.match(detailPanel, /重新判断分类/);
  assert.match(detailPanel, /api\.classifyArticle\(article\.id\)/);
});

test('详情页将当前分类和 AI 待确认状态放在同一条分类状态行', () => {
  assert.match(detailPanel, /detail-panel-category-status/);
  assert.match(detailPanel, /detail-panel-category-current/);
  assert.match(detailPanel, /detail-panel-category-review/);
  assert.match(detailPanel, /AI 分类待确认/);
});

test('详情页将 AI 标签和智能摘要收进连续的信息区，避免叠加留白', () => {
  assert.match(detailPanel, /detail-panel-intelligence/);
  assert.match(detailPanel, /className="detail-panel-tags"/);
  assert.match(detailPanel, /className={`ai-summary-block/);
});
