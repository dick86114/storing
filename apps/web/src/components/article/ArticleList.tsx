'use client';

import { Pagination } from '@/components/ui/Pagination';
import { WechatArticleCard } from '@/components/article/WechatArticleCard';
import type { ArticleListItem } from '@storing/shared';

interface ArticleListProps {
  articles: ArticleListItem[];
  currentPage: number;
  totalPages: number;
  emptyTitle?: string;
  onPageChange: (page: number) => void;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
  highlightId?: number | null;
}

export function ArticleList({
  articles,
  currentPage,
  totalPages,
  emptyTitle = '暂无文章',
  onPageChange,
  onArticleClick,
  onToggleFavorite,
  onArchive,
  highlightId,
}: ArticleListProps) {
  if (articles.length === 0) {
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

      {/* 分页 */}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}