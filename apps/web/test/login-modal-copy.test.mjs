import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modal = readFileSync(new URL('../src/components/auth/LoginModal.tsx', import.meta.url), 'utf8');

test('login modal uses role-neutral copy and instructional placeholders', () => {
  assert.match(modal, />\s*登录\s*<\/h2>/);
  assert.doesNotMatch(modal, /管理员登录/);
  assert.match(modal, /placeholder="请输入用户名"/);
  assert.doesNotMatch(modal, /placeholder="admin"/);
});
