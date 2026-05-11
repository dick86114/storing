'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { InboxIcon, HeartIcon, ArchiveIcon } from './TabIcons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: InboxIcon },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartIcon },
  { key: 'archive', label: '归档', href: '/archive', Icon: ArchiveIcon },
];

interface BottomTabBarProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
  scrollProgress?: number;
}

export function BottomTabBar({ counts, activeIndex, onTabChange, scrollProgress }: BottomTabBarProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // 游客模式隐藏
  if (!isAuthenticated) return null;

  const currentIndex = scrollProgress !== undefined ? Math.round(scrollProgress) : activeIndex;

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <nav
      className="bottom-tab-bar"
      aria-label="底部导航"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 64,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 50,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            aria-label={tab.label}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              height: 64,
              padding: '8px 0',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.15s ease',
            }}
          >
            {/* 图标 */}
            <tab.Icon
              size={26}
              filled={isActive}
              color={isActive ? 'var(--accent)' : 'var(--muted)'}
            />

            {/* 文字标签 */}
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {tab.label}
            </span>

            {/* 数字徽章 */}
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: '50%',
                  transform: 'translateX(14px)',
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--fg)',
                  background: 'var(--accent)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}