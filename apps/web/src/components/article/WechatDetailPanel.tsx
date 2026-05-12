'use client';

import { useEffect, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { LeftOutlined, MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, ShareAltOutlined, LinkOutlined } from '@ant-design/icons';
import { useArticle } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthContext';
import { DateText } from '@/lib/formatDate';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

interface WechatDetailPanelProps {
  articleId: number | null;
  onClose: () => void;
  onMutate: () => void;
  isDesktop?: boolean;
}

export function WechatDetailPanel({ articleId, onClose, onMutate, isDesktop }: WechatDetailPanelProps) {
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
    if (articleId && !isDesktop) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [articleId, isDesktop]);

  const memoizedContent = useMemo(() => {
    if (!article?.contentMd) return null;
    return <ReactMarkdown>{article.contentMd}</ReactMarkdown>;
  }, [article?.contentMd]);

  if (!articleId) return null;

  // 桌面端：右侧面板样式
  if (isDesktop) {
    return (
      <>
        {/* 遮罩层 */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: '750px',
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 200,
          }}
        />
        {/* 详情面板 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '750px',
            height: '100vh',
            background: 'var(--card-bg)',
            borderLeft: '1px solid var(--divider)',
            zIndex: 201,
            overflowY: 'auto',
          }}
        >
          <DetailContent
            article={article}
            isLoading={isLoading}
            onClose={onClose}
            onMutate={onMutate}
            mutateArticle={mutateArticle}
            showToast={showToast}
            isAuthenticated={isAuthenticated}
            memoizedContent={memoizedContent}
            refreshCounts={refreshCounts}
          />
        </div>
      </>
    );
  }

  // 移动端：全屏面板样式
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--card-bg)',
        zIndex: 200,
        overflowY: 'auto',
      }}
    >
      <DetailContent
        article={article}
        isLoading={isLoading}
        onClose={onClose}
        onMutate={onMutate}
        mutateArticle={mutateArticle}
        showToast={showToast}
        isAuthenticated={isAuthenticated}
        memoizedContent={memoizedContent}
        refreshCounts={refreshCounts}
      />
    </div>
  );
}

// 详情内容组件
function DetailContent({
  article,
  isLoading,
  onClose,
  onMutate,
  mutateArticle,
  showToast,
  isAuthenticated,
  memoizedContent,
}: {
  article: any;
  isLoading: boolean;
  onClose: () => void;
  onMutate: () => void;
  mutateArticle: () => void;
  showToast: (msg: string) => void;
  isAuthenticated: boolean;
  memoizedContent: React.ReactNode;
  refreshCounts: () => void;
}) {
  // 分享功能
  async function handleShare() {
    if (!article) return;
    const url = article.originalUrl || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制');
    }
  }

  // 收藏功能
  async function handleFavorite() {
    if (!article) return;
    await api.toggleFavorite(article.id);
    mutateArticle();
    onMutate();
    refreshCounts();
    showToast(article.isFavorited ? '已取消收藏' : '已收藏');
  }

  // 归档功能
  async function handleArchive() {
    if (!article) return;
    if (article.isArchived) {
      await api.unarchive(article.id);
      showToast('已移回收件箱');
    } else {
      await api.archive(article.id);
      showToast('已归档');
    }
    mutateArticle();
    onMutate();
    refreshCounts();
  }

  return (
    <>
      {/* 顶部导航 */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '44px',
          padding: '0 16px',
          background: 'var(--card-bg)',
          borderBottom: '0.5px solid var(--divider)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button onClick={onClose} type="button" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
          <LeftOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
        </button>
        <button type="button" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
          <MoreOutlined style={{ fontSize: '22px', color: 'var(--text)', transform: 'rotate(90deg)' }} />
        </button>
      </header>

      {/* 文章内容 */}
      {isLoading ? (
        <div style={{ padding: '16px', color: 'var(--text-muted)' }}>加载中...</div>
      ) : article ? (
        <>
          {/* 文章头部 */}
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
              {article.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              <span>{article.source}</span>
              <span style={{ color: 'var(--divider)' }}>·</span>
              {article.author && (
                <>
                  <span>{article.author}</span>
                  <span style={{ color: 'var(--divider)' }}>·</span>
                </>
              )}
              <DateText dateStr={article.publishTime} />
            </div>
            {/* AI标签 */}
            {article.aiTags?.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {article.aiTags.map((tag: string) => (
                  <span key={tag} style={{ padding: '4px 10px', background: 'var(--tag-bg)', color: 'var(--text-muted)', fontSize: '12px', borderRadius: '4px' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI摘要 */}
          {article.aiSummary && (
            <div style={{ padding: '14px 16px', background: 'var(--tag-bg)', margin: '8px 16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>智能摘要</span>
              </div>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{article.aiSummary}</p>
            </div>
          )}

          {/* 正文 */}
          <div style={{ padding: '16px' }}>
            {article.contentMd ? (
              <div style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {memoizedContent}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>正在加载正文...</div>
            )}
          </div>

          {/* 底部操作栏 */}
          {isAuthenticated && (
            <footer
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '56px',
                padding: '12px 16px',
                background: 'var(--nav-bg)',
                borderTop: '0.5px solid var(--divider)',
                position: 'sticky',
                bottom: 0,
              }}
            >
              {/* 左侧：阅读原文 */}
              {article.originalUrl && (
                <a
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: '14px',
                  }}
                >
                  <LinkOutlined style={{ fontSize: '18px' }} />
                  阅读原文
                </a>
              )}

              {/* 右侧：操作按钮 */}
              <div style={{ display: 'flex', gap: '24px' }}>
                <button onClick={handleArchive} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <FolderOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{article.isArchived ? '取消归档' : '归档'}</span>
                </button>
                <button onClick={handleShare} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分享</span>
                </button>
                <button onClick={handleFavorite} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  {article.isFavorited ? (
                    <HeartFilled style={{ fontSize: '20px', color: 'var(--accent)' }} />
                  ) : (
                    <HeartOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  )}
                  <span style={{ fontSize: '11px', color: article.isFavorited ? 'var(--accent)' : 'var(--text-muted)' }}>收藏</span>
                </button>
              </div>
            </footer>
          )}
        </>
      ) : null}
    </>
  );
}