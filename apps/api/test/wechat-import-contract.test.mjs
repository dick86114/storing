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
  assert.match(service, /generateSummaryAndTags\(articleId, options\.userId\)/);
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
  assert.match(service, /entry\.uncompressedSize > MAX_SINGLE_FILE_BYTES/);
  assert.match(service, /total > MAX_TOTAL_BYTES/);
});

test('WeChat transcript parser and markdown renderer preserve the exported format', () => {
  const service = read('src/services/wechat-import.service.ts');
  const transcript = read('src/services/wechat-transcript.ts');

  assert.match(service, /from '\.\/wechat-transcript\.js'/);
  assert.match(transcript, /export function parseWeChatTranscript/);
  assert.match(transcript, /export function renderWeChatTranscriptMarkdown/);
  assert.match(transcript, /### 媒体附件/);
  assert.match(transcript, /未能上传到图床/);
});
