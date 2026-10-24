'use client';

import { PlusOutlined, SettingOutlined } from '@ant-design/icons';

import type { ArchiveCategory } from '@/lib/api';

type CategoryNavigationProps = {
  categories: ArchiveCategory[];
  activeCategoryId: number | null;
  counts: Record<number, number>;
  totalCount: number;
  onSelect: (categoryId: number | null) => void;
  onCreate?: () => void;
  onManage?: () => void;
  compact?: boolean;
};

export function CategoryNavigation({
  categories,
  activeCategoryId,
  counts,
  totalCount,
  onSelect,
  onCreate,
  onManage,
  compact = false,
}: CategoryNavigationProps) {
  const items = [{ id: null, name: '全部归档', color: null, isSystem: false }, ...categories];
  return (
    <>
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
      {(onCreate || onManage) && (
        <div className={`category-navigation-actions${compact ? ' category-navigation-actions--compact' : ''}`}>
          {onCreate && <button type="button" onClick={onCreate}><PlusOutlined aria-hidden="true" />新建分类</button>}
          {onManage && <button type="button" onClick={onManage}><SettingOutlined aria-hidden="true" />管理分类</button>}
        </div>
      )}
      {totalCount === 0 && (
        <p className={`category-navigation-hint${compact ? ' category-navigation-hint--compact' : ''}`} role="note">
          分类只展示已归档文章。把收件箱里的文章归档后，就会出现在这里。
        </p>
      )}
    </>
  );
}
