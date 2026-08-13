import { sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleMetadata, categories } from '../db/schema.js';

export type CategorySource = 'ai' | 'user' | 'rule';
export type CategoryReviewStatus = 'confirmed' | 'needs_review' | 'pending';

export interface Category {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  includeExamples: string[];
  excludeExamples: string[];
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type CategoryServiceErrorCode =
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_INACTIVE'
  | 'CATEGORY_NAME_CONFLICT'
  | 'SYSTEM_CATEGORY_PROTECTED'
  | 'ARTICLE_ACCESS_DENIED'
  | 'CATEGORY_MERGE_SAME_TARGET'
  | 'CATEGORY_INVALID_INPUT';

export class CategoryServiceError extends Error {
  constructor(
    public readonly code: CategoryServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CategoryServiceError';
  }
}

type QueryResult<T = Record<string, unknown>> = { rows: T[] };

export interface CategoryDatabase {
  execute<T = Record<string, unknown>>(query: SQL): Promise<QueryResult<T>>;
  transaction<T>(callback: (tx: CategoryDatabase) => Promise<T>): Promise<T>;
}

export interface ListCategoriesOptions {
  includeInactive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  includeExamples?: string[];
  excludeExamples?: string[];
  color?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  includeExamples?: string[];
  excludeExamples?: string[];
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

type CategoryRow = {
  id: number;
  user_id?: number;
  userId?: number;
  name: string;
  description?: string | null;
  include_examples?: string[] | null;
  includeExamples?: string[] | null;
  exclude_examples?: string[] | null;
  excludeExamples?: string[] | null;
  color?: string | null;
  sort_order?: number;
  sortOrder?: number;
  is_active?: boolean;
  isActive?: boolean;
  is_system?: boolean;
  isSystem?: boolean;
  created_at?: Date | string | null;
  createdAt?: Date | string | null;
  updated_at?: Date | string | null;
  updatedAt?: Date | string | null;
};

const defaultDatabase = db as unknown as CategoryDatabase;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: Number(row.id),
    userId: Number(row.userId ?? row.user_id),
    name: row.name,
    description: row.description ?? null,
    includeExamples: row.includeExamples ?? row.include_examples ?? [],
    excludeExamples: row.excludeExamples ?? row.exclude_examples ?? [],
    color: row.color ?? null,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    isActive: Boolean(row.isActive ?? row.is_active),
    isSystem: Boolean(row.isSystem ?? row.is_system),
    createdAt: toIso(row.createdAt ?? row.created_at),
    updatedAt: toIso(row.updatedAt ?? row.updated_at),
  };
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized || normalized.length > 60) {
    throw new CategoryServiceError('CATEGORY_INVALID_INPUT', '分类名称需为 1 至 60 个字符');
  }
  return normalized;
}

function normalizeExamples(value: string[] | undefined): string[] {
  if (!value) return [];
  if (value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new CategoryServiceError('CATEGORY_INVALID_INPUT', '分类示例必须为非空文本');
  }
  return value.map((item) => item.trim());
}

function textArray(value: string[]): SQL {
  if (value.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(value.map((item) => sql`${item}`), sql`, `)}]::text[]`;
}

async function getCategoryForUser(
  database: CategoryDatabase,
  userId: number,
  categoryId: number,
): Promise<Category> {
  const result = await database.execute<CategoryRow>(sql`
    SELECT *
    FROM ${categories}
    WHERE ${categories.id} = ${categoryId}
      AND ${categories.userId} = ${userId}
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) throw new CategoryServiceError('CATEGORY_NOT_FOUND', '分类不存在或无权访问');
  return toCategory(row);
}

export async function getCategoryById(
  userId: number,
  categoryId: number,
  options: { requireActive?: boolean } = {},
  database: CategoryDatabase = defaultDatabase,
): Promise<Category> {
  const category = await getCategoryForUser(database, userId, categoryId);
  if (options.requireActive) assertActiveCategory(category);
  return category;
}

