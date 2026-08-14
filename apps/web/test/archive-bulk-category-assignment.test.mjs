import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const archiveContent = readFileSync(new URL('../src/components/content/ArchiveContent.tsx', import.meta.url), 'utf8');
const articleList = readFileSync(new URL('../src/components/article/ArticleList.tsx', import.meta.url), 'utf8');
const articleCard = readFileSync(new URL('../src/components/article/WechatArticleCard.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('归档支持勾选多篇文章后批量修改分类', () => {
  assert.match(apiClient, /bulkMoveArticlesToCategory/);
  assert.match(apiClient, /bulkClassifyArticles/);
  assert.match(archiveContent, /批量整理/);
  assert.match(archiveContent, /api\.bulkMoveArticlesToCategory/);
  assert.match(archiveContent, /api\.bulkClassifyArticles/);
  assert.match(archiveContent, /api\.createCategory/);
  assert.match(archiveContent, /onCreateCategory/);
  assert.match(articleList, /selectedArticleIds/);
  assert.match(articleCard, /aria-label="选择文章"/);
});
