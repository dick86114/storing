'use client';

import type { ArchiveCategory } from '@/lib/api';

type CategoryNavigationProps = {
  categories: ArchiveCategory[];
  activeCategoryId: number | null;
  counts: Record<number, number>;
  totalCount: number;
  onSelect: (categoryId: number | null) => void;
  compact?: boolean;
};

export function CategoryNavigation({ categories, activeCategoryId, counts, totalCount, onSelect, compact = false }: CategoryNavigationProps) {
  const items = [{ id: null, name: '全部文章', color: null, isSystem: false }, ...categories];
  return (
    <nav className={compact ? 'category-navigation category-navigation--compact' : 'category-navigation'} aria-label="归档分类">
      {items.map((category) => {
        const active = category.id === activeCategoryId;
        const count = category.id === null ? totalCount : counts[category.id] ?? 0;
        return (
          <button
            key={category.id ?? 'all'}
            className={`category-navigation-item${active ? ' is-active' : ''}${category.isSystem ? ' is-system' : ''}`}
            type="button"
            onClick={() => onSelect(category.id)}
            aria-pressed={active}
          >
            {category.color && <span className="category-navigation-dot" style={{ background: category.color }} aria-hidden="true" />}
            <span>{category.name}</span>
            <strong>{count}</strong>
          </button>
        );
      })}
    </nav>
  );
}
