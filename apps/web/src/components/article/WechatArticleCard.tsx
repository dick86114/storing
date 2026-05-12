'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled } from '@ant-design/icons';
import { DateText } from '@/lib/formatDate';
import { getCategoryColor } from '@/lib/categoryColors';
import type { ArticleListItem } from '@storing/shared';

interface WechatArticleCardProps {
  article: ArticleListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  highlight?: boolean;
}

export function WechatArticleCard({ article, onClick, onToggleFavorite, onArchive, highlight }: WechatArticleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const catColor = article.aiCategory ? getCategoryColor(article.aiCategory) : null;

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--card-bg)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        opacity: highlight ? 0.6 : 1,
      }}
    >
      {/* 封面图 */}
      {article.coverImage && (
        <img
          src={article.coverImage}
          alt=""
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '4px 4px 0 0',
          }}
        />
      )}

      {/* 内容区域 */}
      <div style={{ padding: '12px 16px' }}>
        {/* 第一行：标题 + 三点菜单 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {article.title}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            type="button"
            aria-expanded={menuOpen}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <MoreOutlined style={{ fontSize: '20px', color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* 第三行：作者 + 时间 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{article.author || article.source || '未知来源'}</span>
          <DateText dateStr={article.publishTime} />
        </div>
      </div>

      {/* 下拉菜单 */}
      {menuOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '40px',
            right: '16px',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            padding: '8px 0',
            minWidth: '120px',
            zIndex: 10,
          }}
        >
          <button
            onClick={onToggleFavorite}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text)',
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
            onClick={onArchive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          >
            {article.isArchived ? (
              <FolderFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
            ) : (
              <FolderOutlined style={{ fontSize: '16px' }} />
            )}
            {article.isArchived ? '移回收件箱' : '归档'}
          </button>
        </div>
      )}
    </div>
  );
}