'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';

const allTabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', requireAuth: true },
  { key: 'favorites', label: '收藏', href: '/favorites', requireAuth: true },
  { key: 'archive', label: '归档', href: '/archive', requireAuth: false },
];

export function TabsBar({ counts }: { counts: { inbox: number; favorites: number; archive: number } }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  // 游客只显示 archive 标签
  const visibleTabs = allTabs.filter(tab => !tab.requireAuth || isAuthenticated);

  return (
    <div style={{ background: 'var(--bg)' }}>
      <div
        className="mx-auto flex overflow-x-auto hide-scrollbar"
        style={{ maxWidth: 'var(--container)', paddingInline: 'var(--gutter)' }}
      >
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="relative whitespace-nowrap"
              style={{
                padding: '11px 18px',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: active ? 'var(--accent)' : 'var(--muted)',
                textDecoration: 'none',
              }}
            >
              {tab.label}
              <span
                className="inline-block rounded-full"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '1px 6px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  marginLeft: 5,
                }}
              >
                {counts[tab.key] ?? 0}
              </span>
              {active && (
                <span
                  className="absolute rounded"
                  style={{
                    bottom: -1,
                    left: 18,
                    right: 18,
                    height: 2,
                    background: 'var(--accent)',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
