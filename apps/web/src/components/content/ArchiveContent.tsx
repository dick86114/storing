'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { ArticleList } from '@/components/article/ArticleList';
import { SourceSidebar } from '@/components/archive/SourceSidebar';
import { SourcePills } from '@/components/archive/SourcePills';
import { api } from '@/lib/api';
import { useArticleOperations } from '@/hooks/useArticleOperations';
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
import type { ArticleListItem } from '@storing/shared';

function ArchiveContentInner() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();
  const { unarchive, toggleFavorite } = useArticleOperations();
  const { getBookmark, clearBookmark } = useBookmark();

  const [activeSource, setActiveSource] = useState('all');
  const [currentSort, setCurrentSort] = useState('count');
  const [page, setPage] = useState(1);
  const [allArticles, setAllArticles] = useState<ArticleListItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);
  const removingIdsRef = useRef<Set<number>>(new Set());

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

  const { data, isLoading, isValidating } = useSWR(
    `articles:archive:${page}:${activeSource}`,
    () => api.getArticles('archive', page, activeSource),
    { revalidateOnFocus: false }
  );

  const { data: sourceData } = useSWR(`sources:${currentSort}`, () => api.getSources(currentSort), { revalidateOnFocus: false });

  const totalPages = data?.totalPages ?? 1;
  const sources = sourceData ?? [];
  const totalCount = sources.reduce((sum: number, s: any) => sum + s.count, 0);

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

  const handleSourceSelect = useCallback((source: string) => {
    if (source === activeSource) return;
    setActiveSource(source);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
  }, [activeSource]);

  const handleSortChange = useCallback((sort: string) => {
    setCurrentSort(sort);
  }, []);

  const refreshList = useCallback(() => {
    setPage(1);
    removingIdsRef.current.clear();
  }, []);

  useEffect(() => { setMutateFn(refreshList); }, [setMutateFn, refreshList]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) setPage((p) => p + 1);
  }, [page, totalPages]);

  const handleContinueReading = () => {
    if (!bookmarkPrompt) return;
    openArticle(bookmarkPrompt.articleId);
    setBookmarkPrompt(null);

    // 等待详情面板渲染完成后再滚动
    const scrollToPosition = () => {
      const content = document.querySelector('[data-scroll-container="detail"]');
      if (content) {
        content.scrollTop = bookmarkPrompt.scrollPosition;
      } else {
        // 元素还没渲染，继续等待
        requestAnimationFrame(scrollToPosition);
      }
    };

    // 开始尝试滚动
    requestAnimationFrame(scrollToPosition);
  };

  const handleDismissBookmark = () => {
    clearBookmark();
    setBookmarkPrompt(null);
  };

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
      showMenu={isAuthenticated}
      highlightId={highlightId}
    />
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
        <SourcePills
          sources={sources}
          activeSource={activeSource}
          totalCount={totalCount}
          onSelect={handleSourceSelect}
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <SourceSidebar
            sources={sources}
            activeSource={activeSource}
            totalCount={totalCount}
            onSelect={handleSourceSelect}
            currentSort={currentSort}
            onSortChange={handleSortChange}
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