import { Hono } from 'hono';
import { z } from 'zod';
import { getCurrentUser, requireAuth } from '../middleware/auth.js';
import {
  createCategory,
  deleteCategory,
  deactivateCategory,
  getArchiveCategoryCounts,
  listCategories,
  mergeCategories,
  reorderCategories,
  updateCategory,
} from '../services/category.service.js';
import { optimizeCategoryDescription } from '../services/ai.service.js';

export const categoriesRoutes = new Hono();

const categoryInput = z.object({
  name: z.string().trim().min(1, '分类名称不能为空').max(40, '分类名称不能超过 40 个字符'),
  description: z.string().trim().max(500, '分类说明不能超过 500 个字符').optional().nullable(),
  includeExamples: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  excludeExamples: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, '颜色格式无效').optional().nullable(),
  isActive: z.boolean().optional(),
});

const categoryDescriptionOptimizeInput = z.object({
  name: z.string().trim().min(1, '请先填写分类名称').max(40, '分类名称不能超过 40 个字符'),
  description: z.string().trim().max(500, '分类说明不能超过 500 个字符').optional().nullable(),
  includeExamples: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  excludeExamples: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
});

function validationError(c: any, message: string) {
  return c.json({ error: { code: 'BAD_REQUEST', message } }, 400);
}

function categoryError(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : '分类操作失败';
  const code = message.includes('不存在') ? 'CATEGORY_NOT_FOUND'
    : message.includes('系统分类') ? 'SYSTEM_CATEGORY_PROTECTED'
      : message.includes('其他用户') ? 'CATEGORY_FORBIDDEN'
        : message.includes('已存在') ? 'CATEGORY_NAME_CONFLICT'
          : 'BAD_REQUEST';
  const status = code === 'CATEGORY_NOT_FOUND' ? 404 : code === 'CATEGORY_FORBIDDEN' ? 403 : 400;
  return c.json({ error: { code, message } }, status);
}

categoriesRoutes.get('/categories', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  const includeInactive = c.req.query('includeInactive') === 'true';
  const [categories, counts] = await Promise.all([
    listCategories(userId, { includeInactive }),
    getArchiveCategoryCounts(userId),
  ]);
  return c.json({ categories, counts });
});

categoriesRoutes.post('/categories/optimize-description', requireAuth, async (c) => {
  const parsed = categoryDescriptionOptimizeInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.issues[0]?.message || '分类说明参数无效');
  try {
    const draft = await optimizeCategoryDescription(parsed.data);
    return c.json({ draft });
  } catch (error) {
    return c.json({ error: { code: 'AI_OPTIMIZE_FAILED', message: error instanceof Error ? error.message : 'AI 优化分类说明失败' } }, 502);
  }
});

categoriesRoutes.post('/categories', requireAuth, async (c) => {
  const parsed = categoryInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.issues[0]?.message || '分类参数无效');
  try {
    const category = await createCategory(getCurrentUser(c).id as number, parsed.data);
    return c.json({ category }, 201);
  } catch (error) {
    return categoryError(c, error);
  }
});

categoriesRoutes.patch('/categories/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return validationError(c, '分类 ID 无效');
  const parsed = categoryInput.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, parsed.error.issues[0]?.message || '分类参数无效');
  try {
    const category = await updateCategory(getCurrentUser(c).id as number, id, parsed.data);
    return c.json({ category });
  } catch (error) {
    return categoryError(c, error);
  }
});

categoriesRoutes.delete('/categories/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return validationError(c, '分类 ID 无效');
  const targetCategoryId = Number(c.req.query('targetCategoryId'));
  if (!Number.isInteger(targetCategoryId) || targetCategoryId <= 0) {
    return validationError(c, '删除分类时必须指定迁移目标分类');
  }
  try {
    const result = await deleteCategory(getCurrentUser(c).id as number, id, targetCategoryId);
    return c.json({ ok: true, movedArticleCount: result.movedArticleCount });
  } catch (error) {
    return categoryError(c, error);
  }
});

categoriesRoutes.post('/categories/reorder', requireAuth, async (c) => {
  const parsed = z.object({ categoryIds: z.array(z.number().int().positive()).min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, '分类排序参数无效');
  try {
    const categories = await reorderCategories(getCurrentUser(c).id as number, parsed.data.categoryIds);
    return c.json({ categories });
  } catch (error) {
    return categoryError(c, error);
  }
});

categoriesRoutes.post('/categories/merge', requireAuth, async (c) => {
  const parsed = z.object({ sourceCategoryId: z.number().int().positive(), targetCategoryId: z.number().int().positive() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return validationError(c, '合并分类参数无效');
  try {
    await mergeCategories(getCurrentUser(c).id as number, parsed.data.sourceCategoryId, parsed.data.targetCategoryId);
    return c.json({ ok: true });
  } catch (error) {
    return categoryError(c, error);
  }
});
