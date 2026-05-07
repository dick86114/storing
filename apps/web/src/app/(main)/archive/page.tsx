'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useArticles } from '@/hooks/useArticles';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { ArticleList } from '@/components/article/ArticleList';
import { CategorySidebar, CategoryPills } from '@/components/archive/CategorySidebar';
import { api } from '@/lib/api';

export default function ArchivePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const [activeCategory, setActiveCategory] = useState('all');
  const { data, isLoading, mutate } = useArticles('archive', page, activeCategory);
  const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, setMutateFn } = useArticleContext();

  useEffect(() => { setMutateFn(mutate); }, [setMutateFn, mutate]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
    globalMutate('categories');
  }

  const articles = data?.articles ?? [];
  const totalPages = data?.totalPages ?? 1;
  const categories = catData ?? [];
  const totalCount = categories.reduce((sum: number, c: any) => sum + c.count, 0);

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', marginBottom: 'var(--gap-md)' }}>归档</h1>
      <CategoryPills
        categories={categories}
        activeCategory={activeCategory}
        totalCount={totalCount}
        onSelect={(cat) => { setActiveCategory(cat); router.push('/archive?page=1'); }}
      />
      <div className="archive-layout" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--gap-xl)', alignItems: 'start' }}>
        <div className="archive-sidebar">
          <CategorySidebar
            categories={categories}
            activeCategory={activeCategory}
            totalCount={totalCount}
            onSelect={(cat) => { setActiveCategory(cat); router.push('/archive?page=1'); }}
          />
        </div>
        {isLoading ? (
          <div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>
        ) : (
          <ArticleList
            articles={articles}
            currentPage={page}
            totalPages={totalPages}
            emptyTitle="归档中暂无此类文章"
            onPageChange={(p) => router.push(`/archive?page=${p}`)}
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
              await api.unarchive(id);
              mutate();
              refreshCounts();
              showToast('已移回收件箱');
            }}
          />
        )}
      </div>
    </div>
  );
}
