'use client';

import { getCategoryColor } from '@/lib/categoryColors';

interface CategoryCount {
  category: string;
  count: number;
}

interface WechatCategoryPillsProps {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}

export function WechatCategoryPills({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: WechatCategoryPillsProps) {
  const allCategories = [{ category: 'all', count: totalCount }, ...categories];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 8px',
        background: 'var(--card-bg)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      className="hide-scrollbar"
    >
      {allCategories.map((cat) => {
        const isActive = activeCategory === cat.category;
        // "全部"用 accent，其他分类用彩色圆点颜色
        const catColor = cat.category === 'all'
          ? { text: 'var(--accent)', bg: 'var(--accent-soft)' }
          : getCategoryColor(cat.category);

        return (
          <button
            key={cat.category}
            onClick={() => onSelect(cat.category)}
            type="button"
            aria-pressed={isActive}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              border: `1px solid ${isActive ? catColor.text : 'var(--border)'}`,
              color: isActive ? catColor.text : 'var(--text-secondary)',
              background: isActive ? catColor.bg : 'transparent',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {cat.category === 'all' ? '全部' : cat.category}
          </button>
        );
      })}
    </div>
  );
}