'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { AppstoreOutlined, HeartOutlined, FolderOutlined, BookOutlined, ExportOutlined, MoreOutlined } from '@ant-design/icons';
import { APP_NAV_ITEMS, PRIMARY_NAV_KEYS, SECONDARY_NAV_KEYS, isSecondaryNavKey, type AppNavKey } from '@/lib/navigation';

const NAV_ICONS = {
  inbox: AppstoreOutlined,
  favorites: HeartOutlined,
  archive: FolderOutlined,
  published: ExportOutlined,
  wiki: BookOutlined,
} satisfies Record<Exclude<AppNavKey, 'collect'>, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>;

interface MobileBottomTabProps {
  counts: { inbox: number; favorites: number; archive: number; published?: number; wiki?: number };
  activeKey: AppNavKey | null;
  onNavigate: (key: AppNavKey) => void;
}

export function MobileBottomTab({ counts, activeKey, onNavigate }: MobileBottomTabProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!moreOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [moreOpen]);

  if (!isAuthenticated) return null;

  const navigateTo = (key: AppNavKey) => {
    setMoreOpen(false);
    onNavigate(key);
    router.push(APP_NAV_ITEMS[key].href, { scroll: false });
  };

  return (
    <>
      {moreOpen && (
        <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)}>
          <section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="更多功能" onClick={(event) => event.stopPropagation()}>
            <span className="mobile-more-sheet-handle" aria-hidden="true" />
            <p className="mobile-more-sheet-title">更多功能</p>
            <div className="mobile-more-sheet-list">
              {SECONDARY_NAV_KEYS.map((key) => {
                const item = APP_NAV_ITEMS[key];
                const Icon = NAV_ICONS[key];
                const isActive = activeKey === key;
                const count = counts[key] ?? 0;
                return (
                  <button key={key} className={`mobile-more-option${isActive ? ' active' : ''}`} type="button" onClick={() => navigateTo(key)}>
                    <span className="mobile-more-option-icon"><Icon /></span>
                    <span className="mobile-more-option-copy">
                      <strong>{item.label}</strong>
                      <small>{key === 'published' ? '管理已公开文章' : '浏览知识库内容'}</small>
                    </span>
                    <span className="mobile-more-option-count">{count}</span>
                  </button>
                );
              })}
            </div>
            <button className="mobile-more-sheet-cancel" type="button" onClick={() => setMoreOpen(false)}>
              取消
            </button>
          </section>
        </div>
      )}

      <nav
        className="bottom-tab-bar"
        aria-label="主要导航"
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
        {PRIMARY_NAV_KEYS.map((key) => {
          const item = APP_NAV_ITEMS[key];
          const Icon = NAV_ICONS[key];
          const isActive = activeKey === key;
          const count = counts[key] ?? 0;

          return (
            <button key={key} className={`bottom-tab-button${isActive ? ' active' : ''}`} onClick={() => navigateTo(key)} type="button">
              <div className="bottom-tab-icon-wrap">
                <Icon className={`bottom-tab-icon bottom-tab-icon--${key}`} />
                {count > 0 && <span className="bottom-tab-count">{count > 99 ? '99+' : count}</span>}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}

        <button className={`bottom-tab-button bottom-tab-more${isSecondaryNavKey(activeKey) || moreOpen ? ' active' : ''}`} onClick={() => setMoreOpen(true)} type="button" aria-haspopup="dialog" aria-expanded={moreOpen}>
          <div className="bottom-tab-icon-wrap"><MoreOutlined className="bottom-tab-icon" /></div>
          <span>更多</span>
        </button>
      </nav>
    </>
  );
}
