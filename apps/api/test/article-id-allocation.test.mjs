import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../src/services/${path}`, import.meta.url), 'utf8');

test('普通采集与微信分享导入共用同一篇文章 ID 事务分配器', () => {
  const allocator = read('article-id.service.ts');
  const collect = read('collect.service.ts');
  const wechatImport = read('wechat-import.service.ts');

  assert.match(allocator, /pg_advisory_xact_lock\(hashtext\('storing:article-id'\)\)/);
  assert.match(collect, /allocateArticleIdInTransaction\(tx\)/);
  assert.match(wechatImport, /allocateArticleIdInTransaction\(tx\)/);
  assert.doesNotMatch(wechatImport, /COALESCE\(MAX\(\$\{articles\.id\}\), 0\) \+ 1/);
});
