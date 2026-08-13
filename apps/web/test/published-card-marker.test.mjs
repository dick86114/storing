import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const readWeb = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('published articles expose an icon-only status mark beside their card date', () => {
  const card = readWeb('src/components/article/WechatArticleCard.tsx');
  const styles = readWeb('src/app/globals.css');

  assert.match(card, /article\.isPublished && <span className="article-card-published-mark"/);
  assert.match(card, /aria-label="已公开"/);
  assert.match(card, /<GlobalOutlined aria-hidden="true" \/>/);
  assert.match(styles, /\.article-card-published-mark \{[\s\S]*?width: 16px;[\s\S]*?height: 16px;[\s\S]*?color: var\(--accent\);/);
});
