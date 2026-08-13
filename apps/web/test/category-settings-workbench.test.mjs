import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../src/components/content/CategorySettingsContent.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

test('分类管理使用卡片工作台与弹窗表单', () => {
  assert.match(page, /category-workbench-grid/);
  assert.match(page, /category-form-overlay/);
  assert.match(page, /新增分类/);
  assert.match(page, /ArrowUpOutlined/);
  assert.match(page, /EditOutlined/);
  assert.match(page, /PauseCircleOutlined/);
  assert.match(page, /PlayCircleOutlined/);
  assert.match(page, /重新启用/);
  assert.match(page, /DeleteOutlined/);
  assert.match(page, /category-action-modal/);
  assert.match(page, /删除分类/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /index > 0 && <CategoryIconButton label=\{`上移/);
  assert.match(page, /index < categories\.length - 1 && <CategoryIconButton label=\{`下移/);
  assert.match(page, /色板|预设颜色/);
  assert.match(page, /适合收录/);
  assert.match(page, /不适合收录/);
  assert.match(page, /AI 优化/);
  assert.match(api, /optimizeCategoryDescription/);
  assert.match(api, /deleteCategory/);
});

test('分类表单提供十二个预设颜色，规则输入框始终顶部对齐', () => {
  const colorList = page.match(/const CATEGORY_COLORS = \[([^\]]+)\]/)?.[1] ?? '';
  assert.equal((colorList.match(/#[0-9A-F]{6}/g) ?? []).length, 12);
  assert.match(styles, /\.category-form-rule-grid\s*\{[^}]*align-items:\s*start;/s);
  assert.match(styles, /\.category-form-rule-grid \.category-form-field\s*\{[^}]*align-self:\s*start;/s);
  assert.match(styles, /\.category-form-color-swatches\s*\{[^}]*flex-wrap:\s*wrap;/s);
});
