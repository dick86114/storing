import type { ArchiveCategory } from '@/lib/api';

export function filterManagementCategories(categories: ArchiveCategory[], query: string): ArchiveCategory[] {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return categories;
  return categories.filter((category) => category.name.toLocaleLowerCase('zh-CN').includes(normalized));
}

function 合并用户分类顺序(categories: ArchiveCategory[], userCategories: ArchiveCategory[]): ArchiveCategory[] {
  let index = 0;
  return categories.map((category) => category.isSystem ? category : userCategories[index++]);
}

export function moveUserCategory(
  categories: ArchiveCategory[],
  sourceId: number,
  targetId: number,
): ArchiveCategory[] {
  if (sourceId === targetId) return categories;
  const userCategories = categories.filter((category) => !category.isSystem);
  const sourceIndex = userCategories.findIndex((category) => category.id === sourceId);
  const targetIndex = userCategories.findIndex((category) => category.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return categories;

  const next = [...userCategories];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return 合并用户分类顺序(categories, next);
}

export function reorderUserCategoryByOffset(
  categories: ArchiveCategory[],
  categoryId: number,
  offset: -1 | 1,
): ArchiveCategory[] {
  const userCategories = categories.filter((category) => !category.isSystem);
  const index = userCategories.findIndex((category) => category.id === categoryId);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= userCategories.length) return categories;
  return moveUserCategory(categories, categoryId, userCategories[targetIndex].id);
}

export function resolveSelectedCategoryId(
  categories: ArchiveCategory[],
  currentId: number | null,
  pendingId: number | null,
): number | null {
  if (currentId !== null && categories.some((category) => category.id === currentId)) return currentId;
  if (currentId !== null && pendingId === currentId) return currentId;
  return categories.find((category) => category.isSystem)?.id ?? categories[0]?.id ?? null;
}
