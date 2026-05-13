'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MobileTopNav } from '@/components/layout/MobileTopNav';
import { MobileBottomTab } from '@/components/layout/MobileBottomTab';
import { DesktopTopNav } from '@/components/layout/DesktopTopNav';
import { DesktopTabsBar } from '@/components/layout/DesktopTabsBar';
import { SearchModal } from '@/components/search/SearchModal';
import { WechatDetailPanel } from '@/components/article/WechatDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { AuthProvider, useAuth } from '@/components/providers/AuthContext';
import { useCounts } from '@/hooks/useCounts';
import { useDoubleBackExit } from '@/hooks/useDoubleBackExit';
import { InboxContent } from '@/components/content/InboxContent';
import { FavoritesContent } from '@/components/content/FavoritesContent';
import { ArchiveContent } from '@/components/content/ArchiveContent';

const TAB_KEYS = ['inbox', 'favorites', 'archive'];

function MainContent({ children }: { children: ReactNode }) {
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  useDoubleBackExit();

  // 当前 tab 索引
  const activeIndex = TAB_KEYS.findIndex(key => pathname === `/${key}`);
  const [currentTabIndex, setCurrentTabIndex] = useState(activeIndex >= 0 ? activeIndex : 0);

  // 检测是否为移动端
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // 搜索弹窗状态（桌面端）
  const [searchOpen, setSearchOpen] = useState(false);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>加载中...</span>
      </div>
    );
  }

  return (
    <>
      {/* 移动端布局 */}
      {isMobile && (
        <>
          <MobileTopNav />
          <main style={{ height: 'calc(100vh - 100px)', overflowY: 'auto', paddingBottom: '56px' }}>
            {children}
          </main>
          <MobileBottomTab
            counts={counts}
            activeIndex={currentTabIndex}
            onTabChange={setCurrentTabIndex}
          />
        </>
      )}

      {/* 桌面端布局 */}
      {!isMobile && (
        <>
          <DesktopTopNav onSearchOpen={() => setSearchOpen(true)} />
          {isAuthenticated && <DesktopTabsBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} />}
          <main style={{ padding: '24px 0', background: 'var(--bg)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
              {children}
            </div>
          </main>
        </>
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <WechatDetailPanel articleId={selectedId} onClose={closeArticle} onMutate={mutateList} isDesktop={!isMobile} />
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