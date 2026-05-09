'use client';

import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { TAB_KEYS } from '@/components/layout/HorizontalScrollContainer';

const allTabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', requireAuth: true },
  { key: 'favorites', label: '收藏', href: '/favorites', requireAuth: true },
  { key: 'archive', label: '归档', href: '/archive', requireAuth: false },
];

interface TabsBarProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
  scrollProgress?: number; // 0~2 的滚动进度，用于丝滑动画
}

export function TabsBar({ counts, activeIndex, onTabChange, scrollProgress }: TabsBarProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 游客不显示 tab bar（只看归档页，无需切换）
  const visibleTabs = allTabs.filter(tab => !tab.requireAuth || isAuthenticated);
  const shouldHide = !isAuthenticated && visibleTabs.length <= 1;

  // 实时更新指示器位置（丝滑动画）
  useEffect(() => {
    if (shouldHide || !containerRef.current || !indicatorRef.current) return;

    const progress = scrollProgress ?? activeIndex;
    const targetIndex = Math.round(progress);
    const targetTab = tabRefs.current[targetIndex];

    if (targetTab) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tabRect = targetTab.getBoundingClientRect();
      const offset = tabRect.left - containerRect.left + (tabRect.width - 54) / 2;

      indicatorRef.current.style.transform = `translateX(${offset}px)`;
    }
  }, [shouldHide, scrollProgress, activeIndex, visibleTabs.length]);

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  // 游客状态下不渲染 tab bar
  if (shouldHide) {
    return null;
  }

  return (
    <div style={{ background: 'var(--bg)' }}>
      <div
        ref={containerRef}
        className="mx-auto flex overflow-x-auto hide-scrollbar"
        style={{ maxWidth: 'var(--container)', paddingInline: 'var(--gutter)', position: 'relative' }}
      >
        {visibleTabs.map((tab, index) => {
          const actualIndex = TAB_KEYS.findIndex(k => k === tab.key);
          const active = activeIndex === actualIndex;
          return (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[actualIndex] = el; }}
              onClick={() => handleTabClick(actualIndex, tab.href)}
              className="relative whitespace-nowrap"
              style={{
                padding: '11px 18px',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                color: active ? 'var(--accent)' : 'var(--muted)',
                textDecoration: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
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
                {counts[tab.key as keyof typeof counts] ?? 0}
              </span>
            </button>
          );
        })}
        {/* 指示器使用 transform 动画，GPU 加速 */}
        <span
          ref={indicatorRef}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 2,
            width: 54,
            background: 'var(--accent)',
            borderRadius: 2,
            transform: 'translateX(18px)',
            willChange: 'transform',
            transition: scrollProgress === undefined ? 'transform 0.15s ease' : 'none',
          }}
        />
      </div>
    </div>
  );
}