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
        bottom: 8,
        left: 16,
        right: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '6px 8px',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderRadius: 24,
        boxShadow: 'var(--shadow-md)',
        zIndex: 100,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;

        return (
          <button
            key={tab.key}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTabClick(index, tab.href);
            }}
            aria-label={tab.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 14px',
              background: isActive ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 16,
              cursor: 'pointer',
              transition: 'background 0.15s ease, color 0.15s ease',
              color: isActive ? 'white' : 'var(--muted)',
            }}
          >
            {/* 图标 */}
            <tab.Icon
              size={22}
              filled={isActive}
              color={isActive ? 'white' : 'var(--muted)'}
            />

            {/* 数字 - 直接放在图标右侧 */}
            {count > 0 && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-body)',
                  color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--accent)',
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