'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface HorizontalScrollContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  onScrollingChange?: (isScrolling: boolean) => void;
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
  const lastReportedIndex = useRef(activeIndex);

  // 监听 activeIndex 变化，程序触发滚动
  useEffect(() => {
    if (!containerRef.current) return;
    if (lastActiveIndex.current === activeIndex) return;

    const container = containerRef.current;
    const targetScroll = activeIndex * container.offsetWidth;

    isProgrammaticScroll.current = true;
    container.scrollTo({ left: targetScroll, behavior: 'smooth' });

    // 滚动结束后重置标志
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 300);

    lastActiveIndex.current = activeIndex;
    lastReportedIndex.current = activeIndex;
  }, [activeIndex]);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.scrollLeft = activeIndex * container.offsetWidth;
    lastActiveIndex.current = activeIndex;
    lastReportedIndex.current = activeIndex;
  }, []);

  // 监听用户滚动 - 即时响应 + 滚动结束后吸附
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollEndTimer: NodeJS.Timeout;
    let rafId: number | null = null;

    const updateProgress = () => {
      if (isProgrammaticScroll.current) return;

      const scrollLeft = container.scrollLeft;
      const width = container.offsetWidth;
      const progress = scrollLeft / width;

      // 即时通知进度（用于 Tab 激活状态）
      if (onScrollProgress) {
        onScrollProgress(progress);
      }

      // 即时计算并更新索引
      const newIndex = Math.round(progress);
      if (newIndex !== lastReportedIndex.current && newIndex >= 0 && newIndex < TAB_KEYS.length) {
        lastReportedIndex.current = newIndex;
        onIndexChange(newIndex);
      }
    };

    const handleScroll = () => {
      if (isProgrammaticScroll.current) return;

      // 通知正在滚动
      if (onScrollingChange) onScrollingChange(true);
      clearTimeout(scrollEndTimer);

      // 使用 requestAnimationFrame 即时更新
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateProgress);

      // 滚动结束后吸附到最近的页面
      scrollEndTimer = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const width = container.offsetWidth;
        const currentIndex = scrollLeft / width;
        const targetIndex = Math.round(currentIndex);
        const targetScroll = targetIndex * width;

        // 如果当前位置不是整数页面，吸附过去
        if (Math.abs(scrollLeft - targetScroll) > 10) {
          isProgrammaticScroll.current = true;
          container.scrollTo({ left: targetScroll, behavior: 'smooth' });
          setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 300);
        }

        // 更新 URL
        if (targetIndex >= 0 && targetIndex < TAB_KEYS.length) {
          const newPath = `/${TAB_KEYS[targetIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }
        if (onScrollingChange) onScrollingChange(false);
      }, 150); // 增加延迟，让滚动有更多时间稳定
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollEndTimer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [onIndexChange, onScrollProgress, onScrollingChange, router, pathname]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 104px)',
        overflowX: 'auto',
        scrollBehavior: 'smooth', // 平滑滚动
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