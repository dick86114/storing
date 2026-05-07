'use client';

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (totalPages > 7 && p > 2 && p < totalPages - 1 && Math.abs(p - currentPage) > 1) {
      if (p === 3 || p === totalPages - 2) pages.push('ellipsis');
      continue;
    }
    pages.push(p);
  }

  return (
    <nav className="flex items-center justify-center" style={{ gap: 'var(--gap-xs)', marginTop: 'var(--gap-lg)', paddingTop: 'var(--gap-md)' }}>
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="inline-flex items-center justify-center border rounded"
        style={{
          minWidth: 34,
          height: 34,
          padding: '0 8px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--muted)',
          background: 'var(--glass)',
          borderColor: 'var(--glass-border)',
          opacity: currentPage === 1 ? 0.35 : 1,
        }}
        aria-label="上一页"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', margin: '0 var(--gap-sm)' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="inline-flex items-center justify-center border rounded"
            style={{
              minWidth: 34,
              height: 34,
              padding: '0 8px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: p === currentPage ? 'var(--accent)' : 'var(--muted)',
              background: p === currentPage ? 'var(--accent-soft)' : 'var(--glass)',
              borderColor: p === currentPage ? 'var(--accent)' : 'var(--glass-border)',
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="inline-flex items-center justify-center border rounded"
        style={{
          minWidth: 34,
          height: 34,
          padding: '0 8px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--muted)',
          background: 'var(--glass)',
          borderColor: 'var(--glass-border)',
          opacity: currentPage === totalPages ? 0.35 : 1,
        }}
        aria-label="下一页"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </nav>
  );
}
