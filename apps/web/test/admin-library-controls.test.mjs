import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readApi = (path) => readFileSync(new URL(`../../api/${path}`, import.meta.url), 'utf8');

test('admin library replaces the owner picker with a collected-time filter', () => {
  const library = read('src/components/content/AdminLibraryContent.tsx');
  const api = read('src/lib/api.ts');
  const routes = readApi('src/routes/auth.ts');

  assert.doesNotMatch(library, /admin-library-owner-filter/);
  assert.match(library, /收录时间/);
  assert.match(library, /timeRange/);
  assert.match(api, /collectedSince/);
  assert.match(routes, /collected_since/);
});

test('ambiguous source types are rendered as readable provenance labels', () => {
  const library = read('src/components/content/AdminLibraryContent.tsx');

  assert.match(library, /function sourceTypeInfo/);
  assert.match(library, /legacy: \{ label: '历史导入'/);
  assert.match(library, /'admin-copy': \{ label: '管理员副本'/);
});

test('AI rebuild and deletion require a themed confirmation dialog explaining their effect', () => {
  const library = read('src/components/content/AdminLibraryContent.tsx');
  const styles = read('src/app/globals.css');

  assert.match(library, /pendingConfirmation/);
  assert.match(library, /重新生成 AI 摘要、分类和标签/);
  assert.match(library, /不会重新抓取原文/);
  assert.match(library, /admin-library-confirm-modal/);
  assert.match(library, /确认删除该用户记录/);
  assert.match(styles, /\.admin-library-confirm-modal \{/);
  assert.match(styles, /\.admin-library-modal-overlay \{/);
});
