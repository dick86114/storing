import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin article library gives the article list primary space and moves owner selection into filters', () => {
  const library = read('src/components/content/AdminLibraryContent.tsx');
  const styles = read('src/app/globals.css');

  assert.doesNotMatch(library, /className="admin-library-users"/);
  assert.match(library, /aria-label="按收录时间筛选"/);
  assert.match(library, /className="admin-library-panel admin-library-primary"/);
  assert.match(styles, /\.admin-library-content-grid \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);/);
});

test('a user card opens that user\'s article library with a targeted query parameter', () => {
  const content = read('src/components/content/UserManagementContent.tsx');

  assert.match(content, /useRouter/);
  assert.match(content, /openUserLibrary\(item\.id\)/);
  assert.match(content, /onKeyDown=\{\(event\) => \{/);
});
