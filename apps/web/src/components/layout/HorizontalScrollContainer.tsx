'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface HorizontalScrollContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onScrollProgress?: (progress: number) => void;
  isMobile?: boolean;
}

const TAB_KEYS = ['inbox', 'favorites', 'archive'];

export function HorizontalScrollContainer({
  children,
  activeIndex,
  onIndexChange,
  onScrollProgress,
  isMobile = false,
}: HorizontalScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isProgrammaticScroll = useRef(false); // 是否是程序触发的滚动
  const lastActiveIndex = useRef(activeIndex);

  // 监听 activeIndex 变化，程序触发滚动
  useEffect(() => {
    if (!containerRef.current) return;

    // 跳过初始化
    if (lastActiveIndex.current === activeIndex) return;

    const container = containerRef.current;
    const targetScroll = activeIndex * container.offsetWidth;

    // 设置标记，表示这是程序触发的滚动
    isProgrammaticScroll.current = true;

    // 直接设置 scrollLeft，绕过 scroll snap 的强制锁定
    container.style.scrollSnapType = 'none'; // 临时禁用 scroll snap
    container.scrollLeft = targetScroll;

    // 恢复 scroll snap
    requestAnimationFrame(() => {
      container.style.scrollSnapType = 'x mandatory';
      isProgrammaticScroll.current = false;
    });

    lastActiveIndex.current = activeIndex;
  }, [activeIndex]);

  // 初始化滚动位置
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.scrollLeft = activeIndex * container.offsetWidth;
    lastActiveIndex.current = activeIndex;
  }, []);

  // 监听用户手势滚动（只在非程序滚动时响应）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastIndex = activeIndex;
    let scrollEndTimer: NodeJS.Timeout;

    const handleScroll = () => {
      // 如果是程序触发的滚动，跳过处理
      if (isProgrammaticScroll.current) return;

      clearTimeout(scrollEndTimer);

      scrollEndTimer = setTimeout(() => {
        const scrollLeft = container.scrollLeft;
        const width = container.offsetWidth;
        const progress = scrollLeft / width;

        // 实时通知进度
        if (onScrollProgress) {
          onScrollProgress(progress);
        }

        const newIndex = Math.round(progress);
        if (newIndex !== lastIndex && newIndex >= 0 && newIndex < TAB_KEYS.length) {
          lastIndex = newIndex;
          onIndexChange(newIndex);

          // 更新 URL
          const newPath = `/${TAB_KEYS[newIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollEndTimer);
    };
  }, [activeIndex, onIndexChange, onScrollProgress, router, pathname]);

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