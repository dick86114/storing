'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { WechatArticleCard } from '@/components/article/WechatArticleCard';

interface Article {
  id: number;
  title: string;
  author: string | null;
  source: string | null;
  publishTime: string;
  coverImage: string | null;
  isFavorited: boolean;
  isArchived: boolean;
  aiCategory?: string;
}

interface ArticleListProps {
  articles: Article[];
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
  const router = useRouter();
  const searchParams = useSearchParams();

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
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              type="button"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                background: currentPage === page ? 'var(--accent)' : 'var(--card-bg)',
                color: currentPage === page ? '#fff' : 'var(--text)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </>
  );
}