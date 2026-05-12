'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { ArticleList } from '@/components/article/ArticleList';
import { WechatCategorySidebar } from '@/components/archive/WechatCategorySidebar';
import { WechatCategoryPills } from '@/components/archive/WechatCategoryPills';
import { api } from '@/lib/api';

function ArchiveContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const [activeCat, setActiveCategory] = useState('all');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, mutate } = useSWR(
    `articles:archive:${page}:${activeCat}`,
    () => api.getArticles('archive', page, activeCat),
    { revalidateOnFocus: false }
  );
  const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();

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
    <div style={{ padding: '0' }}>
      {/* 移动端：药丸筛选 */}
      {isMobile && (
        <WechatCategoryPills
          categories={categories}
          activeCategory={activeCat}
          totalCount={totalCount}
          onSelect={(cat) => {
            setActiveCategory(cat);
            router.push('/archive?page=1');
          }}
        />
      )}

      {/* 桌面端：侧边栏 + 内容 */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <WechatCategorySidebar
            categories={categories}
            activeCategory={activeCat}
            totalCount={totalCount}
            onSelect={(cat) => {
              setActiveCategory(cat);
              router.push('/archive?page=1');
            }}
          />
          <div style={{ flex: 1 }}>
            {isLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
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
                highlightId={highlightId}
              />
            )}
          </div>
        </div>
      )}

      {/* 移动端：内容列表 */}
      {isMobile && (
        <div style={{ padding: '8px 16px' }}>
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
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
              highlightId={highlightId}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ArchiveContent() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
      <ArchiveContentInner />
    </Suspense>
  );
}