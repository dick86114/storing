'use client';

import { useRef, useEffect, useCallback, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface HorizontalScrollContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void; // 实时滚动进度回调
}

const TAB_KEYS = ['inbox', 'favorites', 'archive'];

export function HorizontalScrollContainer({
  children,
  activeIndex,
  onIndexChange,
  onScrollProgress,
}: HorizontalScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef<number | null>(null);

  // 滚动到指定 tab
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollLeft = index * container.offsetWidth;
    container.scrollTo({
      left: scrollLeft,
      behavior: 'smooth',
    });
  }, []);

  // 初始化滚动位置（只在首次挂载时）
  const initialIndex = useRef(activeIndex);
  useEffect(() => {
    scrollToIndex(initialIndex.current);
  }, [scrollToIndex]);

  // 监听滚动，使用 requestAnimationFrame 优化性能
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    let lastIndex = activeIndex;

    const updateScroll = () => {
      const scrollLeft = container.scrollLeft;
      const width = container.offsetWidth;
      const progress = scrollLeft / width; // 0~2 的连续值

      // 实时通知进度（用于指示器动画）
      if (onScrollProgress) {
        onScrollProgress(progress);
      }

      // 计算当前索引
      const newIndex = Math.round(progress);

      // 只在索引变化时更新 state（减少重渲染）
      if (newIndex !== lastIndex && newIndex >= 0 && newIndex < TAB_KEYS.length) {
        lastIndex = newIndex;
        onIndexChange(newIndex);
      }
    };

    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);

      // 使用 requestAnimationFrame 节流，避免卡顿
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateScroll);

      // URL 更新保持延迟
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
        const finalIndex = Math.round(container.scrollLeft / container.offsetWidth);
        if (finalIndex >= 0 && finalIndex < TAB_KEYS.length) {
          const newPath = `/${TAB_KEYS[finalIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [activeIndex, onIndexChange, onScrollProgress, router, pathname]);

  // 点击 tab 时滚动
  useEffect(() => {
    if (!isScrolling) {
      scrollToIndex(activeIndex);
    }
  }, [activeIndex, isScrolling, scrollToIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        willChange: 'scroll-position',
      }}
      className="hide-scrollbar"
    >
      {children.map((child, index) => (
        <div
          key={index}
          style={{
            width: '100vw',
            flexShrink: 0,
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            overflowY: 'auto',
            willChange: 'transform',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export { TAB_KEYS };