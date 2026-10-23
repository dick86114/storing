'use client';

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext, type ArticleListMutation } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { BulkActionBar, type BulkToolbarAction } from '@/components/article/BulkActionBar';
import { ListToolbar } from '@/components/article/ListToolbar';
import { ArticleSortControl, type ArticleSortKey, type ArticleSortOrder, type ArticleSortOption } from '@/components/article/ArticleSortControl';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { CategoryPicker } from '@/components/category/CategoryPicker';
import { api } from '@/lib/api';
import { assignmentFailure, bulkCategoryOutcome, commitSingleArchiveAssignment, type CategoryAssignmentOutcome } from '@/lib/category-picker';
import { scrollListToTop, setListScrollTop } from '@/lib/listScroll';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import { useArticleSelection } from '@/hooks/useArticleSelection';
import { useBulkArticleActions } from '@/hooks/useBulkArticleActions';
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
import { useCategoryCatalog, useRefreshCategoryCatalog } from '@/hooks/useCategoryCatalog';
import { useCategoryRecents } from '@/hooks/useCategoryRecents';
import type { ArticleBulkAiResult, ArticleBulkActionResult, ArticleListItem, BulkExportJob } from '@storing/shared';

const FAVORITES_SORT_OPTIONS: ArticleSortOption[] = [
  { value: 'favorited', label: '最近收藏' },
  { value: 'collected', label: '最新收录' },
  { value: 'published', label: '最新发布' },
];

