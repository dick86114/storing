'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { ArticleList } from '@/components/article/ArticleList';
import { BulkActionBar, type BulkToolbarAction } from '@/components/article/BulkActionBar';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useArticleSelection } from '@/hooks/useArticleSelection';
import { useBulkArticleActions } from '@/hooks/useBulkArticleActions';
import { api } from '@/lib/api';
import type { ArticleBulkAiResult, ArticleBulkActionResult, ArticleListItem, BulkExportJob } from '@storing/shared';

export function PublishedContent() {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { openArticle, highlightId } = useArticleContext();
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR(
    `articles:published:${isAuthenticated ? 'mine' : 'public'}`,
    () => api.getArticles('published', 1, undefined, 24, 'published', 'desc', isAuthenticated ? 'mine' : undefined),
    { revalidateOnFocus: false },
  );
  const articles = useMemo<ArticleListItem[]>(() => data?.articles ?? [], [data]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkResult, setBulkResult] = useState<ArticleBulkActionResult | ArticleBulkAiResult | null>(null);
  const [bulkExportJob, setBulkExportJob] = useState<BulkExportJob | null>(null);
  const articleIds = useMemo(() => articles.map((article) => article.id), [articles]);
  const selection = useArticleSelection(articleIds);
  const bulkActions = useBulkArticleActions();
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const handleArticleClick = useCallback((id: number) => {
    const article = articlesRef.current.find((a: any) => a.id === id);
    if (article?.publicUrl) router.push(article.publicUrl);
  }, [router]);
  const handleLoadMore = useCallback(() => { mutate(); }, [mutate]);
  const noop = useCallback(() => {}, []);

  const handleBulkAction = useCallback(async (action: BulkToolbarAction) => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0) return;
    try {
      if (action === 'set-category' || action === 'reclassify' || action === 'generate-ai') return;
      if (action === 'export-zip') {
        setBulkExportJob(await bulkActions.createExport({
          articleIds: ids,
          format: 'zip',
          includeAi: true,
          organizeByCategory: true,
        }));
        return;
      }
      const result = await bulkActions.runAction(action, ids);
      setBulkResult(result);
      if (action === 'delete' || action === 'permanent_delete') {
        selection.remove(ids);
        await mutate();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量操作失败');
    }
  }, [bulkActions, mutate, selection, showToast]);

  return (
    <section className="published-content" style={{ padding: '20px', maxWidth: 1320, margin: '0 auto' }}>
      {/* 游客落地引导：只在未登录时出现，讲清「登录能得到什么」而不是空喊请登录 */}
      {!isAuthenticated && (
        <div className="published-hero">
          <div className="published-hero-text">
            <h1 className="published-hero-title">收藏不再只是堆积</h1>
            <p className="published-hero-desc">
              乾坤戒替你读完、归类、打标签，让存过的文章真正能被找回。
            </p>
            <ul className="published-hero-points">
              <li>AI 摘要</li>
              <li>智能分类</li>
              <li>自动标签</li>
            </ul>
          </div>
          <button
            type="button"
            className="published-hero-cta"
            onClick={() => router.push(`/login?next=${encodeURIComponent('/inbox')}`)}
          >
            登录开始使用
          </button>
        </div>
      )}

      {isAuthenticated && (
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
          view="published"
        />
      )}
      <ArticleList
        articles={articles}
        hasMore={false}
        loadingMore={isLoading}
        onLoadMore={handleLoadMore}
        emptyTitle={isAuthenticated ? '尚未发布文章' : '暂无公开文章'}
        onArticleClick={handleArticleClick}
        onToggleFavorite={noop}
        onArchive={noop}
        showMenu={isAuthenticated}
        highlightId={highlightId}
        selectable={bulkMode}
        selectedArticleIds={selection.selectedIds}
        onSelectionChange={(id) => selection.toggle(id)}
      />
    </section>
  );
}