export async function getPendingCategory(
  userId: number,
  database: CategoryDatabase = defaultDatabase,
): Promise<Category> {
  const result = await database.execute<CategoryRow>(sql`
    SELECT *
    FROM ${categories}
    WHERE ${categories.userId} = ${userId}
      AND ${categories.isSystem} = TRUE
      AND ${categories.name} = '待整理'
    LIMIT 1
  `);
  const row = result.rows[0];
  if (!row) throw new CategoryServiceError('CATEGORY_NOT_FOUND', '系统分类“待整理”尚未初始化');
  return toCategory(row);
}

export async function applyAiCategory(
  userId: number,
  articleId: number,
  result: { categoryId: number; confidence: number; reason: string | null; modelVersion: string | null },
  database: CategoryDatabase = defaultDatabase,
): Promise<{ category: Category; reviewStatus: CategoryReviewStatus }> {
  const pending = await getPendingCategory(userId, database);
  const eligible = result.confidence >= 0.5
    ? await getCategoryById(userId, result.categoryId, { requireActive: true }, database).catch(() => null)
    : null;
  const category = eligible ?? pending;
  const reviewStatus: CategoryReviewStatus = eligible
    ? (result.confidence >= 0.75 ? 'confirmed' : 'needs_review')
    : 'needs_review';
  await database.execute(sql`
    UPDATE ${articleMetadata}
    SET
      category_id = ${category.id},
      category_source = 'ai',
      category_confidence = ${result.confidence.toFixed(3)},
      category_reason = ${result.reason},
      category_review_status = ${reviewStatus},
      category_model_version = ${result.modelVersion},
      updated_at = NOW()
    WHERE ${articleMetadata.userId} = ${userId}
      AND ${articleMetadata.articleId} = ${articleId}
      AND (${articleMetadata.categorySource} IS NULL OR ${articleMetadata.categorySource} <> 'user')
  `);
  return { category, reviewStatus };
}

function assertMutableCategory(category: Category): void {
  if (category.isSystem) {
    throw new CategoryServiceError('SYSTEM_CATEGORY_PROTECTED', '系统分类“待整理”不可停用、删除或合并');
  }
}

function assertActiveCategory(category: Category): void {
  if (!category.isActive) {
    throw new CategoryServiceError('CATEGORY_INACTIVE', '分类已停用，不能用于归类');
  }
}

export async function listCategories(
  userId: number,
  options: ListCategoriesOptions = {},
  database: CategoryDatabase = defaultDatabase,
): Promise<Category[]> {
  const activeFilter = options.includeInactive ? sql`` : sql`AND ${categories.isActive} = TRUE`;
  const result = await database.execute<CategoryRow>(sql`
    SELECT *
    FROM ${categories}
    WHERE ${categories.userId} = ${userId}
      ${activeFilter}
    ORDER BY ${categories.sortOrder} ASC, ${categories.createdAt} ASC
  `);
  return result.rows.map(toCategory);
}

export async function getArchiveCategoryCounts(
  userId: number,
  database: CategoryDatabase = defaultDatabase,
): Promise<Record<number, number>> {
  const result = await database.execute<{ category_id: number; count: number | string }>(sql`
    SELECT ${articleMetadata.categoryId} AS category_id, COUNT(*)::int AS count
    FROM ${articleMetadata}
    WHERE ${articleMetadata.userId} = ${userId}
      AND ${articleMetadata.isArchived} = TRUE
      AND ${articleMetadata.isDeleted} = FALSE
      AND ${articleMetadata.categoryId} IS NOT NULL
    GROUP BY ${articleMetadata.categoryId}
  `);
  return Object.fromEntries(result.rows.map((row) => [Number(row.category_id), Number(row.count)]));
}

