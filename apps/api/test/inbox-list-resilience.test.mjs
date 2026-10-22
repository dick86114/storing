import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articleRoutes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');
const readerService = readFileSync(new URL('../src/services/reader.service.ts', import.meta.url), 'utf8');

function getArticleListRoute() {
  const match = articleRoutes.match(/articlesRoutes\.get\('\/articles', optionalAuth[\s\S]*?\n\s*return c\.json\(\{[\s\S]*?\n\s*\}\);\n\}\);/);
  assert.ok(match, 'GET /articles implementation should be present');
  return match[0];
}

test('收件箱列表响应不等待远程封面回填', () => {
  const route = getArticleListRoute();

  assert.doesNotMatch(
    route,
    /await backfillOutdatedCoverImages\(/,
    '单篇文章封面抓取失败不能阻塞整页收件箱',
  );
  assert.match(
    route,
    /scheduleOutdatedCoverImageBackfill\(data,\s*userId\)/,
    '旧封面应在后台串行回填，列表先返回当前已缓存数据',
  );
  assert.match(route, /Math\.min\(100, Math\.max\(1, requestedPerPage\)\)/, '列表分页上限必须限制后台回填规模');
});

test('后台封面回填统一进入有界队列', () => {
  assert.match(articleRoutes, /import \{ coverImageBackfillQueue \} from '\.\.\/services\/cover-image-backfill\.service\.js'/);
  assert.match(
    articleRoutes,
    /coverImageBackfillQueue\.enqueue\(candidates\.map\(\(row\) => \(\{ articleId: row\.id, userId \}\)\)\)/,
    '列表只能把缺失封面交给统一后台队列，不能自行创建无界任务',
  );
  assert.match(
    articleRoutes,
    /\(article\.metadataCoverVersion \?\? 0\) < COVER_IMAGE_PROCESSING_VERSION[\s\S]*coverImageBackfillQueue\.enqueue/,
    '详情页也必须根据处理版本判断是否重试，不能仅因没有封面就重复抓取',
  );
});

test('没有可用封面的文章也会记录处理版本，避免每次列表重复抓取', () => {
  assert.match(
    readerService,
    /if \(!coverImageUrl\)[\s\S]{0,700}coverVersion:\s*COVER_IMAGE_PROCESSING_VERSION/,
    '无封面也是有效处理结果，应持久化版本避免无限重试',
  );
});

test('临时抓取或上传失败使用冷却时间重试，而不是永久推进封面版本', () => {
  assert.match(readerService, /const COVER_IMAGE_RETRY_DELAY_MS = 15 \* 60 \* 1000;/);
  assert.match(readerService, /coverImageRetryAt\.get\(retryKey\)/);
  assert.match(readerService, /cachedHtml: articleMetadata\.contentHtml/);
  assert.match(readerService, /cachedMarkdown: articleMetadata\.contentMd/);
  assert.match(readerService, /article\.cachedHtml && hasUsefulContent\(article\.cachedHtml, 'html'\)/);
  assert.match(readerService, /if \(wechatLookupFailed \|\| !contentResolved\)/);
  assert.match(
    readerService,
    /if \(!uploadedUrl\)[\s\S]{0,260}coverImageRetryAt\.set\(retryKey,[\s\S]{0,160}throw new Error\('封面图上传失败，稍后再试'\)/,
  );
});
