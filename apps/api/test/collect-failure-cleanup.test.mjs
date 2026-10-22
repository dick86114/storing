import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const collectService = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');
const wechatCaptureService = readFileSync(new URL('../src/services/wechat-collect-capture.service.ts', import.meta.url), 'utf8');

function getWechatJobImplementation() {
  const match = collectService.match(/async function processWechatJob[\s\S]*?\n}\n\ntype PreparedCapture/);
  assert.ok(match, 'processWechatJob implementation should be present');
  return match[0];
}

test('微信公众号正文校验失败时不会写入共享文章或收件箱元数据', () => {
  const processWechat = getWechatJobImplementation();

  assert.match(
    wechatCaptureService,
    /dependencies\.fetchContent\(article, 'html', 'desktop'\)[\s\S]*?微信公众号正文抓取失败/,
    '正文必须在内存中完成抓取和有效性校验',
  );

  const captureIndex = processWechat.indexOf('captureWechatArticleInMemory');
  const persistIndex = processWechat.indexOf('upsertArticleFromCapture');
  assert.ok(captureIndex >= 0, '微信内存抓取服务应存在');
  assert.ok(
    persistIndex > captureIndex,
    '文章和元数据只能在正文校验通过后持久化',
  );
  assert.doesNotMatch(processWechat.slice(0, persistIndex), /db\s*\.\s*(?:insert|update)\(articles\)/);
});

test('正文通过后使用单个短事务原子写入文章与当前用户元数据', () => {
  assert.match(
    collectService,
    /upsertArticleFromCaptureInTransaction[\s\S]*pg_advisory_xact_lock\(hashtext\('storing:collect-url'\), hashtext\(\$\{input\.normalizedUrl\}\)\)[\s\S]*insert\(articles\)[\s\S]*insert\(articleMetadata\)/,
    '文章、元数据和同 URL 串行锁必须位于同一短事务内',
  );
  assert.match(collectService, /db\.transaction\(\(tx\) => upsertArticleFromCaptureInTransaction/);
  assert.match(collectService, /coverVersion: 0,/, '新采集必须重置封面版本以触发统一后台处理');
  assert.match(collectService, /coverImageBackfillQueue\.enqueue\(\[\{ articleId, userId: options\.userId \}\]\)/);
});

test('网络采集阶段不长期占用数据库连接或 session 咨询锁', () => {
  assert.doesNotMatch(collectService, /pg_advisory_lock\(hashtext\(\$1\), hashtext\(\$2\)\)/);
  assert.doesNotMatch(collectService, /pool\.connect\(/);
});
