'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';

export type ArticleListMutation = {
  type: 'remove';
  articleId: number;
};

interface ArticleContextValue {
  selectedId: number | null;
  highlightId: number | null;
  openArticle: (id: number) => void;
  closeArticle: () => void;
  highlightAndOpen: (id: number, view: 'inbox' | 'favorites' | 'archive') => void;
  clearHighlight: () => void;
  mutateList: (mutation?: ArticleListMutation) => void;
  setMutateFn: (fn: (mutation?: ArticleListMutation) => void) => void;
  scrollToPosition: (position: number) => void;  // 新增：滚动到指定位置
}

const ArticleContext = createContext<ArticleContextValue | null>(null);

export function ArticleProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [mutateFn, setMutateFnState] = useState<((mutation?: ArticleListMutation) => void) | null>(null);

  // 用于跟踪是否是通过 popstate 触发的关闭
  const isPopstateClose = useRef(false);

  // 打开文章时添加历史记录，支持物理返回键关闭
  const openArticle = useCallback((id: number) => {
    setSelectedId(id);
    // 添加历史记录条目，方便返回键关闭
    history.pushState({ articlePanel: true }, '');
  }, []);

  const closeArticle = useCallback(() => {
    setSelectedId(null);
    // 如果不是通过 popstate 触发的关闭，需要主动返回历史
    if (!isPopstateClose.current && history.state?.articlePanel) {
      history.back();
    }
    isPopstateClose.current = false;
    // 不再自动刷新列表，避免清空数据
    // 刷新由具体操作（归档、收藏等）触发
  }, []);

  // 监听 popstate 事件（物理返回键）
  useEffect(() => {
    const handlePopstate = () => {
      if (history.state?.articlePanel) {
        // 用户按返回键，但历史状态还有 articlePanel，说明是其他操作触发的
        // 这里不做处理，让 history 自然处理
      } else if (selectedId) {
        // 返回键触发，历史状态已无 articlePanel，关闭面板
        isPopstateClose.current = true;
        setSelectedId(null);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [selectedId]);
  const clearHighlight = useCallback(() => setHighlightId(null), []);
  const mutateList = useCallback((mutation?: ArticleListMutation) => mutateFn?.(mutation), [mutateFn]);
  const setMutateFn = useCallback((fn: (mutation?: ArticleListMutation) => void) => setMutateFnState(() => fn), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const articleParam = params.get('article');
    const scrollParam = params.get('scroll');
    const articleId = articleParam ? Number(articleParam) : NaN;
    const scrollPosition = scrollParam ? Number(scrollParam) : 0;

    if (!Number.isFinite(articleId) || articleId <= 0) return;

    setSelectedId(articleId);

    const scrollToSharedPosition = (retries = 0) => {
      const content = document.querySelector('[data-scroll-container="detail"]');
      if (content && content.scrollHeight > 0) {
        content.scrollTop = Number.isFinite(scrollPosition) && scrollPosition > 0 ? scrollPosition : 0;
        if (Math.abs(content.scrollTop - scrollPosition) > 2 && retries < 20) {
          window.setTimeout(() => scrollToSharedPosition(retries + 1), 120);
        }
      } else if (retries < 20) {
        window.setTimeout(() => scrollToSharedPosition(retries + 1), 120);
      }
    };

    window.setTimeout(() => scrollToSharedPosition(), 300);
  }, []);

  const scrollToPosition = useCallback((position: number) => {
    // 延迟执行，等详情面板渲染完成
    setTimeout(() => {
      const content = document.querySelector('[data-scroll-container="detail"]');
      if (content) {
        content.scrollTop = position;
      }
    }, 100);
  }, []);

  const highlightAndOpen = useCallback((id: number, view: 'inbox' | 'favorites' | 'archive') => {
    setHighlightId(id);
    setSelectedId(id);
    // 添加历史记录条目
    history.pushState({ articlePanel: true }, '');
    setTimeout(() => {
      const card = document.querySelector(`[data-article-id="${id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    setTimeout(() => {
      setHighlightId(null);
    }, 3000);
  }, []);

  const value = useMemo(() => ({
    selectedId,
    highlightId,
    openArticle,
    closeArticle,
    highlightAndOpen,
    clearHighlight,
    mutateList,
    setMutateFn,
    scrollToPosition,
  }), [selectedId, highlightId, openArticle, closeArticle, highlightAndOpen, clearHighlight, mutateList, setMutateFn, scrollToPosition]);

  return (
    <ArticleContext.Provider value={value}>
      {children}
    </ArticleContext.Provider>
  );
}

export function useArticleContext() {
  const ctx = useContext(ArticleContext);
  if (!ctx) throw new Error('useArticleContext must be used within ArticleProvider');
  return ctx;
}
