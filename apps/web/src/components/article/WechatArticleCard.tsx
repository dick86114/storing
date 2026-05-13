'use client';

import { useState } from 'react';
import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled } from '@ant-design/icons';
import { DateText } from '@/lib/formatDate';
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
      {/* 内容区域 */}
      <div style={{ padding: '12px 16px' }}>
        {/* 第一行：标题 + 三点菜单 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div
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
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
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

            {/* 下拉菜单 */}
            {menuOpen && (
              <>
                {/* 遮罩层：拦截点击，只关闭菜单 */}
                <div
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  onTouchStart={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  style={{ position: 'fixed', inset: 0, zIndex: 9 }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '28px',
                    right: '0',
                    background: 'var(--card-bg)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    padding: '8px 0',
                    minWidth: '120px',
                    zIndex: 10,
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleFavorite(e); }}
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
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(e); }}
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
                    {article.isArchived ? '取消归档' : '归档'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 第二行：封面图 */}
        {article.coverImage && (
          <img
            src={article.coverImage}
            alt=""
            style={{
              width: '100%',
              height: '120px',
              objectFit: 'cover',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
        )}

        {/* 第三行：来源 + 发布时间 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{article.source || article.author || '未知来源'}</span>
          <DateText dateStr={article.publishTime} />
        </div>
      </div>
    </div>
  );
}
