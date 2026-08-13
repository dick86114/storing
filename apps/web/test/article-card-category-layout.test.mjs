import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const card = readFileSync(new URL('../src/components/article/WechatArticleCard.tsx', import.meta.url), 'utf8');

test('归档分类作为标题下的独立元信息，而不是混入 AI 标签', () => {
  assert.match(card, /article-card-category-line/);
  assert.match(card, /article-card-category-dot/);
  assert.match(card, /article-card-category-label/);
  assert.match(card, /\{tags\.length > 0 && \(/);
  assert.doesNotMatch(card, /article-card-tags[\s\S]*?article\.category/);
});