export async function createCategory(
  userId: number,
  input: CreateCategoryInput,
  database: CategoryDatabase = defaultDatabase,
): Promise<Category> {
  const name = normalizeName(input.name);
  const existing = await database.execute<{ id: number }>(sql`
    SELECT ${categories.id}
    FROM ${categories}
    WHERE ${categories.userId} = ${userId}
      AND LOWER(${categories.name}) = LOWER(${name})
      AND ${categories.isActive} = TRUE
    LIMIT 1
  `);
  if (existing.rows[0]) {
    throw new CategoryServiceError('CATEGORY_NAME_CONFLICT', '已存在同名启用分类');
  }

  const includeExamples = normalizeExamples(input.includeExamples);
  const excludeExamples = normalizeExamples(input.excludeExamples);
  const result = await database.execute<CategoryRow>(sql`
    INSERT INTO ${categories} (
      user_id, name, description, include_examples, exclude_examples, color, sort_order, is_active, is_system
    ) VALUES (
      ${userId}, ${name}, ${input.description?.trim() || null}, ${textArray(includeExamples)}, ${textArray(excludeExamples)},
      ${input.color?.trim() || null}, ${input.sortOrder ?? 0}, TRUE, FALSE
    )
    RETURNING *
  `);
  return toCategory(result.rows[0]);
}

export async function updateCategory(
  userId: number,
  categoryId: number,
  input: UpdateCategoryInput,
  database: CategoryDatabase = defaultDatabase,
): Promise<Category> {
  const current = await getCategoryForUser(database, userId, categoryId);
  assertMutableCategory(current);
  if (input.isActive === false) return deactivateCategory(userId, categoryId, database);

  const name = input.name === undefined ? current.name : normalizeName(input.name);
  const includeExamples = input.includeExamples === undefined ? current.includeExamples : normalizeExamples(input.includeExamples);
  const excludeExamples = input.excludeExamples === undefined ? current.excludeExamples : normalizeExamples(input.excludeExamples);
  if (name.toLocaleLowerCase() !== current.name.toLocaleLowerCase()) {
    const duplicate = await database.execute<{ id: number }>(sql`
      SELECT ${categories.id}
      FROM ${categories}
      WHERE ${categories.userId} = ${userId}
        AND LOWER(${categories.name}) = LOWER(${name})
        AND ${categories.isActive} = TRUE
        AND ${categories.id} <> ${categoryId}
      LIMIT 1
    `);
    if (duplicate.rows[0]) throw new CategoryServiceError('CATEGORY_NAME_CONFLICT', '已存在同名启用分类');
  }

  const result = await database.execute<CategoryRow>(sql`
    UPDATE ${categories}
    SET
      name = ${name},
      description = ${input.description === undefined ? current.description : input.description?.trim() || null},
      include_examples = ${textArray(includeExamples)},
      exclude_examples = ${textArray(excludeExamples)},
      color = ${input.color === undefined ? current.color : input.color?.trim() || null},
      sort_order = ${input.sortOrder ?? current.sortOrder},
      updated_at = NOW()
    WHERE ${categories.id} = ${categoryId}
      AND ${categories.userId} = ${userId}
    RETURNING *
  `);
  return toCategory(result.rows[0]);
}

export async function deactivateCategory(
  userId: number,
  categoryId: number,
  database: CategoryDatabase = defaultDatabase,
): Promise<Category> {
  const current = await getCategoryForUser(database, userId, categoryId);
  assertMutableCategory(current);
  const result = await database.execute<CategoryRow>(sql`
    UPDATE ${categories}
    SET is_active = FALSE, updated_at = NOW()
    WHERE ${categories.id} = ${categoryId}
      AND ${categories.userId} = ${userId}
    RETURNING *
  `);
  return toCategory(result.rows[0]);
}

