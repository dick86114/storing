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
  assert.match(navigation, /SECONDARY_NAV_KEYS[\s\S]*'published'/);
  assert.doesNotMatch(navigation, /wiki/i);
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

test('account dropdown uses two-column option grids in every color scheme', () => {
  const desktop = readWeb('src/components/layout/DesktopTopNav.tsx');
  const themeMenu = readWeb('src/components/layout/ThemeStyleMenu.tsx');
  const styles = readWeb('src/app/globals.css');

  assert.match(desktop, /className="user-menu-option-grid user-menu-appearance-grid"/);
  assert.match(desktop, /className="user-menu-option-grid user-menu-action-grid"/);
  assert.match(themeMenu, /className="theme-style-menu user-menu-option-grid"/);
  assert.match(styles, /\.user-menu \.user-menu-option-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.user-menu \.theme-style-menu\s*\{[\s\S]*?display:\s*grid !important/);
  assert.match(styles, /\.user-menu \.theme-menu-label\s*\{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.app-menu\.user-menu\s*\{[\s\S]*?width:\s*min\(360px, calc\(100vw - 16px\)\)/);
});
