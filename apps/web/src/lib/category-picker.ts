import type { ArticleBulkActionResult } from '@storing/shared';
import type { ArchiveCategory } from '@/lib/api';

export type CategoryAssignmentOutcome =
  | { status: 'success'; message?: string }
  | {
      status: 'partial';
      succeededCount: number;
      skippedCount: number;
      failedCount: number;
      message?: string;
    }
  | {
      status: 'failure';
      message: string;
      succeededCount?: number;
      skippedCount?: number;
      failedCount?: number;
    };

export type CategoryPickerSections = {
  filtered: ArchiveCategory[];
  recent: ArchiveCategory[];
  exactCategory: ArchiveCategory | null;
  canCreate: boolean;
};

export function filterPickerCategories(categories: ArchiveCategory[], query: string): ArchiveCategory[] {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return categories.filter((category) => category.isActive);
  return categories.filter((category) => (
    category.isActive && category.name.toLocaleLowerCase('zh-CN').includes(normalized)
  ));
}

export function buildCategoryPickerSections(
  categories: ArchiveCategory[],
  recentCategoryIds: number[],
  query: string,
): CategoryPickerSections {
  const filtered = filterPickerCategories(categories, query);
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  const exactCategory = normalized
    ? categories.find((category) => category.isActive && category.name.toLocaleLowerCase('zh-CN') === normalized) ?? null
    : null;
  const byId = new Map(categories.filter((category) => category.isActive).map((category) => [category.id, category]));
  const recent = recentCategoryIds
    .map((id) => byId.get(id))
    .filter((category): category is ArchiveCategory => Boolean(category))
    .filter((category) => !normalized || category.name.toLocaleLowerCase('zh-CN').includes(normalized));

  return {
    filtered,
    recent,
    exactCategory,
    canCreate: Boolean(normalized) && !exactCategory,
  };
}

export function nextPickerIndex(currentIndex: number, delta: number, optionCount: number): number {
  if (optionCount <= 0) return -1;
  if (currentIndex < 0) return delta > 0 ? 0 : optionCount - 1;
  return (currentIndex + delta + optionCount) % optionCount;
}

type 批量分类结果 = Pick<ArticleBulkActionResult, 'requestedCount' | 'succeededIds' | 'skipped' | 'failed'>;

export function bulkCategoryOutcome(result: 批量分类结果, successMessage: string): CategoryAssignmentOutcome {
  const succeededCount = result.succeededIds.length;
  const skippedCount = result.skipped.length;
  const failedCount = result.failed.length;

  if (succeededCount === result.requestedCount && skippedCount === 0 && failedCount === 0) {
    return { status: 'success', message: successMessage };
  }

  if (succeededCount > 0) {
    return { status: 'partial', succeededCount, skippedCount, failedCount };
  }

  return {
    status: 'failure',
    message: '文章尚未分类，请检查文章状态后重试。',
    succeededCount,
    skippedCount,
    failedCount,
  };
}

export function assignmentFailure(error: unknown, fallback = '分类失败，请重试'): CategoryAssignmentOutcome {
  return {
    status: 'failure',
    message: error instanceof Error && error.message ? error.message : fallback,
  };
}
