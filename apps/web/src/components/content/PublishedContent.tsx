'use client';

import { useCallback, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { ArticleList } from '@/components/article/ArticleList';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { api } from '@/lib/api';

export function PublishedContent() {
  const { isAuthenticated } = useAuth();
  const { openArticle, highlightId } = useArticleContext();
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR(
    `articles:published:${isAuthenticated ? 'mine' : 'public'}`,
    () => api.getArticles('published', 1, undefined, 24, 'published', 'desc', isAuthenticated ? 'mine' : undefined),
    { revalidateOnFocus: false },
  );
  const articles = data?.articles ?? [];
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const handleArticleClick = useCallback((id: number) => {
    const article = articlesRef.current.find((a: any) => a.id === id);
    if (article?.publicId) router.push(`/p/${article.publicId}`);
  }, [router]);
  const handleLoadMore = useCallback(() => { mutate(); }, [mutate]);
  const noop = useCallback(() => {}, []);

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
      />
    </section>
  );
}
