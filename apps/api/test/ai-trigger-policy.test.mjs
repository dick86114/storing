import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const webRoot = new URL('../../web/', import.meta.url);
const read = (base, path) => readFileSync(new URL(path, base), 'utf8');

test('所有保存型采集不得触发 AI 摘要、标签或分类', () => {
  const collect = read(apiRoot, 'src/services/collect.service.ts');

  assert.doesNotMatch(collect, /generateSummaryAndTags\s*\(/);
  assert.doesNotMatch(collect, /classifyStoredArticleForArchive\s*\(/);
  assert.doesNotMatch(collect, /markArchived:\s*(?:true|options\.markArchived|options\.sourceType)/);
  assert.match(collect, /markArchived:\s*false/g);
});

test('微信转发导入不得触发 AI', () => {
  const service = read(apiRoot, 'src/services/wechat-import.service.ts');

  assert.doesNotMatch(service, /generateSummaryAndTags\s*\(/);
});

test('发布不依赖也不触发 AI', () => {
  const routes = read(apiRoot, 'src/routes/articles.ts');
  const publish = routes.slice(
    routes.indexOf("articlesRoutes.post('/articles/:id/publish'"),
    routes.indexOf("articlesRoutes.post('/articles/:id/unpublish'"),
  );

  assert.ok(publish.length > 0);
  assert.doesNotMatch(publish, /PUBLICATION_NOT_READY/);
  assert.doesNotMatch(publish, /classifyStoredArticleForArchive\s*\(/);
  assert.doesNotMatch(publish, /readyMetadata\s*\?\.\s*aiSummary/);
  assert.doesNotMatch(publish, /readyMetadata\s*\?\.\s*aiTags/);
  assert.match(publish, /BODY_NOT_READY/);
  assert.match(publish, /PUBLIC_ID_FAILED/);
  assert.doesNotMatch(publish, /generateSummaryAndTags\s*\(/);
  assert.doesNotMatch(publish, /readyMetadata\s*\?\.\s*aiSummary/);
  assert.doesNotMatch(publish, /readyMetadata\s*\?\.\s*aiTags/);
});

test('Web 采集完成后打开收件箱', () => {
  const content = read(webRoot, 'src/components/content/CollectContent.tsx');
  const completion = content.slice(
    content.indexOf('const handleOpenArticle'),
    content.indexOf('const handleCopyUrl'),
  );

  assert.match(completion, /router\.push\('\/inbox'\)/);
  assert.doesNotMatch(completion, /router\.push\('\/archive'\)/);
});
