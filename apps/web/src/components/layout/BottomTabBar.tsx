'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { InboxIcon, HeartIcon, ArchiveIcon } from './TabIcons';

const tabs = [
  { key: 'inbox', href: '/inbox', Icon: InboxIcon },
  { key: 'favorites', href: '/favorites', Icon: HeartIcon },
  { key: 'archive', href: '/archive', Icon: ArchiveIcon },
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
        height: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(0, 0, 0, 0.1)',
        zIndex: 50,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;
        const color = isActive ? '#007AFF' : '#8E8E93';

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            aria-label={tab.key}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 50,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <tab.Icon size={24} color={color} filled={isActive} />

            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 'calc(50% - 14px)',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: '#fff',
                  background: '#FF3B30',
                  borderRadius: 9,
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