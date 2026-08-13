import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('分类数据模型包含用户级分类和受控文章分类字段', () => {
  const schema = read('src/db/schema.ts');

  assert.match(schema, /export const categories = pgTable\('categories'/);
  assert.match(schema, /userId: integer\('user_id'\)\.notNull\(\)\.references\(\(\) => users\.id/);
  assert.match(schema, /includeExamples: text\('include_examples'\)/);
  assert.match(schema, /excludeExamples: text\('exclude_examples'\)/);
  assert.match(schema, /isSystem: boolean\('is_system'\)/);
  assert.match(schema, /categoryId: integer\('category_id'\)\.references\(\(\) => categories\.id/);
  assert.match(schema, /categorySource: text\('category_source'\)/);
  assert.match(schema, /categoryConfidence: numeric\('category_confidence', \{ precision: 4, scale: 3 \}\)/);
  assert.match(schema, /categoryReviewStatus: text\('category_review_status'\)/);
  assert.match(schema, /categoryModelVersion: text\('category_model_version'\)/);
});

test('分类初始化迁移可重复执行并为每个用户创建待整理分类', () => {
  const migration = read('src/services/metadata-scope.service.ts');
  const index = read('src/index.ts');

  assert.match(migration, /export async function ensureArchiveCategorySchema\(\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS categories/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS category_id INTEGER/);
  assert.match(migration, /INSERT INTO categories[\s\S]*待整理/);
  assert.match(migration, /pg_advisory_xact_lock\(734291108\)/);
  assert.match(migration, /UPDATE article_metadata[\s\S]*is_archived[\s\S]*category_id/);
  assert.match(index, /ensureArchiveCategorySchema\(\)/);
});

test('分类查询索引使用幂等并发创建', () => {
  const indexes = read('src/services/db-indexes.service.ts');

  assert.match(indexes, /idx_categories_user_active_sort/);
  assert.match(indexes, /CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_user_active_sort/);
  assert.match(indexes, /idx_article_metadata_user_category_archived/);
  assert.match(indexes, /CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_user_category_archived/);
});
