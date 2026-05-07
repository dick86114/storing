'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { ArticleCard } from './ArticleCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ArticleListItem } from '@storing/shared';

function useColumns(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(3);
  useLayoutEffect(() => {
    function calc() {
      const w = containerRef.current?.offsetWidth ?? 1200;
      setCols(w < 640 ? 1 : w < 960 ? 2 : 3);
    }
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [containerRef]);
  return cols;
}

export function MasonryGrid({
  articles,
  isLoading,
  isLoadingMore,
  isReachingEnd,
  emptyTitle,
  emptyDescription,
  onLoadMore,
  onArticleClick,
  onToggleFavorite,
  onArchive,
}: {
  articles: ArticleListItem[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  isReachingEnd?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  onLoadMore?: () => void;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  const isReachingEndRef = useRef(isReachingEnd);
  const cols = useColumns(containerRef);
  const gap = 16;

  onLoadMoreRef.current = onLoadMore;
  isReachingEndRef.current = isReachingEnd;

  // 测量每张卡片高度并计算位置
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLElement>('[data-card]');
    if (cards.length === 0) return;

    const containerWidth = container.offsetWidth;
    const colW = (containerWidth - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);

    cards.forEach((card) => {
      const minH = Math.min(...colHeights);
      const colIdx = colHeights.indexOf(minH);

      card.style.position = 'absolute';
      card.style.width = `${colW}px`;
      card.style.left = `${colIdx * (colW + gap)}px`;
      card.style.top = `${minH}px`;

      colHeights[colIdx] += card.offsetHeight + gap;
    });

    container.style.position = 'relative';
    container.style.height = `${Math.max(...colHeights)}px`;
  }, [articles, cols, gap]);

  // scroll 事件触发加载更多（仅当 onLoadMore 存在时启用无限滚动）
  useEffect(() => {
    // 如果没有 onLoadMore，跳过无限滚动逻辑
    if (!onLoadMore) return;

    function checkScroll() {
      const sentinel = sentinelRef.current;
      if (!sentinel || loadingRef.current || isReachingEndRef.current) return;

      const rect = sentinel.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // sentinel 进入视口下方 800px 范围内时触发
      if (rect.top < windowHeight + 800) {
        loadingRef.current = true;
        onLoadMoreRef.current?.();
        setTimeout(() => { loadingRef.current = false; }, 1500);
      }
    }

    // 首次检查（数据刚加载完时 sentinel 可能已在视口内）
    checkScroll();

    window.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      window.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [articles, onLoadMore]); // articles 变化时重新绑定，确保新数据后能继续检查

  if (isLoading) {
    return (
      <div ref={containerRef} className="masonry-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} data-card>
            <div className="skeleton-card" />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div ref={containerRef} className="masonry-grid">
        {articles.map((a) => (
          <div key={a.id} data-card>
            <ArticleCard
              article={a}
              onClick={() => onArticleClick(a.id)}
              onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
              onArchive={(e) => onArchive(a.id, e)}
            />
          </div>
        ))}
      </div>

      {/* 仅在无限滚动模式下显示 sentinel 和加载状态 */}
      {onLoadMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      {onLoadMore && isLoadingMore && (
        <div style={{ padding: 'var(--gap-xl) 0', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
          加载中…
        </div>
      )}

      {onLoadMore && isReachingEnd && articles.length > 0 && (
        <div style={{ padding: 'var(--gap-xl) 0', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-sm)', opacity: 0.6 }}>
          没有更多了
        </div>
      )}
    </>
  );
}
