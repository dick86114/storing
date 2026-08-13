import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const sourceIcons = readFileSync(new URL('../src/components/article/articleSourceIcon.tsx', import.meta.url), 'utf8');

test('微信主题使用沉稳的归档绿色，而非荧光微信绿', () => {
  const wechatTheme = styles.slice(
    styles.indexOf("[data-color-scheme='wechat'][data-theme='light']"),
    styles.indexOf("[data-color-scheme='glass'][data-theme='light']"),
  );

  assert.match(wechatTheme, /--accent: #2f6a4f/);
  assert.match(wechatTheme, /--accent-alt: #24543e/);
  assert.doesNotMatch(wechatTheme, /#07c160|#06ad56/);
  assert.match(sourceIcons, /kind: 'wechat',[\s\S]*?color: 'var\(--accent\)'/);
});
