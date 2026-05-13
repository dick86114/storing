'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { WechatCategorySidebar } from '@/components/archive/WechatCategorySidebar';
import { WechatCategoryPills } from '@/components/archive/WechatCategoryPills';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import type { ArticleListItem } from '@storing/shared';

function ArchiveContentInner() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { unarchive, toggleFavorite } = useArticleOperations();

  const [activeCat, setActiveCat] = useState('all');
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const removingIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, isValidating } = useSWR(
    `articles:archive:${page}:${activeCat}`,
    () => api.getArticles('archive', page, activeCat),
    { revalidateOnFocus: false }
  );

  const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });

  const totalPages = data?.totalPages ?? 1;
  const categories = catData ?? [];
  const totalCount = categories.reduce((sum: number, c: any) => sum + c.count, 0);

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

  const handleCategorySelect = useCallback((cat: string) => {
    if (cat === activeCat) return;
    setActiveCat(cat);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [activeCat]);

  const refreshList = useCallback(() => {
    setPage(1);
    removingIdsRef.current.clear();
  }, []);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

  // 收藏/取消收藏：立即更新卡片状态
  const handleToggleFavorite = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const article = allArticles.find(a => a.id === id);
    if (!article) return;

    const wasFavorited = article.isFavorited;
    // 乐观更新：立即改变收藏状态
    setAllArticles((prev) => prev.map(a => a.id === id ? { ...a, isFavorited: !wasFavorited } : a));

    const success = await toggleFavorite(id, wasFavorited);
    if (success) {
      showToast(wasFavorited ? '已取消收藏' : '已收藏');
    } else {
      // 失败时回滚
      setAllArticles((prev) => prev.map(a => a.id === id ? { ...a, isFavorited: wasFavorited } : a));
      showToast('操作失败，请重试');
    }
  };

  // 取消归档：文章从归档页消失
  const handleUnarchive = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    removingIdsRef.current.add(id);
    setAllArticles((prev) => prev.filter((a) => a.id !== id));

    const success = await unarchive(id);
    if (success) {
      removingIdsRef.current.delete(id);
      showToast('已移回收件箱');
    } else {
      removingIdsRef.current.delete(id);
      refreshList();
      showToast('操作失败，请重试');
    }
  };

  // 重新分类
  const handleReclassify = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.reclassify(id);
      setPage(1);
      showToast('已重新分类');
    } catch (error) {
      showToast('重新分类失败，请重试');
      console.error('Failed to reclassify:', error);
    }
  };

  const [reclassifyingAll, setReclassifyingAll] = useState(false);
  const handleReclassifyAll = async () => {
    if (reclassifyingAll) return;
    setReclassifyingAll(true);
    try {
      await api.reclassifyAll();
      showToast('已开始后台重新分类，稍后刷新查看结果');
      setTimeout(() => { setPage(1); }, 10000);
    } catch (error) {
      showToast('批量重新分类失败');
      console.error('Failed to reclassify all:', error);
      setReclassifyingAll(false);
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
      onReclassify={handleReclassify}
      showReclassify={isAuthenticated}
      showMenu={isAuthenticated}
      highlightId={highlightId}
    />
  );

  return (
    <div style={{ padding: '0' }}>
      {isMobile && (
        <WechatCategoryPills
          categories={categories}
          activeCategory={activeCat}
          totalCount={totalCount}
          onSelect={handleCategorySelect}
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <WechatCategorySidebar
            categories={categories}
            activeCategory={activeCat}
            totalCount={totalCount}
            onSelect={handleCategorySelect}
            onReclassifyAll={isAuthenticated ? handleReclassifyAll : undefined}
            reclassifyingAll={reclassifyingAll}
          />
          <div style={{ flex: 1 }}>{articleListContent}</div>
        </div>
      )}

      {isMobile && <div style={{ padding: '8px 8px' }}>{articleListContent}</div>}
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