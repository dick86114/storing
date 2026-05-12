'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SwipeableContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  tabKeys: string[];
}

export function SwipeableContainer({
  children,
  activeIndex,
  onIndexChange,
  tabKeys,
}: SwipeableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isSwiping = useRef(false);
  const currentIndex = useRef(activeIndex);

  // 程序化滚动到目标页面
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const targetScroll = activeIndex * container.offsetWidth;

    // 使用 instant 行为避免与用户滑动冲突
    container.scrollTo({ left: targetScroll, behavior: 'instant' });
    currentIndex.current = activeIndex;
  }, [activeIndex]);

  // 初始化位置
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.scrollLeft = activeIndex * container.offsetWidth;
  }, []);

  // Touch 事件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      isSwiping.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      touchEndX.current = e.changedTouches[0].clientX;
      const deltaX = touchEndX.current - touchStartX.current;
      const threshold = 50;

      if (Math.abs(deltaX) > threshold) {
        const direction = deltaX > 0 ? -1 : 1; // 向右滑是后退，向左滑是前进
        const newIndex = currentIndex.current + direction;

        if (newIndex >= 0 && newIndex < tabKeys.length) {
          currentIndex.current = newIndex;
          onIndexChange(newIndex);

          // 更新 URL
          const newPath = `/${tabKeys[newIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onIndexChange, router, pathname, tabKeys]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: 'calc(100vh - 100px)', // 顶部导航44px + 底部Tab56px
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      className="hide-scrollbar"
    >
      {children.filter(Boolean).map((child, index) => (
        <div
          key={index}
          style={{
            width: '100vw',
            height: '100%',
            flexShrink: 0,
            overflowY: 'auto',
            paddingBottom: '56px',
            boxSizing: 'border-box',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}