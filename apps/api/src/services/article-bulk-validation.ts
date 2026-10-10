import type { ArticleBulkAction } from '@storing/shared';

export const ARTICLE_BULK_ACTION_LIMIT = 200;

const ARTICLE_BULK_ACTIONS = new Set<ArticleBulkAction>([
  'favorite',
  'unfavorite',
  'archive',
  'unarchive',
  'delete',
  'permanent_delete',
  'publish',
  'unpublish',
]);

export type ArticleBulkActionInput = {
  ok: true;
  action: ArticleBulkAction;
  articleIds: number[];
} | {
  ok: false;
  code: 'INVALID_ACTION' | 'EMPTY_ARTICLES' | 'INVALID_ARTICLES' | 'TOO_MANY_ARTICLES';
};

function parseArticleId(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function parseArticleBulkActionInput(body: unknown): ArticleBulkActionInput {
  if (!body || typeof body !== 'object') return { ok: false, code: 'INVALID_ACTION' };
  const action = (body as { action?: unknown }).action;
  if (typeof action !== 'string' || !ARTICLE_BULK_ACTIONS.has(action as ArticleBulkAction)) {
    return { ok: false, code: 'INVALID_ACTION' };
  }

  const rawIds = (body as { articleIds?: unknown }).articleIds;
  if (!Array.isArray(rawIds)) return { ok: false, code: 'INVALID_ARTICLES' };
  if (rawIds.length === 0) return { ok: false, code: 'EMPTY_ARTICLES' };

  const articleIds: number[] = [];
  for (const rawId of rawIds) {
    const articleId = parseArticleId(rawId);
    if (articleId === null) return { ok: false, code: 'INVALID_ARTICLES' };
    if (!articleIds.includes(articleId)) articleIds.push(articleId);
  }
  if (articleIds.length > ARTICLE_BULK_ACTION_LIMIT) {
    return { ok: false, code: 'TOO_MANY_ARTICLES' };
  }
  return { ok: true, action: action as ArticleBulkAction, articleIds };
}
