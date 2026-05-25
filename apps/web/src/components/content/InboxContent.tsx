'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
import type { ArticleListItem } from '@storing/shared';

const PER_PAGE = 18;

function InboxContentInner() {
  const router = useRouter();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { archive, toggleFavorite, removeArticleFromView } = useArticleOperations();
  const { getBookmark, clearBookmark } = useBookmark();
  const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);

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
    isAuthenticated ? `articles:inbox:${page}` : null,
    () => api.getArticles('inbox', page, undefined, PER_PAGE),
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
  }, [data, page]);

  useEffect(() => {
    if (!dataLoading || page !== 1) {
      setRequestTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setRequestTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [dataLoading, page]);

  const refreshList = useCallback(() => {
    setPage(1);
    removingIdsRef.current.clear();
  }, []);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

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
        <ArticleList
          articles={allArticles}
          hasMore={page < totalPages}
          loadingMore={isValidating && page > 1}
          onLoadMore={handleLoadMore}
          emptyTitle="所有文章都已处理完毕"
          onArticleClick={(id) => openArticle(id)}
          onToggleFavorite={async (id, e) => {
            e.stopPropagation();
            const article = allArticles.find(a => a.id === id);
            if (!article) return;

            // 乐观更新：立即从收件箱移除
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
          }}
          onArchive={async (id, e) => {
            e.stopPropagation();

            // 乐观更新：立即从收件箱移除
            removingIdsRef.current.add(id);
            setAllArticles((prev) => prev.filter((a) => a.id !== id));

            const success = await archive(id);
            if (success) {
              removingIdsRef.current.delete(id);
              showToast('已归档');
            } else {
              removingIdsRef.current.delete(id);
              refreshList();
              showToast('归档失败，请重试');
            }
          }}
          highlightId={highlightId}
        />
      )}
    </>
  );
}

export function InboxContent() {
  return (
    <div style={{ padding: '8px 16px' }}>
      <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
        <InboxContentInner />
      </Suspense>
    </div>
  );
}
