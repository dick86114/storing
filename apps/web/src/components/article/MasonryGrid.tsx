'use client';

import { useRef, useEffect, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<ArticleListItem[][]>([]);
  const [columnCount, setColumnCount] = useState(3);

  // 根据屏幕宽度计算列数
  useEffect(() => {
    function updateColumnCount() {
      const width = window.innerWidth;
      if (width < 640) setColumnCount(1);
      else if (width < 960) setColumnCount(2);
      else setColumnCount(3);
    }
    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  // 将文章分配到各列（最小高度优先算法）
  useEffect(() => {
    if (articles.length === 0) {
      setColumns([]);
      return;
    }

    // 初始化列
    const cols: ArticleListItem[][] = Array.from({ length: columnCount }, () => []);
    const colHeights: number[] = Array.from({ length: columnCount }, () => 0);

    // 模拟高度：有图片的约 200px + 内容约 80px，无图片约 80px
    const estimateHeight = (article: ArticleListItem) => {
      return article.coverImage ? 280 : 80;
    };

    // 按顺序分配到最短的列
    for (const article of articles) {
      const minHeightIndex = colHeights.indexOf(Math.min(...colHeights));
      cols[minHeightIndex].push(article);
      colHeights[minHeightIndex] += estimateHeight(article);
    }

    setColumns(cols);
  }, [articles, columnCount]);

  if (isLoading) {
    return (
      <div className="masonry-grid" style={{ display: 'flex', gap: 'var(--gap-md)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ flex: 1 }} />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="masonry-grid"
        style={{ display: 'flex', gap: 'var(--gap-md)' }}
      >
        {columns.map((colArticles, colIndex) => (
          <div
            key={colIndex}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--gap-md)',
            }}
          >
            {colArticles.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                variant="masonry"
                onClick={() => onArticleClick(a.id)}
                onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
                onArchive={(e) => onArchive(a.id, e)}
                isHighlighted={highlightId === a.id}
              />
            ))}
          </div>
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