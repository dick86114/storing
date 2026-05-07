'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';

function FavoritesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const { data, isLoading, mutate } = useSWR(
    `articles:favorites:${page}`,
    () => api.getArticles('favorites', page),
    { revalidateOnFocus: false }
  );
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();

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

export default function FavoritesPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', marginBottom: 'var(--gap-md)' }}>收藏</h1>
      <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>}>
        <FavoritesContent />
      </Suspense>
    </div>
  );
}