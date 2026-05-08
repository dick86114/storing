'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { TabsBar } from '@/components/layout/TabsBar';
import { SearchModal } from '@/components/search/SearchModal';
import { ArticleDetailPanel } from '@/components/article/ArticleDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { AuthProvider, useAuth } from '@/components/providers/AuthContext';
import { useCounts } from '@/hooks/useCounts';

function MainContent({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();
  const { isLoading, isAuthenticated } = useAuth();

  // 登录成功后刷新 counts
  useEffect(() => {
    if (isAuthenticated) {
      counts.refreshCounts();
    }
  }, [isAuthenticated]);

  // 键盘事件监听 - 必须在条件返回之前调用
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

  // 等待认证状态加载完成
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>加载中...</span>
      </div>
    );
  }

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
    <AuthProvider>
      <ArticleProvider>
        <MainContent>{children}</MainContent>
      </ArticleProvider>
    </AuthProvider>
  );
}