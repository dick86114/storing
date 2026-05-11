'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface HorizontalScrollContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  onScrollingChange?: (isScrolling: boolean) => void; // 滚动状态回调
  isMobile?: boolean;
}

const TAB_KEYS = ['inbox', 'favorites', 'archive'];

export function HorizontalScrollContainer({
  children,
  activeIndex,
  onIndexChange,
  onScrollProgress,
  onScrollingChange,
  isMobile = false,
}: HorizontalScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isProgrammaticScroll = useRef(false);
  const lastActiveIndex = useRef(activeIndex);

  // 监听 activeIndex 变化，程序触发滚动
  useEffect(() => {
    if (!containerRef.current) return;
    if (lastActiveIndex.current === activeIndex) return;

    const container = containerRef.current;
    const targetScroll = activeIndex * container.offsetWidth;

    isProgrammaticScroll.current = true;
    container.style.scrollSnapType = 'none';
    container.scrollLeft = targetScroll;

    requestAnimationFrame(() => {
      container.style.scrollSnapType = 'x mandatory';
      isProgrammaticScroll.current = false;
    });

    lastActiveIndex.current = activeIndex;
  }, [activeIndex]);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.scrollLeft = activeIndex * container.offsetWidth;
    lastActiveIndex.current = activeIndex;
  }, []);

  // 监听用户滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastIndex = activeIndex;
    let scrollEndTimer: NodeJS.Timeout;

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;

      // 滚动开始，通知正在滚动
      if (onScrollingChange) onScrollingChange(true);
      clearTimeout(scrollEndTimer);

      scrollEndTimer = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const width = container.offsetWidth;
        const progress = scrollLeft / width;

        if (onScrollProgress) onScrollProgress(progress);

        const newIndex = Math.round(progress);
        if (newIndex !== lastIndex && newIndex >= 0 && newIndex < TAB_KEYS.length) {
          lastIndex = newIndex;
          onIndexChange(newIndex);

          const newPath = `/${TAB_KEYS[newIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }

        // 滚动结束，通知停止滚动
        if (onScrollingChange) onScrollingChange(false);
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollEndTimer);
    };
  }, [activeIndex, onIndexChange, onScrollProgress, onScrollingChange, router, pathname]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 104px)',
        overflowX: 'auto',
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
            scrollSnapAlign: 'start',
            overflowY: 'auto',
            paddingBottom: isMobile ? '72px' : '0',
            boxSizing: 'border-box',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export { TAB_KEYS };