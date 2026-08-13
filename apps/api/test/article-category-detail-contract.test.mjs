import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articlesRoute = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');

test('文章详情返回分类结果，供客户端展示 AI 理由和确认状态', () => {
  assert.match(articlesRoute, /function serializeArticleRecord[\s\S]*?categoryResult:/);
  assert.match(articlesRoute, /reason: article\.categoryReason/);
  assert.match(articlesRoute, /reviewStatus: article\.categoryReviewStatus \?\? 'pending'/);
});
