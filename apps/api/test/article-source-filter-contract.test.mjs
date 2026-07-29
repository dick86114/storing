import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('article routes accept repeated archive category filters with compatible OR semantics', async () => {
  const source = await readFile(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');
  assert.match(source, /c\.req\.queries\('category'\)/);
  assert.match(source, /inArray\(articles\.source, categoryFilters\)/);
  assert.match(source, /eq\(articles\.source, categoryFilters\[0\]\)/);
  assert.match(source, /categoryFilters\.length === 0/);
  assert.equal((source.match(/applyArchiveCategoryFilter\(whereCondition, view, categoryFilters\)/g) ?? []).length, 2);
});
