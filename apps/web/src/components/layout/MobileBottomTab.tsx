'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { AppstoreOutlined, HeartOutlined, FolderOutlined } from '@ant-design/icons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
];

interface MobileBottomTabProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function MobileBottomTab({ counts, activeIndex, onTabChange }: MobileBottomTabProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '56px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--nav-bg)',
        borderTop: '0.5px solid var(--border)',
        zIndex: 100,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = activeIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            type="button"
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <tab.Icon
                style={{
                  fontSize: '24px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              {count > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    padding: '1px 5px',
                    background: isActive ? 'var(--accent-soft)' : 'var(--tag-bg)',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '10px',
                    borderRadius: '10px',
                    fontWeight: 500,
                    lineHeight: '14px',
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '10px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}