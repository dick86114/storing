'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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

  const openArticle = useCallback((id: number) => setSelectedId(id), []);
  const closeArticle = useCallback(() => setSelectedId(null), []);
  const clearHighlight = useCallback(() => setHighlightId(null), []);
  const mutateList = useCallback(() => mutateFn?.(), [mutateFn]);
  const setMutateFn = useCallback((fn: () => void) => setMutateFnState(() => fn), []);

  const highlightAndOpen = useCallback((id: number, view: 'inbox' | 'favorites' | 'archive') => {
    setHighlightId(id);
    setSelectedId(id);
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