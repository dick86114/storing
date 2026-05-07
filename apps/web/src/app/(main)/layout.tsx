'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { TabsBar } from '@/components/layout/TabsBar';
import { SearchModal } from '@/components/search/SearchModal';
import { ArticleDetailPanel } from '@/components/article/ArticleDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { useCounts } from '@/hooks/useCounts';

function MainContent({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (selectedId) closeArticle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen, selectedId, closeArticle]);

  return (
    <>
      <TopNav onSearchOpen={() => setSearchOpen(true)} />
      <TabsBar counts={counts} />
      <main style={{ padding: 'var(--gap-md) 0 var(--gap-xl)', minHeight: '80vh' }}>
        <div className="mx-auto" style={{ maxWidth: 'var(--container)', paddingInline: 'var(--gutter)', position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </main>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <ArticleDetailPanel articleId={selectedId} onClose={closeArticle} onMutate={mutateList} />
    </>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ArticleProvider>
      <MainContent>{children}</MainContent>
    </ArticleProvider>
  );
}