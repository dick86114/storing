'use client';

import { ArticleCard } from './ArticleCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ArticleListItem } from '@storing/shared';

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
  highlightId,
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
  highlightId?: number | null;
}) {
  if (isLoading) {
    return (
      <div className="masonry-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="masonry-grid">
        {articles.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            onClick={() => onArticleClick(a.id)}
            onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
            onArchive={(e) => onArchive(a.id, e)}
            isHighlighted={highlightId === a.id}
          />
        ))}
      </div>

      {isLoadingMore && (
        <div className="loading-more">
          加载中…
        </div>
      )}

      {isReachingEnd && articles.length > 0 && (
        <div className="loading-more" style={{ opacity: 0.6 }}>
          没有更多了
        </div>
      )}
    </>
  );
}