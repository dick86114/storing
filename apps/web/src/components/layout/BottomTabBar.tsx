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
  isScrolling?: boolean; // 是否正在滚动
}

export function BottomTabBar({ counts, activeIndex, onTabChange, scrollProgress, isScrolling }: BottomTabBarProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // 游客模式隐藏
  if (!isAuthenticated) return null;

  // 正在滚动时用 scrollProgress，否则用 activeIndex
  const currentIndex = (isScrolling && scrollProgress !== undefined)
    ? Math.round(scrollProgress)
    : activeIndex;

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
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 12px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        // 半透明背景 - 使用 CSS 变量适配浅色/深色模式
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
            onClick={() => handleTabClick(index, tab.href)}
            aria-label={tab.label}
            type="button"
            style={{
              // 每个 tab 占据等宽，图标居中
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 0',
              // 激活的 tab 多一层半透明背景
              background: isActive
                ? 'var(--accent-soft)'
                : 'transparent',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
              outline: 'none',
              maxWidth: 120,
            }}
          >
            {/* 图标 - 激活时点亮 */}
            <tab.Icon
              size={22}
              filled={isActive}
              color={isActive ? 'var(--accent)' : 'var(--muted)'}
            />

            {/* 数字 - 激活时点亮 */}
            {count > 0 && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-body)',
                  // 激活时用 accent 色，未激活用 muted 色
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
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