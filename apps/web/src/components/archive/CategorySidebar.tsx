'use client';

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
          {categories.map((cat) => (
            <li
              key={cat.category}
              onClick={() => onSelect(cat.category)}
              className="flex items-center justify-between cursor-pointer"
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--fs-sm)',
                color: activeCategory === cat.category ? 'var(--accent)' : 'var(--muted)',
                background: activeCategory === cat.category ? 'var(--accent-soft)' : 'transparent',
                transition: 'all var(--transition)',
              }}
            >
              <span>{cat.category}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.6 }}>{cat.count}</span>
            </li>
          ))}
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
      {all.map((cat) => (
        <button
          key={cat.category}
          onClick={() => onSelect(cat.category)}
          className="whitespace-nowrap border"
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 12,
            borderColor: activeCategory === cat.category ? 'var(--accent)' : 'var(--border)',
            color: activeCategory === cat.category ? 'var(--accent)' : 'var(--muted)',
            background: activeCategory === cat.category ? 'var(--accent-soft)' : 'transparent',
          }}
        >
          {cat.category === 'all' ? '全部' : cat.category}
        </button>
      ))}
    </div>
  );
}
