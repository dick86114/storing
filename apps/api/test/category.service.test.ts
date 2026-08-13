import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CategoryServiceError,
  createCategory,
  deactivateCategory,
  listCategories,
  mergeCategories,
  moveArticlesToCategory,
  updateCategory,
} from '../src/services/category.service.js';

type QueryResult = { rows: unknown[] };

class FakeDatabase {
  readonly queries: unknown[] = [];
  private readonly results: QueryResult[];
  transactionCalls = 0;

  constructor(results: QueryResult[]) {
    this.results = [...results];
  }

  async execute(query: unknown): Promise<QueryResult> {
    this.queries.push(query);
    const result = this.results.shift();
    if (!result) throw new Error('缺少预期的数据库返回结果');
    return result;
  }

  async transaction<T>(callback: (tx: FakeDatabase) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    return callback(this);
  }
}

function sqlText(query: unknown): string {
  if (!query || typeof query !== 'object') return '';
  const value = (query as { value?: unknown }).value;
  if (Array.isArray(value)) return value.map(String).join(' ');
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks.map(sqlText).join(' ');
}

function category(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    user_id: 7,
    name: '技术',
    description: null,
    include_examples: null,
    exclude_examples: null,
    color: null,
    sort_order: 10,
    is_active: true,
    is_system: false,
    created_at: new Date('2026-08-13T00:00:00.000Z'),
    updated_at: new Date('2026-08-13T00:00:00.000Z'),
    ...overrides,
  };
}

test('listCategories 默认只返回启用分类，并保留排序后的数据库结果', async () => {
  const database = new FakeDatabase([{ rows: [category(), category({ id: 102, name: '阅读' })] }]);

  const result = await listCategories(7, undefined, database);

  assert.deepEqual(result.map((item) => item.id), [101, 102]);
  assert.equal(database.queries.length, 1);
});

test('createCategory 在同一用户已有同名启用分类时返回稳定错误码', async () => {
  const database = new FakeDatabase([{ rows: [{ id: 100 }] }]);

  await assert.rejects(
    () => createCategory(7, { name: '技术' }, database),
    (error: unknown) => error instanceof CategoryServiceError && error.code === 'CATEGORY_NAME_CONFLICT',
  );
});

test('createCategory 将空示例写为 PostgreSQL TEXT 数组而不是空 SQL 列表', async () => {
  const database = new FakeDatabase([
    { rows: [] },
    { rows: [category()] },
  ]);

  await createCategory(7, { name: '技术' }, database);

  const insert = sqlText(database.queries[1]);
  assert.match(insert, /ARRAY\[\]::text\[\]/);
  assert.doesNotMatch(insert, /VALUES \( \$1 , \$2 , \$3 , \(\) /);
});

test('deactivateCategory 拒绝停用系统待整理分类', async () => {
  const database = new FakeDatabase([{ rows: [category({ id: 1, is_system: true })] }]);

  await assert.rejects(
    () => deactivateCategory(7, 1, database),
    (error: unknown) => error instanceof CategoryServiceError && error.code === 'SYSTEM_CATEGORY_PROTECTED',
  );
});

test('updateCategory 只能修改当前用户的非系统分类', async () => {
  const database = new FakeDatabase([
    { rows: [category()] },
    { rows: [] },
    { rows: [category({ name: '工程' })] },
  ]);

  const result = await updateCategory(7, 101, { name: '工程' }, database);

  assert.equal(result.name, '工程');
  assert.equal(database.queries.length, 3);
});

test('moveArticlesToCategory 仅迁移当前用户全部拥有的文章，并标记为人工确认', async () => {
  const database = new FakeDatabase([
    { rows: [category()] },
    { rows: [{ article_id: 11 }, { article_id: 12 }] },
    { rows: [{ article_id: 11 }, { article_id: 12 }] },
  ]);

  const result = await moveArticlesToCategory(7, [11, 12], 101, database);

  assert.equal(result.updatedCount, 2);
  assert.equal(database.queries.length, 3);
});

test('moveArticlesToCategory 对跨用户文章返回明确错误码且不更新任何文章', async () => {
  const database = new FakeDatabase([
    { rows: [category()] },
    { rows: [{ article_id: 11 }] },
  ]);

  await assert.rejects(
    () => moveArticlesToCategory(7, [11, 12], 101, database),
    (error: unknown) => error instanceof CategoryServiceError && error.code === 'ARTICLE_ACCESS_DENIED',
  );
  assert.equal(database.queries.length, 2);
});

test('mergeCategories 在事务中迁移文章并停用源分类，且不覆写既有审核字段', async () => {
  const database = new FakeDatabase([
    { rows: [category({ id: 101 })] },
    { rows: [category({ id: 102 })] },
    { rows: [{ article_id: 11 }, { article_id: 12 }] },
    { rows: [category({ id: 101, is_active: false })] },
  ]);

  const result = await mergeCategories(7, 101, 102, database);

  assert.equal(result.movedArticleCount, 2);
  assert.equal(database.transactionCalls, 1);
  assert.equal(database.queries.length, 4);
});

test('mergeCategories 拒绝合并系统源分类', async () => {
  const database = new FakeDatabase([
    { rows: [category({ id: 1, is_system: true })] },
  ]);

  await assert.rejects(
    () => mergeCategories(7, 1, 102, database),
    (error: unknown) => error instanceof CategoryServiceError && error.code === 'SYSTEM_CATEGORY_PROTECTED',
  );
});
