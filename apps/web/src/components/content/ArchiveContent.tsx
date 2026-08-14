'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext, type ArticleListMutation } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { ArticleSortControl, type ArticleSortKey, type ArticleSortOrder, type ArticleSortOption } from '@/components/article/ArticleSortControl';
import { SourceSidebar } from '@/components/archive/SourceSidebar';
import { SourcePills } from '@/components/archive/SourcePills';
import { CategoryNavigation } from '@/components/archive/CategoryNavigation';
import { CategoryAssignmentDialog } from '@/components/article/WechatDetailPanel';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { api, type ArchiveTag } from '@/lib/api';
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
  const { mutate: globalMutate } = useSWRConfig();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { unarchive, toggleFavorite } = useArticleOperations();
  const { getBookmark, clearBookmark } = useBookmark();

  const [activeSource, setActiveSource] = useState('all');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
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
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
  const [bulkCategoryPickerOpen, setBulkCategoryPickerOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
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
    `articles:archive:${page}:${activeSource}:${activeCategoryId ?? 'all'}:${activeTags.join('|')}:${articleSort}:${articleSortOrder}`,
    () => api.getArticles('archive', page, activeSource, 8, articleSort, articleSortOrder, undefined, activeCategoryId, activeTags),
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  const { data: sourceData } = useSWR(`sources:${currentSort}:${sortOrder}`, () => api.getSources(currentSort, sortOrder), { revalidateOnFocus: false });
  const { data: categoryData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
  const { data: tagsData } = useSWR<ArchiveTag[]>(isAuthenticated ? 'archive-tags' : null, () => api.getTags(), { revalidateOnFocus: false });

  const totalPages = data?.totalPages ?? 1;
  const sources = sourceData ?? [];
  const categories = useMemo(() => categoryData?.categories ?? [], [categoryData?.categories]);
  const categoryCounts = Object.fromEntries(Object.entries(categoryData?.counts ?? {}).map(([id, count]) => [Number(id), count]));
  const totalCount = Object.values(categoryData?.counts ?? {}).reduce((sum, count) => sum + count, 0);
  const archiveTags = tagsData ?? [];

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

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, []);

  const clearTags = useCallback(() => {
    setActiveTags([]);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, []);

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

  const handleSelectionChange = useCallback((id: number, selected: boolean) => {
    setSelectedArticleIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const exitBulkMode = useCallback(() => {
    setBulkMode(false);
    setSelectedArticleIds(new Set());
    setBulkCategoryPickerOpen(false);
  }, []);

  const handleBulkCategorySelect = useCallback(async (categoryId: number) => {
    if (selectedArticleIds.size === 0 || bulkSaving) return;
    setBulkSaving(true);
    try {
      const result = await api.bulkMoveArticlesToCategory([...selectedArticleIds], categoryId);
      const category = categories.find((item) => item.id === categoryId);
      showToast(`已将 ${result.updatedCount} 篇文章归入${category?.name || '所选分类'}`);
      exitBulkMode();
      await refreshList();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量修改分类失败');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkSaving, categories, exitBulkMode, refreshList, selectedArticleIds, showToast]);

  const handleCreateCategory = useCallback(async (name: string) => {
    const created = await api.createCategory({
      name,
      description: null,
      includeExamples: [],
      excludeExamples: [],
      color: null,
    });
    await globalMutate('categories');
    return created;
  }, [globalMutate]);

  const confirmBulkClassify = useCallback(async () => {
    if (selectedArticleIds.size === 0 || bulkSaving) return;
    setBulkSaving(true);
    try {
      const result = await api.bulkClassifyArticles([...selectedArticleIds]);
      const notices = [
        result.classifiedArticleIds.length ? `已重新判断 ${result.classifiedArticleIds.length} 篇` : '',
        result.skipped.length ? `跳过 ${result.skipped.length} 篇人工确认或非归档文章` : '',
        result.failed.length ? `${result.failed.length} 篇失败` : '',
      ].filter(Boolean);
      showToast(notices.join('，') || '没有可重新判断的文章');
      exitBulkMode();
      await refreshList();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量重新判断分类失败');
    } finally {
      setBulkSaving(false);
    }
  }, [bulkSaving, exitBulkMode, refreshList, selectedArticleIds, showToast]);

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
      {isAuthenticated && (
        <div className="archive-bulk-toolbar">
          {bulkMode ? (
            <>
              <span>已选择 {selectedArticleIds.size} 篇</span>
              <button type="button" onClick={() => setBulkCategoryPickerOpen(true)} disabled={selectedArticleIds.size === 0}>修改分类</button>
              <button type="button" onClick={confirmBulkClassify} disabled={selectedArticleIds.size === 0 || bulkSaving}>重新判断分类</button>
              <button type="button" onClick={exitBulkMode}>取消</button>
            </>
          ) : (
            <button type="button" onClick={() => setBulkMode(true)}>批量整理</button>
          )}
        </div>
      )}
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
        selectable={bulkMode}
        selectedArticleIds={selectedArticleIds}
        onSelectionChange={handleSelectionChange}
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

      {bulkCategoryPickerOpen && (
        <CategoryAssignmentDialog
          categories={categories}
          currentCategoryId={null}
          loading={bulkSaving}
          onClose={() => setBulkCategoryPickerOpen(false)}
          onSelect={handleBulkCategorySelect}
          onCreateCategory={handleCreateCategory}
        />
      )}

      {tagFilterOpen && (
        <div className="archive-category-confirm-overlay" role="presentation" onMouseDown={() => setTagFilterOpen(false)}>
          <section className="archive-tag-filter" role="dialog" aria-modal="true" aria-labelledby="archive-tag-filter-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="archive-tag-filter-header">
              <h2 id="archive-tag-filter-title">标签筛选</h2>
              <button type="button" onClick={() => setTagFilterOpen(false)} aria-label="关闭标签筛选">关闭</button>
            </div>
            <p>仅显示同时包含所选标签的文章。</p>
            <div className="archive-tag-filter-list">
              {archiveTags.map(({ tag, count }) => {
                const selected = activeTags.includes(tag);
                return <button key={tag} type="button" className={selected ? 'is-selected' : ''} onClick={() => toggleTag(tag)} aria-pressed={selected}>{tag}<span>{count}</span></button>;
              })}
              {archiveTags.length === 0 && <span className="archive-tag-filter-empty">暂无可筛选标签</span>}
            </div>
            <div className="archive-category-confirm-actions">
              <button type="button" onClick={clearTags} disabled={activeTags.length === 0}>清空筛选</button>
              <button type="button" onClick={() => setTagFilterOpen(false)}>完成</button>
            </div>
          </section>
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
          <div className="archive-tag-filter-trigger-wrap">
            <button type="button" className={`archive-tag-filter-trigger${activeTags.length ? ' is-active' : ''}`} onClick={() => setTagFilterOpen(true)} aria-haspopup="dialog">
              标签{activeTags.length ? ` (${activeTags.length})` : ''}
            </button>
          </div>
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
            <button type="button" className={`archive-tag-filter-trigger archive-tag-filter-trigger--desktop${activeTags.length ? ' is-active' : ''}`} onClick={() => setTagFilterOpen(true)} aria-haspopup="dialog">
              标签筛选{activeTags.length ? ` (${activeTags.length})` : ''}
            </button>
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
