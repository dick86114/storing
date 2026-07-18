import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const readWeb = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('navigation layout switches to mobile before desktop tabs start to collapse', () => {
  const navigation = readWeb('src/lib/navigation.ts');
  const layout = readWeb('src/app/(main)/layout.tsx');

  assert.match(navigation, /export const MOBILE_NAV_BREAKPOINT = 810;/);
  assert.match(layout, /window\.innerWidth < MOBILE_NAV_BREAKPOINT/);
});

test('compact desktop navigation shows icons with count bubbles', () => {
  const styles = readWeb('src/app/globals.css');

  assert.match(styles, /@media \(max-width: 979px\) and \(min-width: 810px\)/);
  assert.match(styles, /\.desktop-top-nav[\s\S]*?white-space: nowrap/);
  assert.match(styles, /@media \(max-width: 979px\) and \(min-width: 810px\)[\s\S]*?\.top-tab-label,[\s\S]*?display: none/);
  assert.match(styles, /@media \(max-width: 979px\) and \(min-width: 810px\)[\s\S]*?\.top-tab-count \{\s*display: inline-block;/);
  assert.match(styles, /\.desktop-top-nav \.top-tab-count \{[\s\S]*?position: static;/);
  assert.match(styles, /@media \(max-width: 979px\) and \(min-width: 810px\)[\s\S]*?\.nav-more-trigger > span:not\(\.anticon\),[\s\S]*?display: none/);
  assert.match(styles, /@media \(min-width: 810px\)[\s\S]*?\.bottom-tab-bar \{\s*display: none !important;/);
  assert.match(styles, /@media \(max-width: 809px\)[\s\S]*?\.bottom-tab-bar \{/);
});

test('mobile search and collect controls share the same action-button treatment', () => {
  const topNav = readWeb('src/components/layout/MobileTopNav.tsx');
  const styles = readWeb('src/app/globals.css');

  assert.match(topNav, /className="mobile-top-action"[\s\S]{0,180}aria-label="采集文章"/);
  assert.match(topNav, /className="mobile-top-action"[\s\S]{0,180}aria-label="搜索"/);
  assert.equal((topNav.match(/className="mobile-top-action"/g) ?? []).length, 4);
  assert.match(styles, /\.mobile-top-action \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?color: var\(--text\);/);
  assert.doesNotMatch(styles, /\.mobile-collect-trigger \{/);
  assert.doesNotMatch(topNav, /<SearchOutlined style=\{\{ fontSize: '22px', color: 'var\(--text\)' \}\} \/>/);
});

test('mobile account menu uses compact night icons and a two-column action grid', () => {
  const mobileTopNav = readWeb('src/components/layout/MobileTopNav.tsx');
  const styles = readWeb('src/app/globals.css');

  assert.match(mobileTopNav, /className="user-menu-option-grid mobile-user-menu-appearance-grid"/);
  assert.match(mobileTopNav, /className="user-menu-option-grid mobile-user-menu-action-grid"/);
  assert.match(mobileTopNav, /mobile-theme-icon-button/);
  assert.match(mobileTopNav, /aria-label=\{themeLabels\[mode\]\}/);
  assert.match(styles, /\.mobile-top-nav \.mobile-user-menu-appearance-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});
