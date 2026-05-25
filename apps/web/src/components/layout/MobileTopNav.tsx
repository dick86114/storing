'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SearchOutlined, PlusOutlined, PlusCircleOutlined, UserOutlined, SunOutlined, MoonOutlined, DesktopOutlined, LockOutlined, LogoutOutlined } from '@ant-design/icons';
import { SearchModal } from '@/components/search/SearchModal';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import { ThemeStyleMenu } from '@/components/layout/ThemeStyleMenu';

interface MobileTopNavProps {
  onAddClick?: () => void;
}

export function MobileTopNav({ onAddClick }: MobileTopNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

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

        {/* 右侧：搜索 + 加号/用户菜单 */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            type="button"
            aria-label="搜索"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <SearchOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              aria-label="菜单"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              <PlusCircleOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
            </button>
          ) : (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              aria-label="菜单"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
              }}
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
                className="app-menu user-menu"
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
                  minWidth: '180px',
                  zIndex: 1000,
                }}
              >
                {/* 已登录：显示用户名 */}
                {isAuthenticated && (
                  <>
                    <div className="app-menu-user" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', fontSize: '16px', color: '#fff' }}>
                      <UserOutlined style={{ fontSize: '16px' }} />
                      {user?.username}
                    </div>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '8px 12px' }} />
                  </>
                )}

                {/* 主题切换 */}
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
                        logout();
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
            </>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </>
  );
}
