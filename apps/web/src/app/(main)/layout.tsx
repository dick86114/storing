'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopNav } from '@/components/layout/TopNav';
import { TabsBar } from '@/components/layout/TabsBar';
import { HorizontalScrollContainer, TAB_KEYS } from '@/components/layout/HorizontalScrollContainer';
import { SearchModal } from '@/components/search/SearchModal';
import { ArticleDetailPanel } from '@/components/article/ArticleDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { AuthProvider, useAuth } from '@/components/providers/AuthContext';
import { useCounts } from '@/hooks/useCounts';
import { useDoubleBackExit } from '@/hooks/useDoubleBackExit';
import { InboxContent } from '@/components/content/InboxContent';
import { FavoritesContent } from '@/components/content/FavoritesContent';
import { ArchiveContent } from '@/components/content/ArchiveContent';
import { BottomTabBar } from '@/components/layout/BottomTabBar';

function MainContent({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  // 移动端双击返回退出
  useDoubleBackExit();

  // 当前 tab 索引
  const activeIndex = TAB_KEYS.findIndex(key => pathname === `/${key}`);
  const [currentTabIndex, setCurrentTabIndex] = useState(activeIndex >= 0 ? activeIndex : 0);
  const [scrollProgress, setScrollProgress] = useState<number | undefined>(undefined); // 滚动进度

  // 登录成功后刷新 counts
  useEffect(() => {
    if (isAuthenticated) {
      counts.refreshCounts();
    }
  }, [isAuthenticated, counts]);

  // 监听路由变化同步 tab 索引
  useEffect(() => {
    const index = TAB_KEYS.findIndex(key => pathname === `/${key}`);
    if (index >= 0) {
      setCurrentTabIndex(index);
    }
  }, [pathname]);

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

  // 检测是否为移动端（< 640px）
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      {/* 桌面端：显示顶部 TabsBar */}
      {!isMobile && (
        <TabsBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} scrollProgress={scrollProgress} />
      )}
      <main>
        {/* 移动端：使用滑动容器 */}
        <div className="mobile-swipe-view" style={{ display: isMobile ? 'block' : 'none' }}>
          <HorizontalScrollContainer
            activeIndex={isAuthenticated ? currentTabIndex : 0}
            isMobile={isMobile}
            onIndexChange={(index) => {
              if (isAuthenticated) {
                setCurrentTabIndex(index);
              }
            }}
            onScrollProgress={isAuthenticated ? setScrollProgress : undefined}
          >
            {isAuthenticated && <InboxContent />}
            {isAuthenticated && <FavoritesContent />}
            <ArchiveContent />
          </HorizontalScrollContainer>
        </div>
        {/* 桌面端：保持原有布局 */}
        <div className="desktop-view" style={{ display: isMobile ? 'none' : 'block', padding: 'var(--gap-md) 0 var(--gap-xl)' }}>
          <div className="mx-auto" style={{ maxWidth: 'var(--container)', paddingInline: 'var(--gutter)', position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </div>
      </main>
      {/* 移动端：显示底部 BottomTabBar */}
      {isMobile && (
        <BottomTabBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} scrollProgress={scrollProgress} />
      )}
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