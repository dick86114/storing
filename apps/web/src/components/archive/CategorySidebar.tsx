'use client';

import { getCategoryColor } from '@/lib/categoryColors';

interface CategoryCount {
  category: string;
  count: number;
}

export function CategorySidebar({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}) {
  return (
    <aside className="hidden md:block" style={{ position: 'sticky', top: 72 }}>
      <div style={{ marginBottom: 'var(--gap-lg)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            marginBottom: 'var(--gap-sm)',
            paddingLeft: 'var(--gap-sm)',
          }}
        >
          分类筛选
        </div>
        <ul className="list-none p-0 m-0 flex flex-col">
          <li
            onClick={() => onSelect('all')}
            className="flex items-center justify-between cursor-pointer"
            style={{
              padding: '7px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--fs-sm)',
              color: activeCategory === 'all' ? 'var(--accent)' : 'var(--muted)',
              background: activeCategory === 'all' ? 'var(--accent-soft)' : 'transparent',
              transition: 'all var(--transition)',
            }}
          >
            <span>全部</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6 }}>{totalCount}</span>
          </li>
          {categories.map((cat) => {
            const catColor = getCategoryColor(cat.category);
            const isActive = activeCategory === cat.category;
            return (
              <li
                key={cat.category}
                onClick={() => onSelect(cat.category)}
                className="flex items-center justify-between cursor-pointer"
                style={{
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--fs-sm)',
                  color: isActive ? catColor.text : 'var(--muted)',
                  background: isActive ? catColor.bg : 'transparent',
                  transition: 'all var(--transition)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: catColor.text,
                      opacity: isActive ? 1 : 0.5,
                    }}
                  />
                  {cat.category}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6 }}>{cat.count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export function CategoryPills({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}) {
  const all = [{ category: 'all', count: totalCount }, ...categories];
  return (
    <div className="flex md:hidden overflow-x-auto" style={{ gap: 'var(--gap-xs)', paddingBottom: 'var(--gap-sm)' }}>
      {all.map((cat) => {
        const isActive = activeCategory === cat.category;
        const catColor = cat.category === 'all'
          ? { bg: 'var(--accent-soft)', text: 'var(--accent)' }
          : getCategoryColor(cat.category);
        return (
          <button
            key={cat.category}
            onClick={() => onSelect(cat.category)}
            className="whitespace-nowrap border"
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              borderColor: isActive ? catColor.text : 'var(--border)',
              color: isActive ? catColor.text : 'var(--muted)',
              background: isActive ? catColor.bg : 'transparent',
            }}
          >
            {cat.category === 'all' ? '全部' : cat.category}
          </button>
        );
      })}
    </div>
  );
}
