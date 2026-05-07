'use client';

import { useTheme } from '@/components/providers/ThemeProvider';

export function TopNav({ onSearchOpen }: { onSearchOpen: () => void }) {
  const { resolved, toggle } = useTheme();

  return (
    <header
      className="sticky top-0 z-[100] border-b"
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{
          maxWidth: 'var(--container)',
          padding: '10px var(--gutter)',
          gap: 'var(--gap-md)',
        }}
      >
        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
          <div
            className="grid place-items-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14, color: 'var(--surface)' }}
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <span
            className="font-semibold tracking-tight hidden sm:inline"
            style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}
          >
            Storing
          </span>
        </div>

        <div className="flex items-center shrink-0" style={{ gap: 6 }}>
          <button
            onClick={onSearchOpen}
            className="flex items-center rounded border"
            style={{
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              background: 'var(--glass)',
              borderColor: 'var(--glass-border)',
              color: 'var(--muted)',
              fontSize: 'var(--fs-sm)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="搜索"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14, flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden sm:inline">搜索文章…</span>
            <kbd
              className="hidden sm:inline-block rounded border"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '2px 5px',
                background: 'var(--fg-soft)',
                borderColor: 'var(--border)',
                color: 'var(--muted)',
                marginLeft: 8,
              }}
            >
              ⌘K
            </kbd>
          </button>
          <button
            onClick={toggle}
            className="grid place-items-center rounded"
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--muted)',
            }}
            aria-label="切换主题"
          >
            {resolved === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
