'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface ArticleContextValue {
  selectedId: number | null;
  highlightId: number | null;
  openArticle: (id: number) => void;
  closeArticle: () => void;
  highlightAndOpen: (id: number, view: 'inbox' | 'favorites' | 'archive') => void;
  clearHighlight: () => void;
  mutateList: () => void;
  setMutateFn: (fn: () => void) => void;
}

const ArticleContext = createContext<ArticleContextValue | null>(null);

export function ArticleProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [mutateFn, setMutateFnState] = useState<(() => void) | null>(null);

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
    // 延迟刷新列表（给封面图上传一些时间）
    setTimeout(() => {
      mutateFn?.();
    }, 2000);
  }, [mutateFn]);

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
        // 延迟刷新列表
        setTimeout(() => {
          mutateFn?.();
        }, 2000);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [selectedId, mutateFn]);
  const clearHighlight = useCallback(() => setHighlightId(null), []);
  const mutateList = useCallback(() => mutateFn?.(), [mutateFn]);
  const setMutateFn = useCallback((fn: () => void) => setMutateFnState(() => fn), []);

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

  return (
    <ArticleContext.Provider value={{ 
      selectedId, 
      highlightId, 
      openArticle, 
      closeArticle, 
      highlightAndOpen, 
      clearHighlight,
      mutateList, 
      setMutateFn 
    }}>
      {children}
    </ArticleContext.Provider>
  );
}

export function useArticleContext() {
  const ctx = useContext(ArticleContext);
  if (!ctx) throw new Error('useArticleContext must be used within ArticleProvider');
  return ctx;
}