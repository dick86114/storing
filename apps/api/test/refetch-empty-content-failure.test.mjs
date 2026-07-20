import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articleRoutes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');

function getRefetchRoute() {
  const match = articleRoutes.match(/articlesRoutes\.post\('\/articles\/:id\/refetch'[\s\S]*?\n}\);\n\n\/\*\*\n \* POST \/articles\/:id\/regenerate-ai/);
  assert.ok(match, 'refetch route should be present');
  return match[0];
}

test('refetch returns an error instead of reporting success when no useful body was captured', () => {
  const route = getRefetchRoute();

  assert.match(route, /const hasCapturedContent = Boolean\(contentHtml \|\| contentHtmlMobile \|\| contentMd\);/);
  assert.match(route, /code: 'BODY_CAPTURE_FAILED',[\s\S]*message: '正文抓取失败：所有可用抓取方式均未返回有效正文'/);

  const guardIndex = route.indexOf('正文抓取失败：所有可用抓取方式均未返回有效正文');
  const successResponseIndex = route.lastIndexOf('return c.json({');
  assert.ok(guardIndex >= 0 && successResponseIndex > guardIndex, 'the failure guard must precede the successful response');
});
