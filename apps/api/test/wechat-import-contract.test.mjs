import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('WeChat import route is registered and keeps parsing, uploads and persistence on the server', () => {
  const index = read('src/index.ts');
  const route = read('src/routes/wechat.ts');
  const service = read('src/services/wechat-import.service.ts');

  assert.match(index, /import \{ wechatRoutes \} from '\.\/routes\/wechat\.js'/);
  assert.match(index, /app\.route\('\/api\/v1', wechatRoutes\)/);
  assert.match(route, /wechatRoutes\.post\('\/wechat\/import', requireAuth/);
  assert.match(route, /c\.req\.parseBody\(\{ all: true \}\)/);
  assert.match(service, /qiankunjie:\/\/wechat-import\//);
  assert.match(service, /IMG_API_KEY/);
  assert.doesNotMatch(service, /generateSummaryAndTags\(|buildArticleSummaryResult\(|generateCombinedArticleAi\(/);
});

test('WeChat bulk import has a durable async queue and status endpoint', () => {
  const route = read('src/routes/wechat.ts');
  const queue = read('src/services/wechat-import-queue.service.ts');
  const index = read('src/index.ts');
  const compose = read('../../docker-compose.yml');

  assert.match(route, /wechatRoutes\.post\('\/wechat\/import\/jobs', requireAuth/);
  assert.match(route, /scheduleWeChatImportJobs\(\)/);
  assert.match(route, /return c\.json\(\{ job: serializeWeChatImportJob\(job\) \}, 202\)/);
  assert.match(route, /wechatRoutes\.get\('\/wechat\/import\/jobs\/:jobId', requireAuth/);
  assert.match(queue, /CREATE TABLE IF NOT EXISTS wechat_import_jobs/);
  assert.match(queue, /export async function resumeWeChatImportJobs/);
  assert.match(queue, /MAX_CONCURRENT_IMPORTS/);
  assert.match(index, /ensureWeChatImportQueueSchema/);
  assert.match(index, /resumeWeChatImportJobs/);
  assert.match(compose, /\.\/data:\/app\/data/);
});

test('WeChat import persists html body so the reader never needs to fetch an internal url', () => {
  const service = read('src/services/wechat-import.service.ts');
  const reader = read('src/services/reader.service.ts');

  assert.match(service, /const mediaMap: WeChatMediaMap = new Map/);
  assert.match(service, /renderWeChatTranscriptHtml\(\{ records, mediaMap \}\)/);
  assert.match(service, /contentHtml: html/);

  // 存量文章缺 HTML 缓存时从 Markdown 现场生成，而不是去抓取 qiankunjie:// 内部地址。
  assert.match(reader, /buildWeChatContentFromCache\(articleId\)/);
  assert.match(reader, /buildWeChatContentFromSnapshot\(\{/);
  assert.match(reader, /content\?\.type !== 'wechat_chat'/);
  assert.match(reader, /transcript: content\.transcript/);
});

test('WeChat import validates ZIP entry names and enforces size limits', () => {
  const service = read('src/services/wechat-import.service.ts');
  const transcript = read('src/services/wechat-transcript.ts');

  assert.match(service, /safeZipEntryName/);
  assert.match(transcript, /export function safeZipEntryName/);
  assert.match(transcript, /rawName\.includes\('\\\\'\)/);
  assert.match(transcript, /part === '\.\.'/);
  assert.match(service, /MAX_SINGLE_FILE_BYTES = 100 \* 1024 \* 1024/);
  assert.match(service, /MAX_TOTAL_BYTES = 300 \* 1024 \* 1024/);
  assert.match(service, /entry\.uncompressedSize > WECHAT_IMPORT_MAX_SINGLE_FILE_BYTES/);
  assert.match(service, /total > WECHAT_IMPORT_MAX_TOTAL_BYTES/);
});

test('WeChat transcript parser and markdown renderer preserve the exported format', () => {
  const service = read('src/services/wechat-import.service.ts');
  const transcript = read('src/services/wechat-transcript.ts');

  assert.match(service, /from '\.\/wechat-transcript\.js'/);
  assert.match(transcript, /export function parseWeChatTranscript/);
  assert.match(transcript, /export function renderWeChatTranscriptMarkdown/);
  assert.match(transcript, /export function renderWeChatTranscriptHtml/);
  assert.match(transcript, /matchMediaPlaceholder/);
  assert.match(transcript, /未能上传到图床/);
});
