'use client';

import { useEffect, useRef, useState, memo, type RefObject } from 'react';
import Image from 'next/image';
import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled, FieldTimeOutlined, RobotOutlined, GlobalOutlined } from '@ant-design/icons';
import { DateText } from '@/lib/formatDate';
import { getArticleSourceIcon, getArticleSourceText } from '@/components/article/articleSourceIcon';
import type { ArticleListItem } from '@storing/shared';
import { aiStatusText } from '@/lib/aiStatus';

export type ArticleCardVariant = 'grid' | 'row';

interface WechatArticleCardProps {
  article: ArticleListItem;
  onClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
  onPublish?: (id: number, e: React.MouseEvent) => void;
  showMenu?: boolean;
  highlight?: boolean;
  featured?: boolean;
  selectable?: boolean;
  selected?: boolean;
  variant?: ArticleCardVariant;
  onSelectionChange?: (id: number, selected: boolean, e: React.MouseEvent) => void;
}

interface CardMenuProps {
  article: ArticleListItem;
  open: boolean;
  setOpen: (open: boolean) => void;
  wrapRef: RefObject<HTMLDivElement | null>;
  showMenu: boolean;
  selectable: boolean;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
  onPublish?: (id: number, e: React.MouseEvent) => void;
}

function CardMenu({ article, open, setOpen, wrapRef, showMenu, selectable, onToggleFavorite, onArchive, onPublish }: CardMenuProps) {
  if (!showMenu || selectable) return null;

  return (
    <div ref={wrapRef} className="article-card-menu-wrap" style={{ position: 'relative', flexShrink: 0 }}>
      <button
        className="article-card-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        type="button"
        aria-label="更多操作"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px',
          cursor: 'pointer',
        }}
      >
        <MoreOutlined style={{ fontSize: '20px' }} />
      </button>

      {open && (
        <>
          {/* 遮罩层：拦截点击，只关闭菜单 */}
          <div
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
          />
          <div
            className="article-card-menu"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '28px',
              right: '0',
              background: 'var(--menu-bg)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
              padding: '8px 0',
              minWidth: '140px',
              zIndex: 1000,
            }}
          >
            <button
              className={`article-card-menu-item${article.isFavorited ? ' favorited' : ''}`}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onToggleFavorite(article.id, e); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: article.isFavorited ? 'var(--accent)' : '#fff',
              }}
            >
              {article.isFavorited ? (
                <HeartFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
              ) : (
                <HeartOutlined style={{ fontSize: '16px' }} />
              )}
              {article.isFavorited ? '取消收藏' : '收藏'}
            </button>
            <button
              className={`article-card-menu-item${article.isArchived ? ' favorited' : ''}`}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onArchive(article.id, e); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: article.isArchived ? 'var(--accent)' : '#fff',
              }}
            >
              {article.isArchived ? (
                <FolderFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
              ) : (
                <FolderOutlined style={{ fontSize: '16px' }} />
              )}
              {article.isArchived ? '取消归档' : '归档'}
            </button>
            {onPublish && (
              <button
                className={`article-card-menu-item${article.isPublished ? ' favorited' : ''}`}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPublish(article.id, e); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: article.isPublished ? 'var(--accent)' : '#fff',
                }}
              >
                <GlobalOutlined style={{ fontSize: '16px', color: article.isPublished ? 'var(--accent)' : undefined }} />
                {article.isPublished ? '取消发布' : '发布'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function WechatArticleCardBase({ article, onClick, onToggleFavorite, onArchive, onPublish, showMenu = true, highlight, featured = false, selectable = false, selected = false, variant = 'grid', onSelectionChange }: WechatArticleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const tags = article.aiTags?.slice(0, 3) ?? [];
  const summary = article.aiSummary?.trim() || article.summary?.trim();
  const displayTime = article.publishTime || (article.isArchived ? article.archivedAt || null : null);
  const displayTimeLabel = article.publishTime ? '发布时间' : article.isArchived && article.archivedAt ? '归档时间' : '发布时间';
  const sourceIcon = getArticleSourceIcon(article);
  const SourceIcon = sourceIcon.Icon;
  const sourceText = getArticleSourceText(article);
  const isRow = variant === 'row';

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = () => setMenuOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('blur', closeMenu);
    };
  }, [menuOpen]);

  const classNames = [
    'article-card',
    'wechat-article-card',
    isRow ? 'article-card--row' : '',
    featured ? 'article-card--featured' : '',
    highlight ? 'highlighted' : '',
    menuOpen ? 'article-card--menu-open' : '',
    selected ? 'article-card--selected' : '',
  ].filter(Boolean).join(' ');

  const openArticle = () => onClick(article.id);
  const onCardClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onSelectionChange?.(article.id, !selected, event);
  };

  const categoryLine = article.category ? (
    <div className="article-card-category-line" title={`归档分类：${article.category.name}`}>
      <span
        className="article-card-category-dot"
        style={{ backgroundColor: article.category.color || 'var(--accent)' }}
        aria-hidden="true"
      />
      <span className="article-card-category-label">归档至</span>
      <span className="article-card-category-name">{article.category.name}</span>
    </div>
  ) : article.aiCategory ? (
    <div className="article-card-category-line article-card-category-line--legacy" title={`AI 分类：${article.aiCategory}`}>
      <span className="article-card-category-label">AI 分类</span>
      <span className="article-card-category-name">{article.aiCategory}</span>
    </div>
  ) : null;

  const summaryLine = summary ? (
    <div className="article-card-insight" aria-label="摘要">
      <span className="article-card-insight-icon" aria-hidden="true">
        <RobotOutlined />
      </span>
      <span className="article-card-insight-text">
        {summary}
      </span>
    </div>
  ) : null;

  const tagLine = tags.length > 0 ? (
    <div className="article-card-tags">
      {tags.map((tag) => (
        <span key={tag} className="article-card-tag">{tag}</span>
      ))}
    </div>
  ) : null;

  const footerLine = (
    <div className="article-card-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
      <span
        title={`${sourceIcon.titlePrefix}：${sourceText}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}
      >
        <SourceIcon
          aria-hidden="true"
          style={{
            fontSize: '13px',
            flexShrink: 0,
            color: sourceIcon.color,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceText}</span>
      </span>
      <span className="article-card-ai-status">
        {aiStatusText(article.aiStatus)}
      </span>
      <span className="article-card-footer-meta">
        {article.isPublished && <span className="article-card-published-mark" title="已公开" aria-label="已公开"><GlobalOutlined aria-hidden="true" /></span>}
        <span
          title={displayTimeLabel}
          aria-label={displayTimeLabel}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <FieldTimeOutlined aria-hidden="true" style={{ fontSize: '12px' }} />
          <DateText dateStr={displayTime} />
        </span>
      </span>
    </div>
  );

  const selectToggle = selectable ? (
    <button
      className="article-card-select-toggle"
      type="button"
      aria-label="选择文章"
      aria-pressed={selected}
      onClick={(event) => {
        event.stopPropagation();
        onSelectionChange?.(article.id, !selected, event);
      }}
    >
      {selected ? '✓' : ''}
    </button>
  ) : null;

  const menu = (
    <CardMenu
      article={article}
      open={menuOpen}
      setOpen={setMenuOpen}
      wrapRef={menuWrapRef}
      showMenu={showMenu}
      selectable={selectable}
      onToggleFavorite={onToggleFavorite}
      onArchive={onArchive}
      onPublish={onPublish}
    />
  );

  if (isRow) {
    return (
      <div
        className={classNames}
        onClick={selectable ? onCardClick : openArticle}
        style={{
          position: 'relative',
          background: 'var(--card-bg)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          opacity: highlight ? 0.6 : 1,
        }}
      >
        <div className="article-card-inner">
          <div className="article-card-row">
            {selectToggle}
            {article.coverImage && (
              <div className="article-card-row-thumb">
                <Image
                  src={article.coverImage}
                  alt=""
                  fill
                  sizes="132px"
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
              </div>
            )}
            <div className="article-card-row-body">
              <div className="article-card-heading">
                <div className="article-card-title" title={article.title}>
                  {article.title}
                </div>
                {menu}
              </div>
              {categoryLine}
              {summaryLine}
              {tagLine}
              {footerLine}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames}
      onClick={selectable ? onCardClick : openArticle}
      style={{
        position: 'relative',
        background: 'var(--card-bg)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        opacity: highlight ? 0.6 : 1,
      }}
    >
      {/* 内容区域 */}
      <div className="article-card-inner" style={{ padding: '12px 16px' }}>
        <div className="article-card-main">
        {selectToggle}
        {/* 第一行：标题 + 三点菜单 */}
        <div className="article-card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div
            className="article-card-title"
            title={article.title}
            style={{
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.4,
              flex: 1,
              height: '2.8em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {article.title}
          </div>
          {menu}
        </div>

        {categoryLine}
        {summaryLine}
        {tagLine}
        </div>

        {/* 第二行：封面图 */}
        {article.coverImage && (
          <div
            className="article-card-cover"
            style={{
              position: 'relative',
              width: '100%',
              height: '120px',
              borderRadius: '4px',
              marginBottom: '8px',
              overflow: 'hidden',
            }}
          >
            <Image
              src={article.coverImage}
              alt=""
              fill
              sizes="(max-width: 639px) calc(100vw - 64px), 360px"
              unoptimized
              style={{ objectFit: 'cover' }}
            />
          </div>
        )}

        {/* 第三行：来源 + 发布时间 */}
        {footerLine}
      </div>
    </div>
  );
}

export const WechatArticleCard = memo(WechatArticleCardBase);
