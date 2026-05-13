'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { ArticleList } from '@/components/article/ArticleList';
import { WechatCategorySidebar } from '@/components/archive/WechatCategorySidebar';
import { WechatCategoryPills } from '@/components/archive/WechatCategoryPills';
import { api } from '@/lib/api';
import type { ArticleListItem } from '@storing/shared';

function ArchiveContentInner() {
  const router = useRouter();
  const [activeCat, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, isValidating, mutate } = useSWR(
    `articles:archive:${page}:${activeCat}`,
    () => api.getArticles('archive', page, activeCat),
    { revalidateOnFocus: false }
  );
  const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();

  const totalPages = data?.totalPages ?? 1;
  const categories = catData ?? [];
  const totalCount = categories.reduce((sum: number, c: any) => sum + c.count, 0);

  useEffect(() => { setMutateFn(mutate); }, [setMutateFn, mutate]);

  // 新数据追加到列表
  useEffect(() => {
    if (data?.articles) {
      if (page === 1) {
        setAllArticles(data.articles);
      } else {
        setAllArticles((prev) => [...prev, ...data.articles]);
      }
    }
  }, [data, page]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
    globalMutate('categories');
  }

  // 切换分类时重置列表
  const handleCategorySelect = useCallback((cat: string) => {
    setActiveCategory(cat);
    setPage(1);
    setAllArticles([]);
    window.scrollTo(0, 0);
  }, []);

  const refreshList = useCallback(async () => {
    setPage(1);
    setAllArticles([]);
    await mutate();
  }, [mutate]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, totalPages]);

  // 收藏操作
  const handleToggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.toggleFavorite(id);
      refreshList();
      refreshCounts();
      showToast('已收藏');
    } catch (error) {
      showToast('操作失败，请重试');
      console.error('Failed to toggle favorite:', error);
    }
  };

  // 取消归档操作
  const handleUnarchive = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.unarchive(id);
      refreshList();
      refreshCounts();
      showToast('已移回收件箱');
    } catch (error) {
      showToast('操作失败，请重试');
      console.error('Failed to unarchive:', error);
    }
  };

  const articleListContent = isLoading && page === 1 ? (
    <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
  ) : (
    <ArticleList
      articles={allArticles}
      hasMore={page < totalPages}
      loadingMore={isValidating && page > 1}
      onLoadMore={handleLoadMore}
      emptyTitle="归档中暂无此类文章"
      onArticleClick={(id) => openArticle(id)}
      onToggleFavorite={handleToggleFavorite}
      onArchive={handleUnarchive}
      highlightId={highlightId}
    />
  );

  return (
    <div style={{ padding: '0' }}>
      {/* 移动端：药丸筛选 */}
      {isMobile && (
        <WechatCategoryPills
          categories={categories}
          activeCategory={activeCat}
          totalCount={totalCount}
          onSelect={handleCategorySelect}
        />
      )}

      {/* 桌面端：侧边栏 + 内容 */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <WechatCategorySidebar
            categories={categories}
            activeCategory={activeCat}
            totalCount={totalCount}
            onSelect={handleCategorySelect}
          />
          <div style={{ flex: 1 }}>
            {articleListContent}
          </div>
        </div>
      )}

      {/* 移动端：内容列表 */}
      {isMobile && (
        <div style={{ padding: '8px 16px' }}>
          {articleListContent}
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