function FavoritesContentInner() {
  const router = useRouter();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toggleFavorite, updateArticleInView } = useArticleOperations();
  const refreshCategoryCatalog = useRefreshCategoryCatalog();
  const categoryCatalog = useCategoryCatalog();
  const categoryRecents = useCategoryRecents(categoryCatalog.activeCategories, categoryCatalog.isReady);
  const { getBookmark, clearBookmark } = useBookmark();
  const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/archive');
  }, [isAuthenticated, authLoading, router]);

  // 页面加载时检测书签（仅 favorites 视图的书签）
  useEffect(() => {
    const bookmark = getBookmark();
    // 只处理 favorites 视图的书签，其他视图由对应页面处理
    if (bookmark && bookmark.view === 'favorites') {
      setBookmarkPrompt(bookmark);
    }
  }, [getBookmark]);

  const [page, setPage] = useState(1);
  const [articleSort, setArticleSort] = useState<ArticleSortKey>('favorited');
  const [articleSortOrder, setArticleSortOrder] = useState<ArticleSortOrder>('desc');
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkResult, setBulkResult] = useState<ArticleBulkActionResult | ArticleBulkAiResult | null>(null);
  const [bulkExportJob, setBulkExportJob] = useState<BulkExportJob | null>(null);
  const [bulkArchivePickerOpen, setBulkArchivePickerOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const removingIdsRef = useRef<Set<number>>(new Set());
  const articleIds = useMemo(() => allArticles.map((article) => article.id), [allArticles]);
  const selection = useArticleSelection(articleIds);
  const bulkActions = useBulkArticleActions();

  const confirmSelectionClear = useCallback(() => {
    if (!bulkMode || selection.selectedIds.size === 0) return true;
    if (!window.confirm('切换筛选会清空已选文章，继续吗？')) return false;
    selection.clear();
    return true;
  }, [bulkMode, selection]);
  const allArticlesRef = useRef(allArticles);
  allArticlesRef.current = allArticles;

  const handleContinueReading = () => {
    if (!bookmarkPrompt) return;

    // 先恢复列表滚动位置
    if (bookmarkPrompt.listScrollPosition) {
      setListScrollTop(bookmarkPrompt.listScrollPosition);
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
        setTimeout(() => scrollToPosition(retries + 1), 100);
      }
    };

    setTimeout(() => scrollToPosition(), 300);
  };

  const handleDismissBookmark = () => {
    clearBookmark();
    setBookmarkPrompt(null);
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    isAuthenticated ? `articles:favorites:${page}:${articleSort}:${articleSortOrder}` : null,
    () => api.getArticles('favorites', page, undefined, 8, articleSort, articleSortOrder),
    { revalidateOnFocus: false, errorRetryCount: 1 }
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
  }, [data, page, articleSort, articleSortOrder]);

  useEffect(() => {
    if (!isLoading || page !== 1) {
      setRequestTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setRequestTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoading, page]);

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

  const handleSortChange = useCallback((sort: ArticleSortKey) => {
    if (sort === articleSort) return;
    if (!confirmSelectionClear()) return;
    setArticleSort(sort);
    setPage(1);
    removingIdsRef.current.clear();
    scrollListToTop();
  }, [articleSort, confirmSelectionClear]);

  const handleSortOrderChange = useCallback((order: ArticleSortOrder) => {
    if (order === articleSortOrder) return;
    if (!confirmSelectionClear()) return;
    setArticleSortOrder(order);
    setPage(1);
    removingIdsRef.current.clear();
    scrollListToTop();
  }, [articleSortOrder, confirmSelectionClear]);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

  const handleToggleFavorite = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removingIdsRef.current.add(id);
    setAllArticles((prev) => prev.filter((a) => a.id !== id));
    const success = await toggleFavorite(id, true);
    if (success) {
      removingIdsRef.current.delete(id);
      showToast('已取消收藏');
    } else {
      removingIdsRef.current.delete(id);
      refreshList();
      showToast('取消收藏失败，请重试');
    }
  }, [toggleFavorite, showToast, refreshList]);

  const handleArchive = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const article = allArticlesRef.current.find(a => a.id === id);
    if (!article) return;
    if (!article.isArchived) {
      setArchiveTargetId(id);
      return;
    }
    setAllArticles((prev) => prev.map((a) => a.id === id ? { ...a, isArchived: false } : a));
    try {
      await api.unarchive(id);
      updateArticleInView('favorites', id, { isArchived: false });
      updateArticleInView('archive', id, { isArchived: false });
      updateArticleInView('inbox', id, { isArchived: false });
      await refreshCategoryCatalog();
      showToast('已取消归档');
    } catch (error) {
      console.error('Toggle archive from favorites failed:', error);
      await refreshList();
      showToast('取消归档失败，请重试');
    }
  }, [updateArticleInView, refreshCategoryCatalog, showToast, refreshList]);

  const confirmArchive = useCallback(async (categoryId?: number): Promise<CategoryAssignmentOutcome> => {
    if (!archiveTargetId) return { status: 'failure', message: '文章已变化，请重新打开归档操作。' };
    const id = archiveTargetId;
    return commitSingleArchiveAssignment({
      commit: async () => {
        await api.archive(id, categoryId);
      },
      onCommitted: () => {
        updateArticleInView('favorites', id, { isArchived: true });
        updateArticleInView('archive', id, { isArchived: true });
        updateArticleInView('inbox', id, { isArchived: true });
        setAllArticles((prev) => prev.map((article) => article.id === id ? { ...article, isArchived: true } : article));
      },
      refreshAuxiliary: () => Promise.all([refreshCategoryCatalog(), refreshList()]),
      onRefreshWarning: (error) => console.warn('文章已归档，但刷新分类或列表失败:', error),
      successMessage: categoryId ? '已归档到所选分类' : '已归档，正在生成分类建议',
      failureMessage: '归档失败，请重试',
    });
  }, [archiveTargetId, refreshCategoryCatalog, refreshList, updateArticleInView]);

  const handleBulkAction = useCallback(async (action: BulkToolbarAction) => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    try {
      if (action === 'set-category') return;
      if (action === 'archive') {
        setBulkArchivePickerOpen(true);
        return;
      }
      if (action === 'generate-ai' || action === 'reclassify') {
        setBulkResult(await bulkActions.runAi(ids, action === 'reclassify'));
      } else if (action === 'export-zip') {
        setBulkExportJob(await bulkActions.createExport({
          articleIds: ids,
          format: 'zip',
          includeAi: true,
          organizeByCategory: true,
        }));
      } else {
        const result = await bulkActions.runAction(action, ids);
        setBulkResult(result);
        if (action === 'delete' || action === 'permanent_delete') selection.remove(ids);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量操作失败');
    }
  }, [bulkActions, selection, showToast]);

  const confirmBulkArchive = useCallback(async (categoryId?: number): Promise<CategoryAssignmentOutcome> => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0 || bulkActions.loadingAction !== null) {
      return { status: 'failure', message: '没有可归档的文章，请重新选择。' };
    }
    try {
      const result = await bulkActions.runAction('archive', ids, categoryId);
      if (!result) return { status: 'failure', message: '批量归档未返回结果，请重试。' };
      setBulkResult(result);
      selection.remove(result.succeededIds);
      setAllArticles((prev) => prev.map((article) => result.succeededIds.includes(article.id) ? { ...article, isArchived: true } : article));
      await Promise.all([refreshList(), refreshCategoryCatalog()]);
      return bulkCategoryOutcome(result, categoryId
        ? `已将 ${result.succeededIds.length} 篇文章归档到所选分类`
        : `已将 ${result.succeededIds.length} 篇文章归档，正在生成分类建议`);
    } catch (error) {
      return assignmentFailure(error, '批量归档失败');
    }
  }, [bulkActions, refreshCategoryCatalog, refreshList, selection]);

  const handleCreateCategory = useCallback(async (name: string) => {
    const created = await api.createCategory({
      name,
      description: null,
      includeExamples: [],
      excludeExamples: [],
      color: null,
    });
    void refreshCategoryCatalog().catch((error) => console.error('刷新分类目录失败:', error));
    return created;
  }, [refreshCategoryCatalog]);

  return (
    <>
      {bulkArchivePickerOpen && (
        <CategoryPicker
          categories={categoryCatalog.activeCategories}
          recentCategoryIds={categoryRecents.recentCategoryIds}
          currentCategoryId={null}
          loading={categoryCatalog.isLoading || bulkActions.loadingAction !== null}
          catalogError={categoryCatalog.error instanceof Error ? categoryCatalog.error.message : null}
          targetCount={selection.selectedIds.size}
          title="批量归档到哪里？"
          subtitle={`分类只用于归档文章。为已选 ${selection.selectedIds.size} 篇文章选择分类后，这些文章会移入「归档」；也可以让 AI 判断。`}
          onClose={() => setBulkArchivePickerOpen(false)}
          onSelect={(categoryId) => confirmBulkArchive(categoryId)}
          onSelectAi={() => confirmBulkArchive()}
          onCreateCategory={handleCreateCategory}
          onRememberCategory={categoryRecents.remember}
          onCatalogRefresh={refreshCategoryCatalog}
          onNotify={showToast}
        />
      )}

      {archiveTargetId && (
        <CategoryPicker
          categories={categoryCatalog.activeCategories}
          recentCategoryIds={categoryRecents.recentCategoryIds}
          currentCategoryId={null}
          loading={categoryCatalog.isLoading}
          catalogError={categoryCatalog.error instanceof Error ? categoryCatalog.error.message : null}
          title="归档到哪里？"
          subtitle="分类只用于归档文章。选择分类后，文章会移入「归档」；也可以让 AI 判断。"
          onClose={() => setArchiveTargetId(null)}
          onSelect={(categoryId) => confirmArchive(categoryId)}
          onSelectAi={() => confirmArchive()}
          onCreateCategory={handleCreateCategory}
          onRememberCategory={categoryRecents.remember}
          onCatalogRefresh={refreshCategoryCatalog}
          onNotify={showToast}
        />
      )}

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

      <PullToRefresh
        onRefresh={async () => {
          setRequestTimedOut(false);
          await refreshList();
        }}
        disabled={isLoading || isValidating}
      >
        {(error || requestTimedOut) && page === 1 ? (
          <div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>收藏列表加载失败，可能是后端或数据库暂时不可用。</div>
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
          <div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>
        ) : (
          <>
            <ListToolbar
              start={isAuthenticated ? (
                <BulkActionBar
                  loading={bulkActions.loadingAction !== null}
                  mode={bulkMode}
                  onAction={handleBulkAction}
                  onInvert={selection.invert}
                  onSelectAll={selection.selectAllLoaded}
                  onResultClose={() => setBulkResult(null)}
                  onToggleMode={() => {
                    setBulkMode((current) => !current);
                    selection.clear();
                  }}
                  result={bulkResult}
                  exportJob={bulkExportJob}
                  selectedCount={selection.selectedIds.size}
                  view="favorites"
                />
              ) : undefined}
              end={(
                <ArticleSortControl
                  options={FAVORITES_SORT_OPTIONS}
                  value={articleSort}
                  order={articleSortOrder}
                  onChange={handleSortChange}
                  onOrderChange={handleSortOrderChange}
                />
              )}
            />
            <ArticleList
              articles={allArticles}
              hasMore={page < totalPages}
              loadingMore={isValidating && page > 1}
              onLoadMore={handleLoadMore}
              emptyTitle="还没有收藏的文章"
              onArticleClick={openArticle}
              onToggleFavorite={handleToggleFavorite}
              onArchive={handleArchive}
              highlightId={highlightId}
              selectable={bulkMode}
              selectedArticleIds={selection.selectedIds}
              onSelectionChange={(id) => selection.toggle(id)}
            />
          </>
        )}
      </PullToRefresh>
    </>
  );
}

export function FavoritesContent() {
  return (
    <div className="mobile-content-frame" style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>}>
        <FavoritesContentInner />
      </Suspense>
    </div>
  );
}
