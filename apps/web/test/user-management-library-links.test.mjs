import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('user management removes the redundant library header link and opens the selected library view from usage metrics', () => {
  const users = read('src/components/content/UserManagementContent.tsx');
  const library = read('src/components/content/AdminLibraryContent.tsx');

  assert.doesNotMatch(users, /<Link href="\/admin\/library"/);
  assert.match(users, /function openUserLibrary\(userId: number, view: 'inbox' \| 'favorites' \| 'archive' = 'inbox'\)/);
  assert.match(users, /openUserLibrary\(item\.id, 'archive'\)/);
  assert.match(users, /openUserLibrary\(item\.id, 'favorites'\)/);
  assert.match(library, /get\('view'\)/);
  assert.match(library, /setView\(requestedView\)/);
});

test('user role labels are colored pills that distinguish admin, user, and service identities', () => {
  const users = read('src/components/content/UserManagementContent.tsx');
  const styles = read('src/app/globals.css');

  assert.match(users, /user-admin-role-pill--\$\{item\.role\}/);
  assert.match(styles, /\.user-admin-role-pill--admin/);
  assert.match(styles, /\.user-admin-role-pill--user/);
  assert.match(styles, /\.user-admin-role-pill--service/);
});
