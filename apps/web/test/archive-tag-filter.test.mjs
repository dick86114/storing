import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const archiveContent = readFileSync(new URL('../src/components/content/ArchiveContent.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('归档标签作为独立的多选辅助筛选', () => {
  assert.match(apiClient, /getTags:/);
  assert.match(apiClient, /params\.append\('tag', tag\)/);
  assert.match(archiveContent, /activeTags/);
  assert.match(archiveContent, /api\.getTags/);
  assert.match(archiveContent, /标签筛选/);
});
