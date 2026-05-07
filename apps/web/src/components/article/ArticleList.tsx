'use client';

import { ArticleCard } from './ArticleCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import type { ArticleListItem } from '@storing/shared';

export function ArticleList({
  articles,
  currentPage,
  totalPages,
  emptyTitle,
  emptyDescription,
  onPageChange,
  onArticleClick,
  onToggleFavorite,
  onArchive,
}: {
  articles: ArticleListItem[];
  currentPage: number;
  totalPages: number;
  emptyTitle: string;
  emptyDescription?: string;
  onPageChange: (page: number) => void;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
}) {
  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--gap-md)', minWidth: 0 }}>
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
          article={a}
          onClick={() => onArticleClick(a.id)}
          onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
          onArchive={(e) => onArchive(a.id, e)}
        />
      ))}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
