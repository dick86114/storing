'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchOutlined, UserOutlined, DownOutlined, LogoutOutlined, LockOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

interface DesktopTopNavProps {
  onSearchOpen: () => void;
}

export function DesktopTopNav({ onSearchOpen }: DesktopTopNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 主题菜单项（访客和登录用户共用）
  const themeMenuItems = (
    <>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 500 }}>
        主题模式
      </div>
      {(['light', 'dark', 'system'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => {
            setTheme(mode);
            setMenuOpen(false);
          }}
          type="button"
          style={{
            width: '100%',
            padding: '8px 12px',
            textAlign: 'left',
            background: theme === mode ? 'var(--accent-soft)' : 'transparent',
            border: 'none',
            fontSize: '14px',
            color: theme === mode ? 'var(--accent)' : 'var(--text)',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {mode === 'light' ? '浅色模式' : mode === 'dark' ? '深色模式' : '跟随系统'}
        </button>
      ))}
    </>
  );

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '56px',
          padding: '0 24px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        {/* 左侧：Logo */}
        <div style={{ width: '120px', display: 'flex', alignItems: 'center' }}>
          <img
            src="/logo.png"
            alt="乾坤戒"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* 中间：乾坤戒 */}
        <span
          style={{
            fontSize: '16px',
            fontWeight: 500,
            color: 'var(--text)',
          }}
        >
          乾坤戒
        </span>

        {/* 右侧：搜索图标 + 菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onSearchOpen}
            type="button"
            style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
          >
            <SearchOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
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
                  <span style={{ fontSize: '14px', color: 'var(--text)' }}>{user?.username}</span>
                  <DownOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
                </>
              ) : (
                <PlusCircleOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
              )}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  minWidth: '160px',
                  background: 'var(--card-bg)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  padding: '4px 0',
                  zIndex: 200,
                }}
              >
                {themeMenuItems}

                <div style={{ height: '1px', background: 'var(--divider)', margin: '4px 8px' }} />

                {isAuthenticated ? (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <LockOutlined style={{ fontSize: '14px' }} />
                      修改密码
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <LogoutOutlined style={{ fontSize: '14px' }} />
                      登出
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setLoginOpen(true);
                    }}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    <UserOutlined style={{ fontSize: '14px' }} />
                    登录
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </>
  );
}
