'use client';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourceSidebarProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
  currentSort: string;
  onSortChange: (sort: string) => void;
}

export function SourceSidebar({
  sources,
  activeSource,
  totalCount,
  onSelect,
  currentSort,
  onSortChange,
}: SourceSidebarProps) {
  return (
    <aside
      style={{
        width: '240px',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      {/* 排序选择器 */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            color: 'var(--text)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <option value="count">按文章数量排序</option>
          <option value="name">按名称排序</option>
          <option value="latest">按最近收录</option>
        </select>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {/* 全部 */}
        <li
          onClick={() => onSelect('all')}
          tabIndex={0}
          role="button"
          aria-selected={activeSource === 'all'}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('all')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            color: activeSource === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeSource === 'all' ? 'var(--accent-soft)' : 'transparent',
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

        {/* 各公众号 */}
        {sources.map((src) => {
          const isActive = activeSource === src.source;
          return (
            <li
              key={src.source}
              onClick={() => onSelect(src.source)}
              tabIndex={0}
              role="button"
              aria-selected={isActive}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(src.source)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
              }}
            >
              <span>{src.source}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{src.count}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}