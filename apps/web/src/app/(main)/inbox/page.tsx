'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { MasonryGrid } from '@/components/article/MasonryGrid';
import { Pagination } from '@/components/ui/Pagination';
import { api } from '@/lib/api';

const PER_PAGE = 18;

export default function InboxPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();

  const { data, isLoading, mutate } = useSWR(
    `articles:inbox:${page}`,
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
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', marginBottom: 'var(--gap-md)' }}>收件箱</h1>
      <MasonryGrid
        articles={articles}
        isLoading={isLoading}
        emptyTitle="所有文章都已处理完毕"
        emptyDescription="去发现一些好文章吧"
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
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => router.push(`/inbox?page=${p}`)}
      />
    </div>
  );
}