'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SearchOutlined, UserOutlined, DownOutlined, LogoutOutlined, LockOutlined, PlusCircleOutlined, AppstoreOutlined, HeartOutlined, FolderOutlined, ExportOutlined, SunOutlined, MoonOutlined, DesktopOutlined, BookOutlined, CloudUploadOutlined, SettingOutlined, MoreOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { ThemeStyleMenu } from '@/components/layout/ThemeStyleMenu';
import { APP_NAV_ITEMS, PRIMARY_NAV_KEYS, SECONDARY_NAV_KEYS, isSecondaryNavKey, type AppNavKey } from '@/lib/navigation';

const NAV_ICONS = {
  inbox: AppstoreOutlined,
  favorites: HeartOutlined,
  archive: FolderOutlined,
  published: ExportOutlined,
  wiki: BookOutlined,
  collect: CloudUploadOutlined,
} satisfies Record<AppNavKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>;

interface DesktopTopNavProps {
  onSearchOpen: () => void;
  counts: { inbox: number; favorites: number; archive: number; published?: number; wiki?: number };
  activeKey: AppNavKey | null;
  onNavigate: (key: AppNavKey) => void;
}

export function DesktopTopNav({ onSearchOpen, counts, activeKey, onNavigate }: DesktopTopNavProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme, colorScheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMoreOpen, setNavMoreOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const navMoreWrapRef = useRef<HTMLDivElement>(null);

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
  const navigateTo = (key: AppNavKey) => {
    setNavMoreOpen(false);
    onNavigate(key);
    router.push(APP_NAV_ITEMS[key].href, { scroll: false });
  };

  // When the current page lives in the More menu, surface its label/icon on the trigger.
  const secondaryActiveKey = isSecondaryNavKey(activeKey) ? activeKey : null;
  const SecondaryActiveIcon = secondaryActiveKey ? NAV_ICONS[secondaryActiveKey] : null;

  const handleMenuBlur = () => {
    window.setTimeout(() => {
      if (!menuWrapRef.current?.contains(document.activeElement)) {
        setMenuOpen(false);
      }
    }, 0);
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

  useEffect(() => {
    if (!navMoreOpen) return;
    const closeMore = (event: MouseEvent) => {
      if (!navMoreWrapRef.current?.contains(event.target as Node)) setNavMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavMoreOpen(false);
    };
    document.addEventListener('mousedown', closeMore);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', closeMore);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navMoreOpen]);

  return (
    <>
      <header
        className="app-top-nav desktop-top-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '56px',
          padding: '0 24px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        {/* 左侧：Logo + 标题 */}
        <div className="desktop-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <Image
            src="/logo.png"
            alt="乾坤戒"
            width={28}
            height={28}
            style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
          />
          <span className="app-brand-title">今天藏什么</span>
        </div>

        {/* 竖线分隔 */}
        <div className="desktop-nav-divider" style={{ width: '1px', height: '20px', background: 'var(--divider)', margin: '0 20px', flexShrink: 0 }} />

        {/* 中间：核心内容导航 */}
        <div className="desktop-nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}>
          {isAuthenticated && PRIMARY_NAV_KEYS.map((key) => {
            const item = APP_NAV_ITEMS[key];
            const Icon = NAV_ICONS[key];
            const isActive = activeKey === key;
            const count = counts[key] ?? 0;

            return (
              <button
                key={key}
                className={`top-tab-button${isActive ? ' active' : ''}`}
                onClick={() => navigateTo(key)}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: isActive ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                >
                <Icon className={`top-tab-icon top-tab-icon--${key}`} style={{ fontSize: '15px', color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <span className="top-tab-label" style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {item.label}
                </span>
                <span
                  className="top-tab-count"
                  style={{
                    padding: '1px 7px',
                    background: isActive ? 'var(--accent-soft)' : 'var(--tag-bg)',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '11px',
                    borderRadius: '10px',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {isAuthenticated && (
            <div className="nav-more-wrap" ref={navMoreWrapRef}>
              <button
                className={`top-tab-button nav-more-trigger${secondaryActiveKey ? ' active' : ''}`}
                type="button"
                aria-label={secondaryActiveKey ? `更多导航（当前：${APP_NAV_ITEMS[secondaryActiveKey].label}）` : '更多导航'}
                aria-haspopup="menu"
                aria-expanded={navMoreOpen}
                onClick={() => setNavMoreOpen((open) => !open)}
              >
                {SecondaryActiveIcon && secondaryActiveKey ? (
                  <>
                    <SecondaryActiveIcon className="top-tab-icon" />
                    <span>{APP_NAV_ITEMS[secondaryActiveKey].label}</span>
                  </>
                ) : (
                  <>
                    <MoreOutlined className="top-tab-icon" />
                    <span>更多</span>
                  </>
                )}
                <DownOutlined className="nav-more-chevron" />
              </button>
              {navMoreOpen && (
                <div className="app-menu nav-more-menu" role="menu">
                  {SECONDARY_NAV_KEYS.map((key) => {
                    const item = APP_NAV_ITEMS[key];
                    const Icon = NAV_ICONS[key];
                    const isActive = activeKey === key;
                    const count = counts[key] ?? 0;
                    return (
                      <button key={key} className={`app-menu-item nav-more-menu-item${isActive ? ' active' : ''}`} type="button" role="menuitem" onClick={() => navigateTo(key)}>
                        <Icon />
                        <span className="nav-more-menu-copy">
                          <strong>{item.label}</strong>
                          <small>{key === 'published' ? '管理已公开文章' : '浏览知识库'}</small>
                        </span>
                        <span className="nav-more-menu-count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧：采集操作 + 搜索 + 用户菜单 */}
        <div className="desktop-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {isAuthenticated && (
            <button className="desktop-collect-trigger" onClick={() => navigateTo('collect')} type="button" aria-label="采集文章" title="采集文章">
              <CloudUploadOutlined />
            </button>
          )}
          <button
            className="desktop-search-trigger"
            onClick={onSearchOpen}
            type="button"
            style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
          >
            <SearchOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          </button>
          <div className="desktop-user-menu-wrap" ref={menuWrapRef} onBlurCapture={handleMenuBlur} style={{ position: 'relative' }}>
            <button
              className="desktop-user-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              {isAuthenticated ? (
                <>
                  <UserOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
                  <span style={{ fontSize: '16px', color: 'var(--text)' }}>{user?.username}</span>
                  <DownOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                </>
              ) : (
                <PlusCircleOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
              )}
            </button>

            {menuOpen && (
              <>
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
                    top: '100%',
                    right: '-8px',
                    marginTop: '4px',
                    minWidth: '240px',
                    background: 'var(--menu-bg)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    padding: '8px 0',
                    zIndex: 1000,
                  }}
                >
                  {isAuthenticated && (
                    <div className="app-menu-user">
                      <span className="app-menu-user-seal" aria-hidden="true">
                        <UserOutlined style={{ fontSize: '16px' }} />
                      </span>
                      <span className="app-menu-user-copy">
                        <span className="app-menu-user-name">{user?.username}</span>
                        {colorScheme === 'xianxia' && <span className="app-menu-user-meta">仙府玉简</span>}
                      </span>
                    </div>
                  )}
                  <div className="app-menu-section-label">夜昼</div>
                  <div className="user-menu-option-grid user-menu-appearance-grid">
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`app-menu-item app-menu-item--${mode}${theme === mode ? ' active' : ''}`}
                      onClick={() => {
                        setTheme(mode);
                        setMenuOpen(false);
                      }}
                      type="button"
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
                      {themeLabels[mode]}
                    </button>
                    ))}
                  </div>
                  <div className="app-menu-divider" />
                  <ThemeStyleMenu onSelect={() => setMenuOpen(false)} />
                  <div className="app-menu-divider" />
                  <div className="app-menu-section-label">操作</div>
                  <div className="user-menu-option-grid user-menu-action-grid">
                    {isAuthenticated ? (
                    <>
                      <button
                        className="app-menu-item app-menu-item--mcp"
                        onClick={() => { setMenuOpen(false); router.push('/settings/mcp'); }}
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                      >
                        <SettingOutlined style={{ fontSize: '16px' }} />
                        我的 MCP
                      </button>
                      {user?.role === 'admin' && (
                        <>
                          <button
                            className="app-menu-item app-menu-item--users-admin"
                            onClick={() => { setMenuOpen(false); router.push('/admin/users'); }}
                            type="button"
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                          >
                            <UserOutlined style={{ fontSize: '16px' }} />
                            用户管理
                          </button>
                          <button
                          className="app-menu-item app-menu-item--mcp-admin"
                          onClick={() => { setMenuOpen(false); router.push('/admin/mcp'); }}
                          type="button"
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                        >
                          <SettingOutlined style={{ fontSize: '16px' }} />
                          MCP 运营控制台
                        </button>
                        </>
                      )}
                      <button
                        className="app-menu-item app-menu-item--lock"
                        onClick={() => { setMenuOpen(false); setChangePasswordOpen(true); }}
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                      >
                        <LockOutlined style={{ fontSize: '16px' }} />
                        修改密码
                      </button>
                      <button
                        className="app-menu-item app-menu-item--logout"
                        onClick={() => { setMenuOpen(false); logout(); }}
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                      >
                        <LogoutOutlined style={{ fontSize: '16px' }} />
                        登出
                      </button>
                    </>
                  ) : (
                    <button
                      className="app-menu-item app-menu-item--login"
                      onClick={() => { setMenuOpen(false); setLoginOpen(true); }}
                      type="button"
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
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
        </div>
      </header>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </>
  );
}
