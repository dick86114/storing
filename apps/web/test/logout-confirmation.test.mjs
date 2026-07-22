import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

const dialogPath = new URL('src/components/auth/LogoutConfirmDialog.tsx', webRoot);

test('desktop and mobile logout actions require the shared themed confirmation dialog', () => {
  assert.equal(existsSync(dialogPath), true, 'shared logout confirmation dialog should exist');

  const dialog = read('src/components/auth/LogoutConfirmDialog.tsx');
  const desktop = read('src/components/layout/DesktopTopNav.tsx');
  const mobile = read('src/components/layout/MobileTopNav.tsx');

  assert.match(dialog, /className="confirm-dialog-overlay"/);
  assert.match(dialog, /className="confirm-dialog-panel"/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /确认退出登录？/);
  assert.match(dialog, /正在退出…/);
  assert.match(dialog, /event\.key === 'Escape'/);

  for (const navigation of [desktop, mobile]) {
    assert.match(navigation, /LogoutConfirmDialog/);
    assert.match(navigation, /setLogoutConfirmOpen\(true\)/);
    assert.match(navigation, /await logout\(\)/);
    assert.match(navigation, /<LogoutConfirmDialog/);
  }
});
