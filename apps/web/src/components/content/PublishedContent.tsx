'use client';

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { ArticleList } from '@/components/article/ArticleList';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { api } from '@/lib/api';

export function PublishedContent() {
  const { isAuthenticated } = useAuth();
  const { openArticle, highlightId } = useArticleContext();
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR(
    `articles:published:${isAuthenticated ? 'mine' : 'public'}`,
    () => api.getArticles('published', 1, undefined, 24, 'published', 'desc', isAuthenticated ? 'mine' : undefined),
    { revalidateOnFocus: false },
  );
  const articles = data?.articles ?? [];
  const handleArticleClick = (id: number) => {
    const article = articles.find((a: any) => a.id === id);
    if (article?.publicId) router.push(`/p/${article.publicId}`);
  };

  return (
    <section style={{ padding: '20px', maxWidth: 1320, margin: '0 auto' }}>
      <ArticleList
        articles={articles}
        hasMore={false}
        loadingMore={isLoading}
        onLoadMore={() => mutate()}
        emptyTitle={isAuthenticated ? '尚未发布文章' : '暂无公开文章'}
        onArticleClick={handleArticleClick}
        onToggleFavorite={() => {}}
        onArchive={() => {}}
        showMenu={isAuthenticated}
        highlightId={highlightId}
      />
    </section>
  );
}
