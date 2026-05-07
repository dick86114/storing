'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ArticleContextValue {
  selectedId: number | null;
  openArticle: (id: number) => void;
  closeArticle: () => void;
  mutateList: () => void;
  setMutateFn: (fn: () => void) => void;
}

const ArticleContext = createContext<ArticleContextValue | null>(null);

export function ArticleProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mutateFn, setMutateFnState] = useState<(() => void) | null>(null);

  const openArticle = useCallback((id: number) => setSelectedId(id), []);
  const closeArticle = useCallback(() => setSelectedId(null), []);
  const mutateList = useCallback(() => mutateFn?.(), [mutateFn]);
  const setMutateFn = useCallback((fn: () => void) => setMutateFnState(() => fn), []);

  return (
    <ArticleContext.Provider value={{ selectedId, openArticle, closeArticle, mutateList, setMutateFn }}>
      {children}
    </ArticleContext.Provider>
  );
}

export function useArticleContext() {
  const ctx = useContext(ArticleContext);
  if (!ctx) throw new Error('useArticleContext must be used within ArticleProvider');
  return ctx;
}
