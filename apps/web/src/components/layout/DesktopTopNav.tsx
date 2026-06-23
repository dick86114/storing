'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { SearchOutlined, UserOutlined, DownOutlined, LogoutOutlined, LockOutlined, PlusCircleOutlined, AppstoreOutlined, HeartOutlined, FolderOutlined, SunOutlined, MoonOutlined, DesktopOutlined, BookOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { ThemeStyleMenu } from '@/components/layout/ThemeStyleMenu';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
  { key: 'wiki', label: 'Wiki', href: '/wiki', Icon: BookOutlined },
];

interface DesktopTopNavProps {
  onSearchOpen: () => void;
  counts: { inbox: number; favorites: number; archive: number; wiki?: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function DesktopTopNav({ onSearchOpen, counts, activeIndex, onTabChange }: DesktopTopNavProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme, colorScheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
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

        {/* 中间：胶囊 Tab（居中）—— 游客不显示但保留占位 */}
        <div className="desktop-nav-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}>
          {isAuthenticated && tabs.map((tab, index) => {
            const isActive = activeIndex === index;
            const count = counts[tab.key as keyof typeof counts] ?? 0;

            return (
              <button
                key={tab.key}
                className={`top-tab-button${isActive ? ' active' : ''}`}
                onClick={() => { onTabChange(index); router.push(tab.href, { scroll: false }); }}
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
                <tab.Icon className={`top-tab-icon top-tab-icon--${tab.key}`} style={{ fontSize: '15px', color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {tab.label}
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
        </div>

        {/* 右侧：搜索 + 用户菜单 */}
        <div className="desktop-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
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
                    minWidth: '180px',
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
                  <div className="app-menu-divider" />
                  <ThemeStyleMenu onSelect={() => setMenuOpen(false)} />
                  <div className="app-menu-divider" />
                  <div className="app-menu-section-label">操作</div>
                  {isAuthenticated ? (
                    <>
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
