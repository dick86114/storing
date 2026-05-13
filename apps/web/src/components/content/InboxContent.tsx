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

const PER_PAGE = 18;

function InboxContentInner() {
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

  const { data, isLoading: dataLoading, isValidating, mutate } = useSWR(
    isAuthenticated ? `articles:inbox:${page}` : null,
    () => api.getArticles('inbox', page, undefined, PER_PAGE),
    { revalidateOnFocus: false }
  );

  const totalPages = data?.totalPages ?? 1;

  // 新数据追加到列表（去重防止分页偏移导致重复）
  useEffect(() => {
    if (data?.articles) {
      if (page === 1) {
        setAllArticles(data.articles);
      } else {
        setAllArticles((prev) => {
          const ids = new Set(prev.map(a => a.id));
          return [...prev, ...data.articles.filter((a: ArticleListItem) => !ids.has(a.id))];
        });
      }
    }
  }, [data, page]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  // 刷新时重置到第一页
  const refreshList = useCallback(async () => {
    setPage(1);
    await mutate();
  }, [mutate]);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, totalPages]);

  return (
    <>
      {dataLoading && page === 1 ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
      ) : (
        <ArticleList
          articles={allArticles}
          hasMore={page < totalPages}
          loadingMore={isValidating && page > 1}
          onLoadMore={handleLoadMore}
          emptyTitle="所有文章都已处理完毕"
          onArticleClick={(id) => openArticle(id)}
          onToggleFavorite={async (id, e) => {
            e.stopPropagation();
            await api.toggleFavorite(id);
            refreshList();
            refreshCounts();
            showToast('已收藏');
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

export function InboxContent() {
  return (
    <div style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
        <InboxContentInner />
      </Suspense>
    </div>
  );
}
