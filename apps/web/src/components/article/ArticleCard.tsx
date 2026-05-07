'use client';

import { useState, useRef, useEffect } from 'react';
import { DateText } from '@/lib/formatDate';
import type { ArticleListItem } from '@storing/shared';

export function ArticleCard({
  article,
  onClick,
  onToggleFavorite,
  onArchive,
  isHighlighted = false,
}: {
  article: ArticleListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <article
      data-article-id={article.id}
      onClick={onClick}
      className="cursor-pointer border"
      style={{
        padding: 'var(--gap-md) var(--gap-lg)',
        background: 'var(--glass)',
        borderColor: isHighlighted ? 'var(--accent)' : 'var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        backdropFilter: 'blur(12px)',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        animation: isHighlighted ? 'pulseHighlight 2s ease-in-out infinite' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--accent) 30%, var(--border))';
        }
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (!isHighlighted) {
          e.currentTarget.style.borderColor = 'var(--glass-border)';
        }
        e.currentTarget.style.boxShadow = isHighlighted ? '0 0 20px color-mix(in oklch, var(--accent) 40%, transparent)' : 'none';
        e.currentTarget.style.transform = 'none';
        setMenuOpen(false);
      }}
    >
      <div className="flex items-center" style={{ gap: 'var(--gap-xs)', marginBottom: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--accent)',
          }}
        >
          {article.source}
        </span>
        <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)', flexShrink: 0 }} />
        <DateText dateStr={article.publishTime} style={{ fontSize: 11, color: 'var(--muted)' }} />
        <div style={{ flex: 1 }} />
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="grid place-items-center rounded"
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--fg-soft)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--muted)';
            }}
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
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                minWidth: 140,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                padding: 4,
                animation: 'fadeIn 0.12s ease-out',
              }}
            >
              <button
                onClick={(e) => {
                  onToggleFavorite(e);
                  setMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  color: article.isFavorited ? 'var(--accent)' : 'var(--fg)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--fg-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  color: 'var(--fg)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--fg-soft)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
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
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h3)',
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
          marginBottom: 4,
          whiteSpace: 'normal',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
        }}
      >
        {article.title?.replace(/[\r\n]+/g, ' ')}
      </h3>
      <p
        style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--muted)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {article.summary}
      </p>
      <div className="flex flex-wrap" style={{ gap: 4, marginTop: 8 }}>
        {article.aiTags.slice(0, 3).map((tag) => (
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
    </article>
  );
}