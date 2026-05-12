'use client';

import { getCategoryColor } from '@/lib/categoryColors';

interface CategoryCount {
  category: string;
  count: number;
}

interface WechatCategorySidebarProps {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}

export function WechatCategorySidebar({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: WechatCategorySidebarProps) {
  return (
    <aside
      style={{
        width: '240px',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '12px' }}>
        分类筛选
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {/* 全部 */}
        <li
          onClick={() => onSelect('all')}
          tabIndex={0}
          role="button"
          aria-selected={activeCategory === 'all'}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('all')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            color: activeCategory === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeCategory === 'all' ? 'var(--accent-soft)' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            cursor: 'pointer',
          }}
        >
          <span>全部文章</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{totalCount}</span>
        </li>

        {/* 各分类 */}
        {categories.map((cat) => {
          const isActive = activeCategory === cat.category;
          const catColor = getCategoryColor(cat.category);

          return (
            <li
              key={cat.category}
              onClick={() => onSelect(cat.category)}
              tabIndex={0}
              role="button"
              aria-selected={isActive}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(cat.category)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                color: isActive ? catColor.text : 'var(--text-secondary)',
                background: isActive ? catColor.bg : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: catColor.text,
                  }}
                />
                {cat.category}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat.count}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}