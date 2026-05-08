'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { DateText } from '@/lib/formatDate';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { api } from '@/lib/api';

export function SearchModal({ onClose }: { onClose: () => void }) {
  const { query, setQuery, results, isLoading } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const { highlightAndOpen } = useArticleContext();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [results]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[selectedIdx]) {
        handleSelect(results[selectedIdx]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, results, selectedIdx]);

  async function handleSelect(article: any) {
    onClose();
    
    const view = article.isArchived ? 'archive' : article.isFavorited ? 'favorites' : 'inbox';
    
    try {
      const positionData = await api.getArticlePosition(article.id, view);
      const targetPage = positionData.page;
      
      router.push(`/${view}?page=${targetPage}`);
      
      setTimeout(() => {
        highlightAndOpen(article.id, view);
      }, 500);
    } catch (error) {
      console.error('Failed to find article position:', error);
      router.push(`/${view}`);
      setTimeout(() => {
        highlightAndOpen(article.id, view);
      }, 300);
    }
  }

  function highlightMatch(text: string, q: string) {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ color: 'var(--accent)', background: 'transparent' }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{
        zIndex: 300,
        background: 'color-mix(in oklch, var(--bg) 70%, transparent)',
        backdropFilter: 'blur(12px)',
        paddingTop: '15vh',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="overflow-hidden border"
        style={{
          width: 'min(580px, calc(100vw - 48px))',
          background: 'var(--surface)',
          borderColor: 'var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          backdropFilter: 'blur(16px)',
          animation: 'cardIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center border-b" style={{ gap: 'var(--gap-sm)', padding: 'var(--gap-md) var(--gap-lg)', borderColor: 'var(--border)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: 'var(--muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 outline-none"
            style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 16, color: 'var(--fg)' }}
            placeholder={isAuthenticated ? '搜索文章标题、标签、来源…' : '搜索归档文章标题、标签、来源…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd
            className="rounded border"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 7px', background: 'var(--fg-soft)', borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            ESC
          </kbd>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 'var(--gap-sm)' }}>
          {!query.trim() ? (
            <div style={{ padding: 'var(--gap-xl) var(--gap-lg)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>输入关键词开始搜索</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 'var(--gap-xl) var(--gap-lg)', textAlign: 'center', color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
              {isLoading ? '搜索中…' : `没有找到与"${query}"相关的文章`}
            </div>
          ) : (
            results.map((a: any, i: number) => (
              <div
                key={a.id}
                className="flex flex-col cursor-pointer"
                style={{
                  padding: 'var(--gap-sm) var(--gap-md)',
                  borderRadius: 'var(--radius-sm)',
                  background: i === selectedIdx ? 'var(--fg-soft)' : 'transparent',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => handleSelect(a)}
              >
                <span style={{ fontWeight: 500, fontSize: 'var(--fs-sm)', marginBottom: 2 }}>{highlightMatch(a.title, query)}</span>
                <span className="flex items-center" style={{ fontSize: 'var(--fs-meta)', color: 'var(--muted)', gap: 'var(--gap-xs)' }}>
                  <span>{a.source}</span>
                  <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
                  <DateText dateStr={a.publishTime} />
                  {a.isArchived && (
                    <>
                      <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
                      <span style={{ color: 'var(--accent)' }}>已归档</span>
                    </>
                  )}
                  {a.isFavorited && !a.isArchived && (
                    <>
                      <span className="rounded-full" style={{ width: 2, height: 2, background: 'var(--muted)' }} />
                      <span style={{ color: 'var(--accent)' }}>已收藏</span>
                    </>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="flex border-t" style={{ gap: 'var(--gap-md)', padding: 'var(--gap-sm) var(--gap-lg)', fontSize: 'var(--fs-meta)', color: 'var(--muted)' }}>
          <span className="flex items-center" style={{ gap: 4 }}><kbd>↑↓</kbd> 导航</span>
          <span className="flex items-center" style={{ gap: 4 }}><kbd>↵</kbd> 打开</span>
          <span className="flex items-center" style={{ gap: 4 }}><kbd>ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}