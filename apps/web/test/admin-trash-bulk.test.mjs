import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('admin trash exposes independent bulk clear actions for both sections', () => {
  const api = read('src/lib/api.ts');
  const content = read('src/components/content/AdminTrashContent.tsx');

  assert.match(api, /AdminTrashBulkFailure/);
  assert.match(api, /AdminTrashBulkResult/);
  assert.match(api, /purgeAdminTrash: \(\) =>/);
  assert.match(api, /fetchJSON<AdminTrashBulkResult>\('\/admin\/trash', \{ method: 'DELETE' \}\)/);
  assert.match(api, /purgeAdminTrashOrphans: \(\) =>/);
  assert.match(api, /fetchJSON<AdminTrashBulkResult>\('\/admin\/trash\/orphans', \{ method: 'DELETE' \}\)/);

  assert.match(content, /bulkPurgeSection/);
  assert.match(content, /bulkPurgeResult/);
  assert.match(content, /确认清空已删除文章/);
  assert.match(content, /确认清空孤儿文章/);
  assert.match(content, /purgeAdminTrash\(\)/);
  assert.match(content, /purgeAdminTrashOrphans\(\)/);
});

test('admin trash bulk result reports successful and failed items with reasons', () => {
  const content = read('src/components/content/AdminTrashContent.tsx');
  const styles = read('src/app/globals.css');

  assert.match(content, /清空结果/);
  assert.match(content, /成功清理/);
  assert.match(content, /失败/);
  assert.match(content, /物理删除全局文章/);
  assert.match(content, /failure\.reason/);
  assert.match(content, /failure\.title \?\? `#\$\{failure\.article_id\}`/);
  assert.match(styles, /\.admin-trash-result-list \{/);
});
