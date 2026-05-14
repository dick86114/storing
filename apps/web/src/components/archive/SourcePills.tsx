'use client';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourcePillsProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
}

export function SourcePills({
  sources,
  activeSource,
  totalCount,
  onSelect,
}: SourcePillsProps) {
  const allSources = [{ source: 'all', count: totalCount }, ...sources];

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
      {allSources.map((src) => {
        const isActive = activeSource === src.source;
        return (
          <button
            key={src.source}
            onClick={() => onSelect(src.source)}
            type="button"
            aria-pressed={isActive}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {src.source === 'all' ? '全部' : src.source}
          </button>
        );
      })}
    </div>
  );
}