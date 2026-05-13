'use client';

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
        padding: '12px 16px',
        background: 'var(--card-bg)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      className="hide-scrollbar"
    >
      {allCategories.map((cat) => {
        const isActive = activeCategory === cat.category;

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
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
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