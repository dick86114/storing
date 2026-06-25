'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { AppstoreOutlined, HeartOutlined, FolderOutlined, BookOutlined } from '@ant-design/icons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
  { key: 'wiki', label: 'Wiki', href: '/wiki', Icon: BookOutlined },
];

interface MobileBottomTabProps {
  counts: { inbox: number; favorites: number; archive: number; wiki?: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function MobileBottomTab({ counts, activeIndex, onTabChange }: MobileBottomTabProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const visibleTabs = tabs
    .map((tab, index) => ({ ...tab, index }))
    .filter((tab) => isAuthenticated || tab.key === 'archive' || tab.key === 'wiki');

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 'calc(66px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--nav-bg)',
        borderTop: '0.5px solid var(--border)',
        zIndex: 100,
      }}
    >
      {visibleTabs.map((tab) => {
        const isActive = activeIndex === tab.index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;

        return (
          <button
            key={tab.key}
            className={`bottom-tab-button${isActive ? ' active' : ''}`}
            onClick={() => handleTabClick(tab.index, tab.href)}
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
            <div className="bottom-tab-icon-wrap" style={{ position: 'relative', display: 'inline-flex' }}>
              <tab.Icon
                className={`bottom-tab-icon bottom-tab-icon--${tab.key}`}
                style={{
                  fontSize: '24px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              {count > 0 && (
                <span
                  className="bottom-tab-count"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    left: '14px',
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
