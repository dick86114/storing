'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext, type ArticleListMutation } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { ArticleSortControl, type ArticleSortKey, type ArticleSortOrder, type ArticleSortOption } from '@/components/article/ArticleSortControl';
import { SourceSidebar } from '@/components/archive/SourceSidebar';
import { SourcePills } from '@/components/archive/SourcePills';
import { CategoryNavigation } from '@/components/archive/CategoryNavigation';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
import type { ArticleListItem } from '@storing/shared';

const ARCHIVE_SORT_OPTIONS: ArticleSortOption[] = [
  { value: 'archived', label: '最近归档' },
  { value: 'collected', label: '最新收录' },
  { value: 'published', label: '最新发布' },
];

function ArchiveContentInner() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { unarchive, toggleFavorite } = useArticleOperations();
  const { getBookmark, clearBookmark } = useBookmark();

  const [activeSource, setActiveSource] = useState('all');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'categories' | 'sources'>('categories');
  const [currentSort, setCurrentSort] = useState('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [articleSort, setArticleSort] = useState<ArticleSortKey>('archived');
  const [articleSortOrder, setArticleSortOrder] = useState<ArticleSortOrder>('desc');
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const [sourceSidebarCollapsed, setSourceSidebarCollapsed] = useState(false);
  const removingIdsRef = useRef<Set<number>>(new Set());
  const allArticlesRef = useRef(allArticles);
  allArticlesRef.current = allArticles;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 页面加载时检测书签（仅 archive 视图的书签）
  useEffect(() => {
    const bookmark = getBookmark();
    // 只处理 archive 视图的书签，其他视图由对应页面处理
    if (bookmark && bookmark.view === 'archive') {
      setBookmarkPrompt(bookmark);
    }
  }, [getBookmark]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `articles:archive:${page}:${activeSource}:${activeCategoryId ?? 'all'}:${articleSort}:${articleSortOrder}`,
    () => api.getArticles('archive', page, activeSource, 8, articleSort, articleSortOrder, undefined, activeCategoryId),
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  const { data: sourceData } = useSWR(`sources:${currentSort}:${sortOrder}`, () => api.getSources(currentSort, sortOrder), { revalidateOnFocus: false });
  const { data: categoryData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });

  const totalPages = data?.totalPages ?? 1;
  const sources = sourceData ?? [];
  const categories = categoryData?.categories ?? [];
  const categoryCounts = Object.fromEntries(Object.entries(categoryData?.counts ?? {}).map(([id, count]) => [Number(id), count]));
  const totalCount = Object.values(categoryData?.counts ?? {}).reduce((sum, count) => sum + count, 0);

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
  }, [data, page, articleSort, articleSortOrder]);

  useEffect(() => {
    if (!isLoading || page !== 1) {
      setRequestTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setRequestTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoading, page]);

  const handleSourceSelect = useCallback((source: string) => {
    if (source === activeSource) return;
    setActiveSource(source);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [activeSource]);

  const handleCategorySelect = useCallback((categoryId: number | null) => {
    if (categoryId === activeCategoryId) return;
    setActiveCategoryId(categoryId);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [activeCategoryId]);

  const handleSortChange = useCallback((sort: string) => {
    setCurrentSort(sort);
  }, []);

  const handleSortOrderChange = useCallback((order: 'asc' | 'desc') => {
    setSortOrder(order);
  }, []);

  const handleArticleSortChange = useCallback((sort: ArticleSortKey) => {
    if (sort === articleSort) return;
    setArticleSort(sort);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [articleSort]);

  const handleArticleSortOrderChange = useCallback((order: ArticleSortOrder) => {
    if (order === articleSortOrder) return;
    setArticleSortOrder(order);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [articleSortOrder]);

  const refreshList = useCallback(async (mutation?: ArticleListMutation) => {
    if (mutation?.type === 'remove') {
      removingIdsRef.current.add(mutation.articleId);
      setAllArticles((prev) => prev.filter((article) => article.id !== mutation.articleId));
    } else {
      removingIdsRef.current.clear();
    }
    setPage(1);
    if (page !== 1) return;
    await mutate();
  }, [mutate, page]);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

  const handleContinueReading = () => {
    if (!bookmarkPrompt) return;

    // 先恢复列表滚动位置
    if (bookmarkPrompt.listScrollPosition) {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = bookmarkPrompt.listScrollPosition;
      }
    }

    openArticle(bookmarkPrompt.articleId);
    setBookmarkPrompt(null);

    // 延迟滚动到保存位置（等待 DOM 完全渲染）
    const scrollToPosition = (retries = 0) => {
      const content = document.querySelector('[data-scroll-container="detail"]');
      if (content && content.scrollHeight > 0) {
        content.scrollTop = bookmarkPrompt.scrollPosition;
        // 验证滚动是否成功
        if (content.scrollTop !== bookmarkPrompt.scrollPosition && retries < 10) {
          setTimeout(() => scrollToPosition(retries + 1), 100);
        }
      } else if (retries < 10) {
        // 元素还没渲染，继续等待
        setTimeout(() => scrollToPosition(retries + 1), 100);
      }
    };

    // 延迟开始尝试滚动
    setTimeout(() => scrollToPosition(), 300);
  };

  const handleDismissBookmark = () => {
    clearBookmark();
    setBookmarkPrompt(null);
  };

  // 收藏/取消收藏：立即更新卡片状态
  const handleToggleFavorite = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const article = allArticlesRef.current.find(a => a.id === id);
    if (!article) return;

    const wasFavorited = article.isFavorited;
    setAllArticles((prev) => prev.map(a => a.id === id ? { ...a, isFavorited: !wasFavorited } : a));

    const success = await toggleFavorite(id, wasFavorited);
    if (success) {
      showToast(wasFavorited ? '已取消收藏' : '已收藏');
    } else {
      setAllArticles((prev) => prev.map(a => a.id === id ? { ...a, isFavorited: wasFavorited } : a));
      showToast('操作失败，请重试');
    }
  }, [toggleFavorite, showToast]);

  // 取消归档：文章从归档页消失
  const handleUnarchive = useCallback(async (id: number, e: React.MouseEvent) => {
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
  }, [unarchive, showToast, refreshList]);

  const articleListContent = (error || requestTimedOut) && page === 1 ? (
    <div style={{ color: 'var(--text-muted)', padding: '48px 16px', textAlign: 'center' }}>
      <div style={{ marginBottom: 12 }}>归档列表加载失败，可能是后端或数据库暂时不可用。</div>
      <button
        type="button"
        onClick={() => {
          setRequestTimedOut(false);
          mutate();
        }}
        style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card-bg)', color: 'var(--fg)', cursor: 'pointer', padding: '8px 14px' }}
      >
        重试
      </button>
    </div>
  ) : isLoading && page === 1 ? (
    <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
  ) : (
    <>
      <ArticleSortControl
        options={ARCHIVE_SORT_OPTIONS}
        value={articleSort}
        order={articleSortOrder}
        onChange={handleArticleSortChange}
        onOrderChange={handleArticleSortOrderChange}
      />
      <ArticleList
        articles={allArticles}
        hasMore={page < totalPages}
        loadingMore={isValidating && page > 1}
        onLoadMore={handleLoadMore}
        emptyTitle="归档中暂无此类文章"
        onArticleClick={openArticle}
        onToggleFavorite={handleToggleFavorite}
        onArchive={handleUnarchive}
        showMenu={isAuthenticated}
        highlightId={highlightId}
      />
    </>
  );

  const refreshableArticleListContent = (
    <PullToRefresh
      onRefresh={async () => {
        setRequestTimedOut(false);
        await refreshList();
      }}
      disabled={isLoading || isValidating}
    >
      {articleListContent}
    </PullToRefresh>
  );

  return (
    <div style={{ padding: '0' }}>
      {/* 书签提示弹窗 */}
      {bookmarkPrompt && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
          }}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '320px',
              textAlign: 'center',
            }}
          >
            <p style={{ marginBottom: '16px', color: 'var(--text)' }}>
              检测到上次的书签「{bookmarkPrompt.articleTitle || '未命名文章'}」，是否继续阅读？
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleContinueReading}
                style={{
                  padding: '10px 20px',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                继续阅读
              </button>
              <button
                onClick={handleDismissBookmark}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile && (
        <>
          <CategoryNavigation categories={categories} activeCategoryId={activeCategoryId} counts={categoryCounts} totalCount={totalCount} onSelect={handleCategorySelect} compact />
          <SourcePills
            sources={sources}
            activeSource={activeSource}
            totalCount={totalCount}
            onSelect={handleSourceSelect}
            currentSort={currentSort}
            onSortChange={handleSortChange}
            sortOrder={sortOrder}
            onSortOrderChange={handleSortOrderChange}
          />
        </>
      )}

      {!isMobile && (
        <div
          className={`archive-desktop-layout${sourceSidebarCollapsed ? ' archive-desktop-layout--source-collapsed' : ''}`}
          style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}
        >
          <aside className="archive-navigation-panel">
            <div className="archive-navigation-tabs" role="tablist" aria-label="归档导航">
              <button type="button" className={sidebarMode === 'categories' ? 'is-active' : ''} onClick={() => setSidebarMode('categories')} role="tab" aria-selected={sidebarMode === 'categories'}>分类</button>
              <button type="button" className={sidebarMode === 'sources' ? 'is-active' : ''} onClick={() => setSidebarMode('sources')} role="tab" aria-selected={sidebarMode === 'sources'}>来源</button>
            </div>
            {sidebarMode === 'categories' ? (
              <CategoryNavigation categories={categories} activeCategoryId={activeCategoryId} counts={categoryCounts} totalCount={totalCount} onSelect={handleCategorySelect} />
            ) : (
              <SourceSidebar
                sources={sources}
                activeSource={activeSource}
                totalCount={totalCount}
                onSelect={handleSourceSelect}
                currentSort={currentSort}
                onSortChange={handleSortChange}
                sortOrder={sortOrder}
                onSortOrderChange={handleSortOrderChange}
                collapsed={sourceSidebarCollapsed}
                onToggleCollapsed={() => setSourceSidebarCollapsed((collapsed) => !collapsed)}
              />
            )}
          </aside>
          <div style={{ flex: 1, minWidth: 0 }}>{refreshableArticleListContent}</div>
        </div>
      )}

      {isMobile && <div className="mobile-content-frame" style={{ padding: '8px 16px' }}>{refreshableArticleListContent}</div>}
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
