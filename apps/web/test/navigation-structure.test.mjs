import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readWeb = (path) => readFileSync(new URL(path, webRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('navigation model separates primary pages, secondary pages, and collect action', () => {
  const navigation = readWeb('src/lib/navigation.ts');
  assert.match(navigation, /PRIMARY_NAV_KEYS[\s\S]*'inbox'[\s\S]*'favorites'[\s\S]*'archive'/);
  assert.match(navigation, /SECONDARY_NAV_KEYS[\s\S]*'published'[\s\S]*'wiki'/);
  assert.match(navigation, /getAppNavKey/);
});

test('desktop navigation keeps three primary tabs and moves collect to a dedicated action', () => {
  const desktop = readWeb('src/components/layout/DesktopTopNav.tsx');
  assert.match(desktop, /PRIMARY_NAV_KEYS/);
  assert.match(desktop, /SECONDARY_NAV_KEYS/);
  assert.match(desktop, /desktop-collect-trigger/);
  assert.match(desktop, /nav-more-menu/);
});

test('mobile navigation has three primary tabs plus More and a top collect shortcut', () => {
  const bottom = readWeb('src/components/layout/MobileBottomTab.tsx');
  const top = readWeb('src/components/layout/MobileTopNav.tsx');
  assert.match(bottom, /PRIMARY_NAV_KEYS/);
  assert.match(bottom, /mobile-more-sheet/);
  assert.match(bottom, />更多</);
  assert.match(top, /mobile-top-action/);
});

test('main layout tracks route keys instead of fragile tab indexes', () => {
  const layout = readWorkspace('apps/web/src/app/(main)/layout.tsx');
  assert.match(layout, /getAppNavKey/);
  assert.match(layout, /pendingNavKey/);
  assert.doesNotMatch(layout, /currentTabIndex/);
});
