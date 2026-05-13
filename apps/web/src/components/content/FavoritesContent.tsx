'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';
import type { ArticleListItem } from '@storing/shared';

function FavoritesContentInner() {
  const router = useRouter();
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

  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);

  const { data, isLoading, isValidating, mutate } = useSWR(
    isAuthenticated ? `articles:favorites:${page}` : null,
    () => api.getArticles('favorites', page),
    { revalidateOnFocus: false }
  );

  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (data?.articles) {
      if (page === 1) {
        setAllArticles(data.articles);
      } else {
        setAllArticles((prev) => [...prev, ...data.articles]);
      }
    }
  }, [data, page]);

  useEffect(() => { setMutateFn(mutate); }, [setMutateFn, mutate]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  const refreshList = useCallback(async () => {
    setPage(1);
    await mutate();
  }, [mutate]);

  const handleLoadMore = useCallback(() => {
    if (!isValidating && page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [isValidating, page, totalPages]);

  return (
    <>
      {isLoading && page === 1 ? (
        <div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>
      ) : (
        <ArticleList
          articles={allArticles}
          hasMore={page < totalPages}
          loadingMore={isValidating && page > 1}
          onLoadMore={handleLoadMore}
          emptyTitle="还没有收藏的文章"
          onArticleClick={(id) => openArticle(id)}
          onToggleFavorite={async (id, e) => {
            e.stopPropagation();
            await api.toggleFavorite(id);
            refreshList();
            refreshCounts();
            showToast('已取消收藏');
          }}
          onArchive={async (id, e) => {
            e.stopPropagation();
            await api.archive(id);
            refreshList();
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
    <div style={{ padding: 'var(--gap-md) var(--gutter)' }}>
      <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>}>
        <FavoritesContentInner />
      </Suspense>
    </div>
  );
}
