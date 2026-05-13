'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import type { ArticleListItem } from '@storing/shared';

function FavoritesContentInner() {
  const router = useRouter();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { archive, toggleFavorite } = useArticleOperations();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/archive');
  }, [isAuthenticated, authLoading, router]);

  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const removingIdsRef = useRef<Set<number>>(new Set());

  const { data, isLoading, isValidating } = useSWR(
    isAuthenticated ? `articles:favorites:${page}` : null,
    () => api.getArticles('favorites', page),
    { revalidateOnFocus: false }
  );

  const totalPages = data?.totalPages ?? 1;

  useEffect(() => {
    if (data?.articles) {
      if (page === 1) {
        setAllArticles(data.articles.filter((a: ArticleListItem) => !removingIdsRef.current.has(a.id)));
      } else {
        setAllArticles((prev) => {
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...data.articles.filter((a: ArticleListItem) => !ids.has(a.id) && !removingIdsRef.current.has(a.id))];
        });
      }
    }
  }, [data, page]);

  const refreshList = useCallback(() => {
    setPage(1);
    removingIdsRef.current.clear();
  }, []);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

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
            const article = allArticles.find(a => a.id === id);
            if (!article) return;

            // 乐观更新：立即从收藏页移除
            removingIdsRef.current.add(id);
            setAllArticles((prev) => prev.filter((a) => a.id !== id));

            const success = await toggleFavorite(id, true); // 当前是已收藏状态
            if (success) {
              removingIdsRef.current.delete(id);
              showToast('已取消收藏');
            } else {
              removingIdsRef.current.delete(id);
              refreshList();
              showToast('取消收藏失败，请重试');
            }
          }}
          onArchive={async (id, e) => {
            e.stopPropagation();

            // 乐观更新：立即从收藏页移除
            removingIdsRef.current.add(id);
            setAllArticles((prev) => prev.filter((a) => a.id !== id));

            const success = await archive(id);
            if (success) {
              removingIdsRef.current.delete(id);
              showToast('已归档');
            } else {
              removingIdsRef.current.delete(id);
              refreshList();
              showToast('归档失败，请重试');
            }
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