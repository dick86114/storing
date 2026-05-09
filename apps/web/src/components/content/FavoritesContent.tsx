'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';

function FavoritesContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // 游客跳转到归档页
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/archive');
    }
  }, [isAuthenticated, authLoading, router]);

  const { data, isLoading, mutate } = useSWR(
    isAuthenticated ? `articles:favorites:${page}` : null,
    () => api.getArticles('favorites', page),
    { revalidateOnFocus: false }
  );

  const articles = data?.articles ?? [];
  const totalPages = data?.totalPages ?? 1;

  useEffect(() => { setMutateFn(mutate); }, [setMutateFn, mutate]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  return (
    <>
      {isLoading ? (
        <div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>
      ) : (
        <ArticleList
          articles={articles}
          currentPage={page}
          totalPages={totalPages}
          emptyTitle="还没有收藏的文章"
          onPageChange={(p) => router.push(`/favorites?page=${p}`)}
          onArticleClick={(id) => openArticle(id)}
          onToggleFavorite={async (id, e) => {
            e.stopPropagation();
            await api.toggleFavorite(id);
            mutate();
            refreshCounts();
            showToast('已取消收藏');
          }}
          onArchive={async (id, e) => {
            e.stopPropagation();
            await api.archive(id);
            mutate();
            refreshCounts();
            showToast('已归档');
          }}
          highlightId={highlightId}
        />
      )}
    </>
  );
}

export function FavoritesContent() {
  return (
    <div style={{ padding: 'var(--gap-md) var(--gutter)', minHeight: '80vh' }}>
      <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>}>
        <FavoritesContentInner />
      </Suspense>
    </div>
  );
}