'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MobileTopNav } from '@/components/layout/MobileTopNav';
import { MobileBottomTab } from '@/components/layout/MobileBottomTab';
import { DesktopTopNav } from '@/components/layout/DesktopTopNav';
import { AppSideNav } from '@/components/layout/AppSideNav';
import { SideNavSlotProvider } from '@/components/layout/SideNavSlot';
import { SearchModal } from '@/components/search/SearchModal';
import { WechatDetailPanel } from '@/components/article/WechatDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useCounts } from '@/hooks/useCounts';
import { useDoubleBackExit } from '@/hooks/useDoubleBackExit';
import { ListScrollRootContext } from '@/lib/listScroll';
import { InboxContent } from '@/components/content/InboxContent';
import { FavoritesContent } from '@/components/content/FavoritesContent';
import { ArchiveContent } from '@/components/content/ArchiveContent';
import { APP_NAV_ITEMS, getAppNavKey, MOBILE_NAV_BREAKPOINT, type AppNavKey } from '@/lib/navigation';

function RouteSwitchLoading({ label }: { label: string }) {
  return (
    <div className="route-switch-loading" role="status" aria-live="polite">
      <div className="route-switch-loading-head">
        <span className="route-switch-spinner" />
        <strong>正在打开 {label}</strong>
      </div>
      <div className="route-switch-loading-grid">
        <div className="route-switch-card">
          <span />
          <span />
          <span />
        </div>
        <div className="route-switch-card">
          <span />
          <span />
          <span />
        </div>
        <div className="route-switch-card route-switch-card-muted">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function MainContent({ children }: { children: ReactNode }) {
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();
  const { isLoading, isAuthenticated, bootState, retryBoot } = useAuth();
  const { layout } = useTheme();
  const pathname = usePathname();

  useDoubleBackExit();

  const activeNavKey = getAppNavKey(pathname);
  const [pendingNavKey, setPendingNavKey] = useState<AppNavKey | null>(null);
  const isRouteSwitching = pendingNavKey !== null && pendingNavKey !== activeNavKey;
  const pendingTabLabel = pendingNavKey ? APP_NAV_ITEMS[pendingNavKey].label : '页面';

  // 列表排版：桌面端左栏导航 + 右栏独立滚动容器
  const isListLayout = layout === 'list';
  const [sideNavSlotEl, setSideNavSlotEl] = useState<HTMLDivElement | null>(null);
  const [listScrollEl, setListScrollEl] = useState<HTMLDivElement | null>(null);

  // 检测是否为移动端
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_NAV_BREAKPOINT);
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

  useEffect(() => {
    setPendingNavKey(null);
  }, [pathname]);
 
  // 游客访问私有路由时重定向到发布页
  useEffect(() => {
     if (bootState.status === 'unauthenticated') {
       const privateRoutes = ['/inbox', '/favorites', '/archive', '/collect', '/settings', '/admin'];
       if (privateRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) {
         window.location.href = '/published';
       }
     }
   }, [bootState.status, pathname]);

  // 搜索弹窗状态（桌面端）
  const [searchOpen, setSearchOpen] = useState(false);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>加载中...</span>
      </div>
  );
  }

  if (bootState.status === 'bootFailed') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>网络暂时不可用，请重试</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>你的登录状态不会被清除。</p>
          <button
            type="button"
            onClick={retryBoot}
            style={{
              minHeight: '40px',
              padding: '0 24px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 移动端布局 */}
      {isMobile && (
        <>
          <MobileTopNav onNavigate={setPendingNavKey} />
          <main
            className="hide-scrollbar app-main mobile-main"
            style={{
              height: isAuthenticated ? 'calc(100dvh - 56px)' : 'calc(100dvh - 56px)',
              overflowY: 'auto',
              paddingBottom: 'calc(66px + env(safe-area-inset-bottom, 0px))',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {isRouteSwitching ? <RouteSwitchLoading label={pendingTabLabel} /> : children}
          </main>
          <MobileBottomTab
            counts={counts}
            activeKey={activeNavKey}
            onNavigate={setPendingNavKey}
          />
        </>
      )}

      {/* 桌面端布局 */}
      {!isMobile && (
        <>
          <DesktopTopNav onSearchOpen={() => setSearchOpen(true)} counts={counts} activeKey={activeNavKey} onNavigate={setPendingNavKey} />
          <main
            className={`app-main desktop-main desktop-workbench${isListLayout ? ' app-shell--list' : ''}`}
            style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--bg)' }}
          >
            {isListLayout ? (
              <div
                className="desktop-main-shell desktop-main-shell--list"
                style={{ margin: 0, padding: 0, width: '100%', maxWidth: 'none' }}
              >
                <SideNavSlotProvider value={sideNavSlotEl}>
                  <ListScrollRootContext.Provider value={listScrollEl}>
                    <div className="desktop-shell-grid">
                      <AppSideNav
                        counts={counts}
                        activeKey={activeNavKey}
                        onNavigate={setPendingNavKey}
                        slotRef={setSideNavSlotEl}
                      />
                      <div className="desktop-shell-content" ref={setListScrollEl} data-scroll-container="list">
                        {isRouteSwitching ? <RouteSwitchLoading label={pendingTabLabel} /> : children}
                      </div>
                    </div>
                  </ListScrollRootContext.Provider>
                </SideNavSlotProvider>
              </div>
            ) : (
              <div className="desktop-main-shell" style={{ margin: '0 auto', padding: '0 24px' }}>
                {isRouteSwitching ? <RouteSwitchLoading label={pendingTabLabel} /> : children}
              </div>
            )}
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
    <ArticleProvider>
      <MainContent>{children}</MainContent>
    </ArticleProvider>
  );
}
