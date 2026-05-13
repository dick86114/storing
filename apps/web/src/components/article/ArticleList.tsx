'use client';

import { useRef, useEffect } from 'react';
import { WechatArticleCard } from '@/components/article/WechatArticleCard';
import type { ArticleListItem } from '@storing/shared';

interface ArticleListProps {
  articles: ArticleListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle?: string;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
  highlightId?: number | null;
}

export function ArticleList({
  articles,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyTitle = '暂无文章',
  onArticleClick,
  onToggleFavorite,
  onArchive,
  highlightId,
}: ArticleListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver 监听哨兵元素
  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (articles.length === 0 && !loadingMore) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        {emptyTitle}
      </div>
    );
  }

  return (
    <>
      {/* 响应式网格布局 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {articles.map((article) => (
          <WechatArticleCard
            key={article.id}
            article={article}
            onClick={() => onArticleClick(article.id)}
            onToggleFavorite={(e) => onToggleFavorite(article.id, e)}
            onArchive={(e) => onArchive(article.id, e)}
            highlight={highlightId === article.id}
          />
        ))}
      </div>

      {/* 底部哨兵 + 加载状态 */}
      <div ref={sentinelRef} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
        {loadingMore ? '加载中...' : !hasMore && articles.length > 0 ? '没有更多了' : ''}
      </div>
    </>
  );
}
