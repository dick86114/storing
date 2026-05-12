'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';

const PER_PAGE = 18;

function InboxContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading } = useAuth();

  // 游客跳转到归档页
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/archive');
    }
  }, [isAuthenticated, isLoading, router]);

  const { data, isLoading: dataLoading, mutate } = useSWR(
    isAuthenticated ? `articles:inbox:${page}` : null,
    () => api.getArticles('inbox', page, undefined, PER_PAGE),
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
      {dataLoading ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
      ) : (
        <ArticleList
          articles={articles}
          currentPage={page}
          totalPages={totalPages}
          emptyTitle="所有文章都已处理完毕"
          onPageChange={(p) => router.push(`/inbox?page=${p}`)}
          onArticleClick={(id) => openArticle(id)}
          onToggleFavorite={async (id, e) => {
            e.stopPropagation();
            await api.toggleFavorite(id);
            mutate();
            refreshCounts();
            showToast('已收藏');
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

export function InboxContent() {
  return (
    <div style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
        <InboxContentInner />
      </Suspense>
    </div>
  );
}