'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { TrayIcon, HeartIcon, ArchiveBoxIcon } from './TabIcons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: TrayIcon },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartIcon },
  { key: 'archive', label: '归档', href: '/archive', Icon: ArchiveBoxIcon },
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

  // 游客模式下完全隐藏
  if (!isAuthenticated) {
    return null;
  }

  // 根据滚动进度计算当前活动索引
  const currentIndex = scrollProgress !== undefined ? Math.round(scrollProgress) : activeIndex;

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
        width: '100vw',
        height: 56,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 50,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;
        const color = isActive ? 'var(--accent)' : 'var(--muted)';

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {/* 图标 */}
            <tab.Icon size={24} color={color} />

            {/* 数字徽章 */}
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 'calc(50% - 16px)',
                  minWidth: 12,
                  height: 12,
                  padding: '0 4px',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'white',
                  background: 'var(--accent)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}

            {/* 文字标签 */}
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: color,
                marginTop: 2,
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