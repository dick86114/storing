'use client';

import { useState, useRef, useEffect } from 'react';
import { DateText } from '@/lib/formatDate';
import { getCategoryColor } from '@/lib/categoryColors';
import type { ArticleListItem } from '@storing/shared';

export function ArticleCard({
  article,
  onClick,
  onToggleFavorite,
  onArchive,
  isHighlighted = false,
  variant = 'list',
}: {
  article: ArticleListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
  variant?: 'masonry' | 'list';
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasImage = article.coverImage && article.coverImage.trim() !== '';

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const cardContent = (
    <>
      <div className="article-card-meta">
        {/* 归档文章显示分类 */}
        {article.isArchived && article.aiCategory && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: getCategoryColor(article.aiCategory).text,
              background: getCategoryColor(article.aiCategory).bg,
              padding: '2px 6px',
              borderRadius: 4,
              marginRight: 6,
            }}
          >
            {article.aiCategory}
          </span>
        )}
        <span className="article-card-source">{article.source}</span>
        <span className="article-card-dot" />
        <DateText dateStr={article.publishTime} className="article-card-date" />
        <div style={{ flex: 1 }} />
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="article-card-menu-btn"
            aria-label="更多操作"
            title="更多操作"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="article-card-menu" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  onToggleFavorite(e);
                  setMenuOpen(false);
                }}
                className={`article-card-menu-item ${article.isFavorited ? 'favorited' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill={article.isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                {article.isFavorited ? '取消收藏' : '收藏'}
              </button>
              <button
                onClick={(e) => {
                  onArchive(e);
                  setMenuOpen(false);
                }}
                className="article-card-menu-item"
              >
                {article.isArchived ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    移回收件箱
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                      <rect width="20" height="5" x="2" y="3" rx="1" />
                      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                      <path d="M10 12h4" />
                    </svg>
                    归档
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      <h3 className="article-card-title">
        {article.title?.replace(/[\r\n]+/g, ' ')}
      </h3>
      <p className="article-card-summary">
        {article.summary}
      </p>
      <div className="article-card-tags">
        {article.aiTags.slice(0, 3).map((tag) => (
          <span key={tag} className="article-card-tag">
            {tag}
          </span>
        ))}
      </div>
    </>
  );

  // 瀑布流布局：图片在顶部
  if (variant === 'masonry' && hasImage) {
    return (
      <article
        onClick={onClick}
        className={`article-card article-card--masonry ${isHighlighted ? 'highlighted' : ''}`}
      >
        <img
          src={article.coverImage!}
          alt={article.title || '文章封面'}
          className="article-card__image"
        />
        {cardContent}
      </article>
    );
  }

  // 列表布局：图片在左侧
  if (variant === 'list' && hasImage) {
    return (
      <article
        onClick={onClick}
        className={`article-card article-card--list ${isHighlighted ? 'highlighted' : ''}`}
      >
        <img
          src={article.coverImage!}
          alt={article.title || '文章封面'}
          className="article-card__thumbnail"
        />
        <div className="article-card__content">
          {cardContent}
        </div>
      </article>
    );
  }

  // 无封面图或默认：纯文字布局
  return (
    <article
      onClick={onClick}
      className={`article-card ${isHighlighted ? 'highlighted' : ''}`}
    >
      {cardContent}
    </article>
  );
}