export async function moveArticlesToCategory(
  userId: number,
  articleIds: number[],
  categoryId: number,
  database: CategoryDatabase = defaultDatabase,
): Promise<{ updatedCount: number }> {
  const uniqueArticleIds = [...new Set(articleIds)];
  if (!uniqueArticleIds.length || uniqueArticleIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new CategoryServiceError('CATEGORY_INVALID_INPUT', '请选择至少一篇有效文章');
  }
  const category = await getCategoryForUser(database, userId, categoryId);
  assertActiveCategory(category);

  const owned = await database.execute<{ article_id: number }>(sql`
    SELECT ${articleMetadata.articleId} AS article_id
    FROM ${articleMetadata}
    WHERE ${articleMetadata.userId} = ${userId}
      AND ${articleMetadata.isArchived} = TRUE
      AND ${articleMetadata.articleId} IN (${sql.join(uniqueArticleIds.map((id) => sql`${id}`), sql`, `)})
  `);
  if (owned.rows.length !== uniqueArticleIds.length) {
    throw new CategoryServiceError('ARTICLE_ACCESS_DENIED', '包含不存在或不属于当前用户的文章');
  }

  const updated = await database.execute<{ article_id: number }>(sql`
    UPDATE ${articleMetadata}
    SET
      category_id = ${categoryId},
      category_source = ${'user' satisfies CategorySource},
      category_review_status = ${'confirmed' satisfies CategoryReviewStatus},
      updated_at = NOW()
    WHERE ${articleMetadata.userId} = ${userId}
      AND ${articleMetadata.isArchived} = TRUE
      AND ${articleMetadata.articleId} IN (${sql.join(uniqueArticleIds.map((id) => sql`${id}`), sql`, `)})
    RETURNING ${articleMetadata.articleId} AS article_id
  `);
  return { updatedCount: updated.rows.length };
}

export async function mergeCategories(
  userId: number,
  sourceId: number,
  targetId: number,
  database: CategoryDatabase = defaultDatabase,
): Promise<{ movedArticleCount: number; sourceCategory: Category }> {
  if (sourceId === targetId) {
    throw new CategoryServiceError('CATEGORY_MERGE_SAME_TARGET', '不能将分类合并到自身');
  }
  return database.transaction(async (tx) => {
    const source = await getCategoryForUser(tx, userId, sourceId);
    assertMutableCategory(source);
    const target = await getCategoryForUser(tx, userId, targetId);
    assertActiveCategory(target);

    const moved = await tx.execute<{ article_id: number }>(sql`
      UPDATE ${articleMetadata}
      SET category_id = ${targetId}, updated_at = NOW()
      WHERE ${articleMetadata.userId} = ${userId}
        AND ${articleMetadata.categoryId} = ${sourceId}
      RETURNING ${articleMetadata.articleId} AS article_id
    `);
    const deactivated = await tx.execute<CategoryRow>(sql`
      UPDATE ${categories}
      SET is_active = FALSE, updated_at = NOW()
      WHERE ${categories.id} = ${sourceId}
        AND ${categories.userId} = ${userId}
      RETURNING *
    `);
    return { movedArticleCount: moved.rows.length, sourceCategory: toCategory(deactivated.rows[0]) };
  });
}

export async function reorderCategories(
  userId: number,
  categoryIds: number[],
  database: CategoryDatabase = defaultDatabase,
): Promise<Category[]> {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length !== categoryIds.length || uniqueIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new CategoryServiceError('CATEGORY_INVALID_INPUT', '分类排序参数无效');
  }

  return database.transaction(async (tx) => {
    const existing = await tx.execute<CategoryRow>(sql`
      SELECT *
      FROM ${categories}
      WHERE ${categories.userId} = ${userId}
        AND ${categories.id} IN (${sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)})
    `);
    if (existing.rows.length !== uniqueIds.length) {
      throw new CategoryServiceError('CATEGORY_NOT_FOUND', '分类不存在或无权访问');
    }

    for (const [sortOrder, categoryId] of uniqueIds.entries()) {
      await tx.execute(sql`
        UPDATE ${categories}
        SET sort_order = ${sortOrder}, updated_at = NOW()
        WHERE ${categories.id} = ${categoryId}
          AND ${categories.userId} = ${userId}
      `);
    }
    return listCategories(userId, { includeInactive: true }, tx);
  });
}
