'use client';

import { SyncOutlined } from '@ant-design/icons';
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
  onReclassifyAll?: () => void;
  reclassifyingAll?: boolean;
}

export function WechatCategorySidebar({
  categories,
  activeCategory,
  totalCount,
  onSelect,
  onReclassifyAll,
  reclassifyingAll,
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

      {/* 重新分类所有 */}
      {onReclassifyAll && (
        <button
          onClick={onReclassifyAll}
          disabled={reclassifyingAll}
          style={{
            marginTop: '16px',
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: '1px solid var(--border)',
            cursor: reclassifyingAll ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            opacity: reclassifyingAll ? 0.6 : 1,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { if (!reclassifyingAll) e.currentTarget.style.background = 'var(--accent-soft)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <SyncOutlined spin={reclassifyingAll} />
          {reclassifyingAll ? '分类中...' : '重新分类所有'}
        </button>
      )}
    </aside>
  );
}