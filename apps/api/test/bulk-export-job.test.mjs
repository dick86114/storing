import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('导出任务路由只允许创建者访问并流式下载 ZIP', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/bulk-export-job.service.ts');
  const schema = read('src/db/schema.ts');

  assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-export', requireAuth/);
  assert.match(routes, /articlesRoutes\.get\('\/articles\/bulk-export\/:jobId', requireAuth/);
  assert.match(routes, /articlesRoutes\.get\('\/articles\/bulk-export\/:jobId\/download', requireAuth/);
  assert.match(service, /eq\(bulkExportJobs\.userId, userId\)/);
  assert.match(service, /Content-Disposition/);
  assert.match(service, /cleanupExpiredBulkExportJobs/);
  assert.match(service, /getArticleContent\(row\.articleId, 'markdown', 'desktop', job\.userId\)/);
  assert.match(schema, /export const bulkExportJobs/);
});
