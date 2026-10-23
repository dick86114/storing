import type { ArchiveCategory } from '@/lib/api';

export type CategoryCatalogData = {
  categories: ArchiveCategory[];
  counts: Record<string, number>;
};

type 可读存储 = Pick<Storage, 'getItem'>;
type 可写存储 = Pick<Storage, 'getItem' | 'setItem'>;

export function categoryCatalogKey(userId: number) {
  return `categories:user:${userId}`;
}

export function categoryRecentsStorageKey(userId: number) {
  return `category.recents.${userId}`;
}

export function activeCategoriesFrom(data: CategoryCatalogData | undefined): ArchiveCategory[] {
  return (data?.categories ?? []).filter((category) => category.isActive);
}

function 清理最近使用(raw: unknown, activeCategoryIds: ReadonlySet<number>): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const next: number[] = [];
  for (const value of raw) {
    if (!Number.isInteger(value) || !activeCategoryIds.has(value) || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
    if (next.length === 5) break;
  }
  return next;
}

export function readCategoryRecents(
  storage: 可读存储,
  userId: number,
  activeCategoryIds: ReadonlySet<number>,
): number[] {
  const storageKey = categoryRecentsStorageKey(userId);
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const next = 清理最近使用(parsed, activeCategoryIds);
  const normalized = JSON.stringify(next);
  if (normalized !== raw && 'setItem' in storage) {
    try {
      (storage as 可写存储).setItem(storageKey, normalized);
    } catch {
      // 浏览器可能禁用本地存储；最近使用只是增强信息，不能影响分类主流程。
    }
  }
  return next;
}

export function rememberCategoryRecent(
  storage: 可写存储,
  userId: number,
  categoryId: number,
  activeCategoryIds: ReadonlySet<number>,
): number[] {
  if (!activeCategoryIds.has(categoryId)) {
    return readCategoryRecents(storage, userId, activeCategoryIds);
  }

  const next = [
    categoryId,
    ...readCategoryRecents(storage, userId, activeCategoryIds).filter((id) => id !== categoryId),
  ].slice(0, 5);
  try {
    storage.setItem(categoryRecentsStorageKey(userId), JSON.stringify(next));
  } catch {
    // 写入失败时仍返回本次内存中的最近使用结果。
  }
  return next;
}
