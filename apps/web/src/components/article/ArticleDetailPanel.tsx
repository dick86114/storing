'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { useArticle } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
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

  // 刷新全局计数
  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
  }

  // 面板打开时禁止背景滚动
  useEffect(() => {
    if (articleId) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [articleId]);

  if (!articleId) return null;

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 200,
        background: 'color-mix(in oklch, var(--bg) 60%, transparent)',
        backdropFilter: 'blur(8px)',
        opacity: 1,
        pointerEvents: 'auto',
        transition: 'opacity 0.3s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute right-0 top-0 bottom-0 overflow-y-auto border-l"
        style={{
          width: 'min(680px, 100vw)',
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          transform: 'translateX(0)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between border-b"
          style={{
            padding: 'var(--gap-md) var(--gap-lg)',
            background: 'var(--glass)',
            backdropFilter: 'blur(16px)',
            borderColor: 'var(--glass-border)',
            zIndex: 10,
          }}
        >
          <button
            onClick={onClose}
            className="grid place-items-center rounded"
            style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', color: 'var(--muted)' }}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {article && (
            <div className="flex" style={{ gap: 'var(--gap-xs)' }}>
              <button
                onClick={async () => {
                  await api.toggleFavorite(article.id);
                  mutateArticle();
                  onMutate();
                  refreshCounts();
                  showToast(article.isFavorited ? '已取消收藏' : '已收藏');
                }}
                className="grid place-items-center rounded"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  color: article.isFavorited ? 'var(--accent)' : 'var(--muted)',
                }}
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
                  className="grid place-items-center rounded"
                  style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', color: 'var(--muted)' }}
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
                  className="grid place-items-center rounded"
                  style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', color: 'var(--muted)' }}
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

        {/* Content */}
        {isLoading ? (
          <div style={{ padding: 'var(--gap-xl) var(--gap-lg) var(--gap-2xl)' }}>
            <div className="flex flex-col" style={{ gap: 'var(--gap-md)' }}>
              {/* 骨架屏 - 元信息 */}
              <div className="flex items-center" style={{ gap: 'var(--gap-sm)' }}>
                <div className="skeleton-line" style={{ width: 48, height: 12 }} />
                <div className="skeleton-line" style={{ width: 56, height: 12 }} />
              </div>
              {/* 骨架屏 - 标题 */}
              <div className="skeleton-line" style={{ width: '85%', height: 22 }} />
              <div className="skeleton-line" style={{ width: '60%', height: 22 }} />
              {/* 骨架屏 - 正文 */}
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
              {/* 骨架屏 - 图片 */}
              <div className="skeleton-line" style={{ width: '100%', height: 180, marginTop: 'var(--gap-sm)' }} />
              <div style={{ marginTop: 'var(--gap-sm)' }}>
                <div className="skeleton-line" style={{ width: '100%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '92%', height: 14 }} />
                <div className="skeleton-line" style={{ width: '75%', height: 14 }} />
              </div>
            </div>
          </div>
        ) : article ? (
          <div style={{ padding: 'var(--gap-xl) var(--gap-lg) var(--gap-2xl)' }}>
            {/* Meta */}
            <div className="flex items-center flex-wrap" style={{ gap: 'var(--gap-sm)', marginBottom: 'var(--gap-md)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)' }}>{article.source}</span>
              <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
              <DateText dateStr={article.publishTime} style={{ fontSize: 11, color: 'var(--muted)' }} />
              {article.author && (
                <>
                  <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{article.author}</span>
                </>
              )}
              {article.originalUrl && (
                <>
                  <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
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

            {/* Title */}
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--fs-h1)',
                fontWeight: 600,
                lineHeight: 1.12,
                letterSpacing: '-0.02em',
                marginBottom: 'var(--gap-lg)',
              }}
            >
              {article.title}
            </h1>

            {/* AI Tags */}
            {article.aiTags?.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 'var(--gap-xs)', marginBottom: 'var(--gap-xl)' }}>
                {article.aiTags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center border"
                    style={{
                      padding: '2px 7px',
                      borderColor: 'var(--border)',
                      borderRadius: 999,
                      fontSize: 10,
                      letterSpacing: '0.02em',
                      color: 'var(--muted)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* AI Summary + Article Body */}
            {/* AI 摘要板块（归档文章显示在正文前） */}
            {article.aiSummary && (
              <section
                className="ai-summary-block"
                style={{
                  margin: 'var(--gap-lg) 0',
                  padding: '1.2em 1.5em',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--accent)',
                    margin: '0 0 0.75em',
                    paddingBottom: '0.5em',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  智能摘要
                </h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--fg)' }}>
                  {article.aiSummary}
                </p>
              </section>
            )}
            {article.isArchived && !article.aiSummary && (
              <div
                style={{
                  padding: 'var(--gap-xl)',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 'var(--fs-sm)',
                  marginBottom: 'var(--gap-lg)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--glass)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                AI 正在生成总结…
              </div>
            )}

            {/* 正文分割线 */}
            {article.isArchived && article.aiSummary && article.contentMd && (
              <div
                style={{
                  margin: 'var(--gap-xl) 0',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 'var(--gap-lg)',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--muted)',
                    marginBottom: 'var(--gap-md)',
                  }}
                >
                  原文
                </span>
              </div>
            )}

            {/* 原始正文 */}
            {article.contentMd ? (
              <div className="article-body">
                <ReactMarkdown>{article.contentMd}</ReactMarkdown>
              </div>
            ) : (
              <div
                style={{
                  padding: 'var(--gap-2xl) var(--gap-lg)',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 'var(--fs-sm)',
                }}
              >
                正在加载正文…
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
