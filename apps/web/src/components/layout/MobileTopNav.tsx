'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SearchOutlined, PlusOutlined, PlusCircleOutlined, UserOutlined, SunOutlined, MoonOutlined, DesktopOutlined, LockOutlined, LogoutOutlined, SettingOutlined, CloudUploadOutlined, FolderOutlined } from '@ant-design/icons';
import { SearchModal } from '@/components/search/SearchModal';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { ThemeStyleMenu } from '@/components/layout/ThemeStyleMenu';
import { useToast } from '@/components/ui/Toast';
import { APP_NAV_ITEMS, type AppNavKey } from '@/lib/navigation';

interface MobileTopNavProps {
  onAddClick?: () => void;
  onNavigate?: (key: AppNavKey) => void;
}

export function MobileTopNav({ onAddClick, onNavigate }: MobileTopNavProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme, colorScheme } = useTheme();
  const { showToast } = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const themeIcons: Record<string, React.ReactNode> = {
    light: <SunOutlined style={{ fontSize: '16px' }} />,
    dark: <MoonOutlined style={{ fontSize: '16px' }} />,
    system: <DesktopOutlined style={{ fontSize: '16px' }} />,
  };

  const themeLabels: Record<string, string> = {
    light: '浅色模式',
    dark: '深色模式',
    system: '跟随系统',
  };

  const handleMenuBlur = () => {
    window.setTimeout(() => {
      if (!menuWrapRef.current?.contains(document.activeElement)) {
        setMenuOpen(false);
      }
    }, 0);
  };

  const handleCollectClick = () => {
    onNavigate?.('collect');
    router.push(APP_NAV_ITEMS.collect.href, { scroll: false });
  };

  useEffect(() => {
    if (!menuOpen) return;

    window.setTimeout(() => menuPanelRef.current?.focus(), 0);

    const closeMenu = () => setMenuOpen(false);
    const handleFocusIn = (event: FocusEvent) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', closeMenu);
    };
  }, [menuOpen]);

  const handleConfirmLogout = async () => {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      await logout();
      setLogoutConfirmOpen(false);
      showToast('已退出登录');
      router.replace('/published');
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : '退出登录失败，请重试');
    } finally {
      setLogoutPending(false);
    }
  };

  return (
    <>
      <header
        className="app-top-nav mobile-top-nav"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '56px',
          padding: '0 16px',
          background: 'var(--bg)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}
      >
        {/* 左侧：Logo + 站点名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Image
            src="/logo.png"
            alt="乾坤戒"
            width={28}
            height={28}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
          <span className="app-brand-title">今天藏什么</span>
        </div>

        {/* 中间：空 */}
        <div />

        {/* 右侧：采集 + 搜索 + 用户菜单 */}
        <div ref={menuWrapRef} onBlurCapture={handleMenuBlur} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAuthenticated && (
            <button className="mobile-top-action" onClick={handleCollectClick} type="button" aria-label="采集文章">
              <CloudUploadOutlined />
            </button>
          )}
          <button
            className="mobile-top-action"
            onClick={() => setSearchOpen(true)}
            type="button"
            aria-label="搜索"
          >
            <SearchOutlined />
          </button>
          {isAuthenticated ? (
            <button
              className="mobile-top-action"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              aria-label="菜单"
            >
              <PlusCircleOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
            </button>
          ) : (
            <button
              className="mobile-top-action"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              aria-label="菜单"
            >
              <PlusCircleOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
            </button>
          )}

          {/* 下拉菜单 */}
          {menuOpen && (
            <>
              {/* 遮罩层：拦截点击，只关闭菜单 */}
              <div
                onClick={() => setMenuOpen(false)}
                onTouchEnd={(e) => { e.preventDefault(); setMenuOpen(false); }}
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
              />
              <div
                ref={menuPanelRef}
                className="app-menu user-menu"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '56px',
                  right: '-8px',
                  background: 'var(--menu-bg)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  padding: '8px 0',
                  minWidth: '240px',
                  zIndex: 1000,
                }}
              >
                {/* 已登录：显示用户名 */}
                {isAuthenticated && (
                  <>
                    <div className="app-menu-user" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', fontSize: '16px', color: '#fff' }}>
                      <span className="app-menu-user-seal" aria-hidden="true">
                        <UserOutlined style={{ fontSize: '16px' }} />
                      </span>
                      <span className="app-menu-user-copy">
                        <span className="app-menu-user-name">{user?.username}</span>
                        {colorScheme === 'xianxia' && <span className="app-menu-user-meta">仙府玉简</span>}
                      </span>
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '8px 12px' }} />
                  </>
                )}

                {/* 主题切换 */}
                <div className="app-menu-section-label">夜昼</div>
                <div className="user-menu-option-grid mobile-user-menu-appearance-grid">
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                    key={mode}
                    className={`app-menu-item app-menu-item--${mode} mobile-theme-icon-button${theme === mode ? ' active' : ''}`}
                    onClick={() => {
                      setTheme(mode);
                      setMenuOpen(false);
                    }}
                    type="button"
                    aria-label={themeLabels[mode]}
                    title={themeLabels[mode]}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '16px',
                      color: theme === mode ? 'var(--accent)' : '#fff',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  >
                    {themeIcons[mode]}
                  </button>
                ))}
                </div>

                <div className="app-menu-divider" />
                <ThemeStyleMenu onSelect={() => setMenuOpen(false)} />
                <div className="app-menu-divider" />
                <div className="app-menu-section-label">操作</div>

                <div className="user-menu-option-grid mobile-user-menu-action-grid">
                  {isAuthenticated ? (
                    <>
                    {onAddClick && (
                      <button
                        className="app-menu-item app-menu-item--add"
                        onClick={() => {
                          onAddClick();
                          setMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 16px',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#fff',
                        }}
                      >
                        <PlusOutlined style={{ fontSize: '16px' }} />
                        添加文章
                      </button>
                    )}
                    <button
                      className="app-menu-item app-menu-item--mcp"
                      onClick={() => { setMenuOpen(false); router.push('/settings/mcp'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff' }}
                    >
                      <SettingOutlined style={{ fontSize: '16px' }} />
                      我的 MCP
                    </button>
                    <button
                      className="app-menu-item"
                      onClick={() => { setMenuOpen(false); router.push('/settings/categories'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff' }}
                    >
                      <FolderOutlined style={{ fontSize: '16px' }} />
                      分类管理
                    </button>
                    {user?.role === 'admin' && (
                      <>
                        <button
                          className="app-menu-item app-menu-item--users-admin"
                          onClick={() => { setMenuOpen(false); router.push('/admin/users'); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff' }}
                        >
                          <UserOutlined style={{ fontSize: '16px' }} />
                          用户管理
                        </button>
                        <button
                        className="app-menu-item app-menu-item--mcp-admin"
                        onClick={() => { setMenuOpen(false); router.push('/admin/mcp'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#fff' }}
                      >
                        <SettingOutlined style={{ fontSize: '16px' }} />
                        MCP 运营控制台
                      </button>
                      </>
                    )}
                    <button
                      className="app-menu-item app-menu-item--lock"
                      onClick={() => {
                        setMenuOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: '#fff',
                      }}
                    >
                      <LockOutlined style={{ fontSize: '16px' }} />
                      修改密码
                    </button>
                    <button
                      className="app-menu-item app-menu-item--logout"
                      onClick={() => {
                        setMenuOpen(false);
                        setLogoutConfirmOpen(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 16px',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px',
                        color: '#fff',
                      }}
                    >
                      <LogoutOutlined style={{ fontSize: '16px' }} />
                      登出
                    </button>
                  </>
                ) : (
                  <button
                    className="app-menu-item app-menu-item--login"
                    onClick={() => {
                      setMenuOpen(false);
                      setLoginOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 16px',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: '#fff',
                    }}
                  >
                    <UserOutlined style={{ fontSize: '16px' }} />
                    登录
                  </button>
                )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
      {logoutConfirmOpen && (
        <LogoutConfirmDialog
          loading={logoutPending}
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={handleConfirmLogout}
        />
      )}
    </>
  );
}
