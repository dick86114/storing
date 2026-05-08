'use client';

import { useEffect, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { useArticle } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthContext';
import { DateText } from '@/lib/formatDate';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

export function ArticleDetailPanel({
  articleId,
  onClose,
  onMutate,
}: {
  articleId: number | null;
  onClose: () => void;
  onMutate: () => void;
}) {
  const { data: article, isLoading, mutate: mutateArticle } = useArticle(articleId);
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  useEffect(() => {
    if (articleId) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [articleId]);

  const memoizedContent = useMemo(() => {
    if (!article?.contentMd) return null;
    return <ReactMarkdown>{article.contentMd}</ReactMarkdown>;
  }, [article?.contentMd]);

  if (!articleId) return null;

  return (
    <div
      className="detail-panel-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="detail-panel">
        <div className="detail-panel-header">
          <button onClick={onClose} className="detail-panel-close-btn" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {article && isAuthenticated && (
            <div className="flex" style={{ gap: 'var(--gap-xs)' }}>
              <button
                onClick={async () => {
                  await api.toggleFavorite(article.id);
                  mutateArticle();
                  onMutate();
                  refreshCounts();
                  showToast(article.isFavorited ? '已取消收藏' : '已收藏');
                }}
                className={`detail-panel-action-btn ${article.isFavorited ? 'favorited' : ''}`}
                title={article.isFavorited ? '取消收藏' : '收藏'}
              >
                <svg viewBox="0 0 24 24" fill={article.isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>
              {article.isArchived ? (
                <button
                  onClick={async () => {
                    await api.unarchive(article.id);
                    mutateArticle();
                    onMutate();
                    refreshCounts();
                    onClose();
                    showToast('已移回收件箱');
                  }}
                  className="detail-panel-action-btn"
                  title="移回收件箱"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await api.archive(article.id);
                    mutateArticle();
                    onMutate();
                    refreshCounts();
                    onClose();
                    showToast('已归档 — AI 正在自动分类…');
                  }}
                  className="detail-panel-action-btn"
                  title="归档"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <rect width="20" height="5" x="2" y="3" rx="1" />
                    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                    <path d="M10 12h4" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="detail-panel-content">
            <div className="flex flex-col" style={{ gap: 'var(--gap-md)' }}>
              <div className="flex items-center" style={{ gap: 'var(--gap-sm)' }}>
                <div className="skeleton-line" style={{ width: 48, height: 12 }} />
                <div className="skeleton-line" style={{ width: 56, height: 12 }} />
              </div>
              <div className="skeleton-line" style={{ width: '85%', height: 22 }} />
              <div className="skeleton-line" style={{ width: '60%', height: 22 }} />
              <div style={{ marginTop: 'var(--gap-md)' }}>
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '95%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '70%', height: 14 }} />
              </div>
              <div style={{ marginTop: 'var(--gap-sm)' }}>
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '88%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '55%', height: 14 }} />
              </div>
              <div className="skeleton-line" style={{ width: '100%', height: 180, marginTop: 'var(--gap-sm)' }} />
              <div style={{ marginTop: 'var(--gap-sm)' }}>
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '92%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '75%', height: 14 }} />
              </div>
            </div>
          </div>
        ) : article ? (
          <div className="detail-panel-content">
            <div className="detail-panel-meta">
              <span className="detail-panel-source">{article.source}</span>
              <span className="article-card-dot" />
              <DateText dateStr={article.publishTime} className="article-card-date" />
              {article.author && (
                <>
                  <span className="article-card-dot" />
                  <span className="article-card-date">{article.author}</span>
                </>
              )}
              {article.originalUrl && (
                <>
                  <span className="article-card-dot" />
                  <a
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    阅读原文
                  </a>
                </>
              )}
            </div>

            <h1 className="detail-panel-title">{article.title}</h1>

            {article.aiTags?.length > 0 && (
              <div className="detail-panel-tags">
                {article.aiTags.map((tag: string) => (
                  <span key={tag} className="article-card-tag">{tag}</span>
                ))}
              </div>
            )}

            {article.aiSummary && (
              <section className="ai-summary-block">
                <h2 className="ai-summary-title">智能摘要</h2>
                <p className="ai-summary-text">{article.aiSummary}</p>
              </section>
            )}
            {article.isArchived && !article.aiSummary && (
              <div className="ai-loading-placeholder">
                AI 正在生成总结…
              </div>
            )}

            {article.isArchived && article.aiSummary && article.contentMd && (
              <div className="content-divider">
                <span className="content-divider-label">原文</span>
              </div>
            )}

            {article.contentMd ? (
              <div className="article-body">{memoizedContent}</div>
            ) : (
              <div className="content-loading">正在加载正文…</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}