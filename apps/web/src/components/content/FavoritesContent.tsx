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
import type { ArticleListItem } from '@storing/shared';

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
  const { toggleFavorite, updateArticleInView, refreshCounts } = useArticleOperations();
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
  const removingIdsRef = useRef<Set<number>>(new Set());
  const allArticlesRef = useRef(allArticles);
  allArticlesRef.current = allArticles;

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
    const wasArchived = article.isArchived;
    setAllArticles((prev) => prev.map((a) => a.id === id ? { ...a, isArchived: !wasArchived } : a));
    try {
      if (wasArchived) {
        await api.unarchive(id);
      } else {
        await api.archive(id);
      }
      updateArticleInView('favorites', id, { isArchived: !wasArchived });
      updateArticleInView('archive', id, { isArchived: !wasArchived });
      updateArticleInView('inbox', id, { isArchived: !wasArchived });
      refreshCounts();
      showToast(wasArchived ? '已取消归档' : '已归档');
    } catch (error) {
      console.error('Toggle archive from favorites failed:', error);
      refreshList();
      showToast(wasArchived ? '取消归档失败，请重试' : '归档失败，请重试');
    }
  }, [updateArticleInView, refreshCounts, showToast, refreshList]);

  return (
    <>
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
            <ArticleSortControl
              options={FAVORITES_SORT_OPTIONS}
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
              emptyTitle="还没有收藏的文章"
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

export function FavoritesContent() {
  return (
    <div className="mobile-content-frame" style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--muted)', padding: 'var(--gap-2xl) 0', textAlign: 'center' }}>加载中…</div>}>
        <FavoritesContentInner />
      </Suspense>
    </div>
  );
}
