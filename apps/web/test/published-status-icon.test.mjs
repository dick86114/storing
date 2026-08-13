import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const card = readFileSync(new URL('../src/components/article/WechatArticleCard.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');

test('Web 端的发布状态统一使用公开地球图标', () => {
  assert.match(card, /GlobalOutlined/);
  assert.match(detail, /GlobalOutlined/);
  assert.doesNotMatch(card, /<ExportOutlined[^>]*[^\n]*已发布/);
  assert.doesNotMatch(detail, /<ExportOutlined[^>]*[^\n]*发布/);
});
