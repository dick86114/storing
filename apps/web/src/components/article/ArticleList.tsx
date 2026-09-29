'use client';

import { useRef, useEffect } from 'react';
import { WechatArticleCard } from '@/components/article/WechatArticleCard';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useListScrollRoot } from '@/lib/listScroll';
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
 onPublish?: (id: number, e: React.MouseEvent) => void;
 showMenu?: boolean;
  highlightId?: number | null;
  selectable?: boolean;
  selectedArticleIds?: Set<number>;
  onSelectionChange?: (id: number, selected: boolean, e: React.MouseEvent) => void;
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
 onPublish,
 showMenu = true,
  highlightId,
  selectable = false,
  selectedArticleIds = new Set(),
  onSelectionChange,
}: ArticleListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { layout } = useTheme();
  const scrollRoot = useListScrollRoot();
  const isListLayout = layout === 'list';

  // IntersectionObserver 监听哨兵元素（列表排版下以右栏滚动容器为 root）
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
      { root: scrollRoot, rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, articles.length, scrollRoot]);

  if (articles.length === 0 && !loadingMore) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        {emptyTitle}
      </div>
    );
  }

  return (
    <>
      {/* 响应式网格布局 / 单列横向行布局 */}
      <div
        className={isListLayout ? 'article-list-rows' : 'article-grid article-stream'}
        style={isListLayout
          ? { display: 'flex', flexDirection: 'column', gap: '10px' }
          : {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
      >
        {articles.map((article, index) => (
          <WechatArticleCard
            key={article.id}
            article={article}
            onClick={onArticleClick}
            onToggleFavorite={onToggleFavorite}
           onArchive={onArchive}
           onPublish={onPublish}
           showMenu={showMenu}
            selectable={selectable}
            selected={selectedArticleIds.has(article.id)}
            onSelectionChange={onSelectionChange}
            highlight={highlightId === article.id}
            variant={isListLayout ? 'row' : 'grid'}
            featured={!isListLayout && index === 0}
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
