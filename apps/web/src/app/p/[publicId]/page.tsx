'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LeftOutlined, ShareAltOutlined, UpOutlined, DownOutlined, MoreOutlined, CopyOutlined, ExportOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { getArticleSourceIcon, getArticleSourceText } from '@/components/article/articleSourceIcon';
import { DateText } from '@/lib/formatDate';

function tryCopyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export default function PublicPublicationPage({ params }: { params: Promise<{ publicId: string }> }) {
  const [article, setArticle] = useState<any>(null);
  const [error, setError] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    params
      .then(({ publicId }) => api.getPublicPublication(publicId))
      .then((result) => setArticle(result.article))
      .catch(() => setError(true));
  }, [params, router]);

  // 点击外部关闭更多菜单
  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    const handleFocus = (e: FocusEvent) => { if (!moreWrapRef.current?.contains(e.target as Node)) close(); };
    document.addEventListener('click', close);
    document.addEventListener('focusin', handleFocus);
    return () => { document.removeEventListener('click', close); document.removeEventListener('focusin', handleFocus); };
  }, [moreOpen]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/published');
    }
  };

  const handleCopyLink = async () => {
    setMoreOpen(false);
    const shareUrl = new URL(`/p/${article?.publicId || ''}`, window.location.origin).toString();
    const copied = await tryCopyText(shareUrl);
    showToast(copied ? '链接已复制' : '复制失败');
  };

  const handleOpenOriginal = () => {
    setMoreOpen(false);
    if (article?.originalUrl) window.open(article.originalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async () => {
    if (!article) return;
    const shareUrl = new URL(`/p/${article.publicId}`, window.location.origin).toString();
    setSharePending(true);
    try {
      const shareData: any = { title: article.title || 'Storing 公开发布', url: shareUrl };
      if (article.coverImage) {
        try {
          const img = await fetch(article.coverImage);
          const blob = await img.blob();
          shareData.files = [new File([blob], 'share.png', { type: blob.type || 'image/png' })];
        } catch { /* ignore */ }
      }
      if (navigator.canShare?.(shareData) && navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.share) {
        await navigator.share({ title: shareData.title, url: shareData.url });
      } else {
        const copied = await tryCopyText(shareUrl);
        showToast(copied ? '分享链接已复制' : '暂时无法复制链接');
      }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        const copied = await tryCopyText(shareUrl);
        showToast(copied ? '分享链接已复制' : '暂时无法复制链接');
      }
    } finally {
      setSharePending(false);
    }
  };

  // 监听滚动
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (el) setShowBackTop(el.scrollTop > 300);
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, article]); // re-bind when article loads

  const scrollToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const contentShell = { maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const };

  if (error) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 48, background: 'var(--card-bg)', borderBottom: '0.5px solid var(--divider)' }}>
          <div style={{ ...contentShell, height: '100%', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <button onClick={goBack} type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text)' }}>
              <LeftOutlined style={{ fontSize: 18 }} /><span>返回</span>
            </button>
          </div>
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={contentShell}>
            <h1 style={{ color: 'var(--text)', fontSize: 20 }}>文章不存在或已取消发布</h1>
            <button onClick={goBack} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>返回发布列表</button>
          </div>
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ height: 48, background: 'var(--card-bg)', borderBottom: '0.5px solid var(--divider)' }}>
          <div style={{ ...contentShell, height: '100%', display: 'flex', alignItems: 'center', padding: '0 16px' }}>
            <button onClick={goBack} type="button" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text)' }}>
              <LeftOutlined style={{ fontSize: 18 }} /><span>返回</span>
            </button>
          </div>
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={contentShell}>
            <span style={{ color: 'var(--text-muted)' }}>加载公开文章…</span>
          </div>
        </main>
      </div>
    );
  }

  const sourceIcon = getArticleSourceIcon(article);
  const SourceIcon = sourceIcon.Icon;
  const sourceText = getArticleSourceText(article);
  const originalUrl = article.originalUrl || '';
  const displayTime = article.publishedAt || article.publishTime;

  return (
    <div style={{ background: 'var(--bg)', height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航 */}
      <header className="detail-panel-header" style={{ position: 'sticky', top: 0, zIndex: 100, height: '44px', minHeight: '44px', padding: '0 16px', background: 'var(--card-bg)', borderBottom: '0.5px solid var(--divider)' }}>
        <div style={{ ...contentShell, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <button onClick={goBack} type="button" aria-label="返回" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text)' }}>
            <LeftOutlined style={{ fontSize: 18 }} /><span>返回</span>
          </button>
          {/* 更多菜单 */}
          <div ref={moreWrapRef} style={{ position: 'relative' }}>
            <button
              className={`detail-panel-action-btn${moreOpen ? ' active' : ''}`}
              type="button"
              aria-label="更多操作"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              onClick={(e) => { e.stopPropagation(); setMoreOpen((o) => !o); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <MoreOutlined style={{ fontSize: '22px', color: 'var(--text)', transform: 'rotate(90deg)' }} />
            </button>
            {moreOpen && (
              <div className="app-menu detail-more-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                <button className="app-menu-item detail-more-menu-item" role="menuitem" type="button" onClick={handleCopyLink}>
                  <CopyOutlined style={{ fontSize: 16 }} />
                  <span>复制链接</span>
                </button>
                {originalUrl && (
                  <button className="app-menu-item detail-more-menu-item" role="menuitem" type="button" onClick={handleOpenOriginal}>
                    <ExportOutlined style={{ fontSize: 16 }} />
                    <span>打开原文</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 正文区域 */}
      <main ref={contentRef} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ ...contentShell, padding: 0 }}>
          {/* 文章头部 */}
          <div className="detail-panel-content" style={{ padding: '16px' }}>
            <h1 className="detail-panel-title" style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
              {article.title || '未命名文章'}
            </h1>
            <div className="detail-panel-meta detail-panel-meta-wechat">
              <div className="detail-panel-meta-wechat-avatar" aria-hidden="true" style={{ '--source-icon-color': sourceIcon.color } as React.CSSProperties}>
                <SourceIcon />
              </div>
              <div className="detail-panel-meta-wechat-body">
                <div className="detail-panel-meta-wechat-primary">
                  <span className="detail-panel-meta-wechat-source">{sourceText}</span>
                  {article.author && article.author !== sourceText && (
                    <>
                      <span className="detail-panel-meta-wechat-divider">·</span>
                      <span className="detail-panel-meta-wechat-author">{article.author}</span>
                    </>
                  )}
                </div>
                <div className="detail-panel-meta-wechat-secondary">
                  <span className="detail-panel-meta-wechat-badge">{sourceIcon.label}</span>
                  {displayTime ? <DateText dateStr={displayTime} /> : null}
                </div>
              </div>
            </div>
            {/* AI 标签 */}
            {article.aiTags?.length > 0 && (
              <div className="detail-panel-tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: 0 }}>
                {article.aiTags.map((tag: string) => (
                  <span className="article-card-tag" key={tag} style={{ padding: '4px 10px', background: 'var(--tag-bg)', color: 'var(--text-muted)', fontSize: '12px', borderRadius: '4px', whiteSpace: 'nowrap' }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* AI 摘要 */}
          {article.aiSummary && (
            <div className={`ai-summary-block${summaryCollapsed ? ' collapsed' : ''}`} style={{ background: 'var(--tag-bg)', margin: '4px 16px 8px', borderRadius: '8px' }}>
              <button className="ai-summary-row" type="button" onClick={() => setSummaryCollapsed((c) => !c)} aria-expanded={!summaryCollapsed}>
                <div className="ai-summary-dot" aria-hidden="true" />
                <span className="ai-summary-title" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', flex: 1 }}>智能摘要</span>
                <span className="ai-summary-toggle" aria-hidden="true">{summaryCollapsed ? <DownOutlined /> : <UpOutlined />}</span>
              </button>
              {!summaryCollapsed && (
                <p className="ai-summary-text" style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{article.aiSummary}</p>
              )}
            </div>
          )}

          {/* 正文 */}
          <div className="article-content-wrap" style={{ paddingTop: '8px' }}>
            {article.contentHtml ? (
              <div className="article-body" style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
            ) : (
              <div className="article-body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--text-secondary)' }}>{article.contentMd || '正文暂不可用。'}</div>
            )}
          </div>
        </div>
        <div style={{ height: 66 }} />
      </main>

      {/* 底部操作栏 */}
      <footer className="detail-panel-footer" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, height: '66px', background: 'var(--nav-bg)', borderTop: '0.5px solid var(--divider)', boxSizing: 'border-box', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div style={{ ...contentShell, height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
          {originalUrl ? (
            <a href={originalUrl} target="_blank" rel="noopener noreferrer" title={`${sourceIcon.titlePrefix}：${sourceText}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', textDecoration: 'none', fontSize: '14px' }}>
              <SourceIcon aria-hidden="true" style={{ fontSize: '18px', color: sourceIcon.color === 'var(--text-muted)' ? 'var(--accent)' : sourceIcon.color }} />
              阅读原文
            </a>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>原文链接不可用</span>
          )}

          <div className="detail-panel-footer-actions">
            <button className="detail-panel-action-btn" onClick={handleShare} type="button" disabled={sharePending} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: sharePending ? 'wait' : 'pointer' }}>
              <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
              <span className="detail-panel-action-label" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sharePending ? '分享中' : '分享'}</span>
            </button>
          </div>
        </div>
      </footer>

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 8, background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', zIndex: 200, whiteSpace: 'nowrap' }}>
          {toastMsg}
        </div>
      )}

      {showBackTop && (
        <button onClick={scrollToTop} type="button" aria-label="回到顶部" style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--surface-alt)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer' }}>
          <UpOutlined style={{ fontSize: 16 }} />
        </button>
      )}
    </div>
  );
}
