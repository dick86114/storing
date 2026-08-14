'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext, type ArticleListMutation } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { ArticleSortControl, type ArticleSortKey, type ArticleSortOrder, type ArticleSortOption } from '@/components/article/ArticleSortControl';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
import { CategoryAssignmentDialog } from '@/components/article/WechatDetailPanel';
import type { ArticleListItem } from '@storing/shared';

const PER_PAGE = 18;
const INBOX_SORT_OPTIONS: ArticleSortOption[] = [
  { value: 'collected', label: '最新收录' },
  { value: 'published', label: '最新发布' },
];

function InboxContentInner() {
  const router = useRouter();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { archive, toggleFavorite, removeArticleFromView } = useArticleOperations();
  const { getBookmark, clearBookmark } = useBookmark();
  const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/archive');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    const bookmark = getBookmark();
    if (bookmark && bookmark.view === 'inbox') {
      setBookmarkPrompt(bookmark);
    }
  }, [getBookmark]);

  const [page, setPage] = useState(1);
  const [articleSort, setArticleSort] = useState<ArticleSortKey>('collected');
  const [articleSortOrder, setArticleSortOrder] = useState<ArticleSortOrder>('desc');
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const removingIdsRef = useRef<Set<number>>(new Set());

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
        setTimeout(() => scrollToPosition(retries + 1), 100);
      }
    };

    setTimeout(() => scrollToPosition(), 300);
  };

  const handleDismissBookmark = () => {
    clearBookmark();
    setBookmarkPrompt(null);
  };

  const { data, error, isLoading: dataLoading, isValidating, mutate } = useSWR(
    isAuthenticated ? `articles:inbox:${page}:${articleSort}:${articleSortOrder}` : null,
    () => api.getArticles('inbox', page, undefined, PER_PAGE, articleSort, articleSortOrder),
    { revalidateOnFocus: false, errorRetryCount: 1, keepPreviousData: true }
  );

  const totalPages = data?.totalPages ?? 1;
  const { data: categoryData, mutate: mutateCategoryData } = useSWR(isAuthenticated ? 'categories:archive-action' : null, () => api.getCategories(), { revalidateOnFocus: false });

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
    if (!dataLoading || page !== 1) {
      setRequestTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setRequestTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [dataLoading, page]);

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
    setArticleSort(sort);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [articleSort]);

  const handleSortOrderChange = useCallback((order: ArticleSortOrder) => {
    if (order === articleSortOrder) return;
    setArticleSortOrder(order);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [articleSortOrder]);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

  const handleToggleFavorite = useCallback(async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removingIdsRef.current.add(id);
    setAllArticles((prev) => prev.filter((a) => a.id !== id));
    const success = await toggleFavorite(id, false);
    if (success) {
      removingIdsRef.current.delete(id);
      showToast('已收藏');
    } else {
      removingIdsRef.current.delete(id);
      refreshList();
      showToast('收藏失败，请重试');
    }
  }, [toggleFavorite, showToast, refreshList]);

  const handleArchive = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveTargetId(id);
  }, []);

  const confirmArchive = useCallback(async (categoryId?: number) => {
    if (!archiveTargetId) return;
    const id = archiveTargetId;
    setArchiveTargetId(null);
    removingIdsRef.current.add(id);
    setAllArticles((prev) => prev.filter((a) => a.id !== id));
    const success = await archive(id, categoryId);
    if (success) {
      removingIdsRef.current.delete(id);
      showToast(categoryId ? '已归档到所选分类' : '已归档，正在生成分类建议');
    } else {
      removingIdsRef.current.delete(id);
      refreshList();
      showToast('归档失败，请重试');
    }
  }, [archive, archiveTargetId, showToast, refreshList]);

  const handleCreateCategory = useCallback(async (name: string) => {
    const created = await api.createCategory({
      name,
      description: null,
      includeExamples: [],
      excludeExamples: [],
      color: null,
    });
    await mutateCategoryData();
    return created;
  }, [mutateCategoryData]);

  return (
    <>
      {bookmarkPrompt && (
        <div style={{
          background: 'oklch(0.95 0.05 270)',
          border: '1px solid oklch(0.8 0.1 270)',
          borderRadius: '12px',
          padding: '16px 20px',
          margin: '0 0 16px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(12px)',
        }}>
          <span style={{ color: 'oklch(0.3 0.05 270)', fontSize: '14px' }}>
            检测到上次未读完的文章，是否继续阅读?
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDismissBookmark}
              style={{
                background: 'transparent',
                border: '1px solid oklch(0.7 0.05 270)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                color: 'oklch(0.4 0.05 270)',
                cursor: 'pointer',
              }}
            >
              稍后
            </button>
            <button
              onClick={handleContinueReading}
              style={{
                background: 'oklch(0.6 0.15 270)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              继续
            </button>
          </div>
        </div>
      )}
      {archiveTargetId && (
        <CategoryAssignmentDialog
          categories={categoryData?.categories ?? []}
          currentCategoryId={null}
          loading={false}
          title="归档到哪里？"
          subtitle="选择预设分类，或让 AI 根据内容判断。"
          onClose={() => setArchiveTargetId(null)}
          onSelect={(categoryId) => confirmArchive(categoryId)}
          onSelectAi={() => confirmArchive()}
          onCreateCategory={handleCreateCategory}
        />
      )}
      <PullToRefresh
        onRefresh={async () => {
          setRequestTimedOut(false);
          await refreshList();
        }}
        disabled={dataLoading || isValidating}
      >
        {(error || requestTimedOut) && page === 1 ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>文章加载失败，可能是后端或数据库暂时不可用。</div>
            <button
              type="button"
              onClick={() => {
                setRequestTimedOut(false);
                mutate();
              }}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--card-bg)',
                color: 'var(--fg)',
                cursor: 'pointer',
                padding: '8px 14px',
              }}
            >
              重试
            </button>
          </div>
        ) : dataLoading && page === 1 ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
        ) : (
          <>
            <ArticleSortControl
              options={INBOX_SORT_OPTIONS}
              value={articleSort}
              order={articleSortOrder}
              onChange={handleSortChange}
              onOrderChange={handleSortOrderChange}
            />
            <ArticleList
              articles={allArticles}
              hasMore={page < totalPages}
              loadingMore={isValidating && page > 1}
              onLoadMore={handleLoadMore}
              emptyTitle="所有文章都已处理完毕"
              onArticleClick={openArticle}
              onToggleFavorite={handleToggleFavorite}
              onArchive={handleArchive}
              highlightId={highlightId}
            />
          </>
        )}
      </PullToRefresh>
    </>
  );
}

export function InboxContent() {
  return (
    <div className="mobile-content-frame" style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
        <InboxContentInner />
      </Suspense>
    </div>
  );
}
