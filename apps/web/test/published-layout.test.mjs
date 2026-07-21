import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const readWeb = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('magazine published articles use a left-to-right grid instead of the masonry column flow', () => {
  const published = readWeb('src/components/content/PublishedContent.tsx');
  const styles = readWeb('src/app/globals.css');

  assert.match(published, /className="published-content"/);
  assert.match(styles, /\[data-color-scheme='magazine'\] \.published-content \.article-stream \{[\s\S]*?display: grid !important;[\s\S]*?grid-template-columns: repeat\(auto-fill, minmax\(280px, 1fr\)\) !important;/);
  assert.match(styles, /\[data-color-scheme='magazine'\] \.published-content \.article-card \{[\s\S]*?display: block !important;[\s\S]*?margin: 0 !important;/);
});
