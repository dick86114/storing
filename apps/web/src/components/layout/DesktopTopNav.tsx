'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchOutlined, UserOutlined, DownOutlined, LogoutOutlined, LockOutlined } from '@ant-design/icons';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
        {/* 左侧：Logo + Storing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/logo.png"
            alt="Storing"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              objectFit: 'cover',
            }}
          />
          <span
            style={{
              fontSize: '18px',
              fontWeight: 400,
              color: 'var(--text)',
              fontFamily: "'Brush Script MT', cursive",
            }}
          >
            Storing
          </span>
        </div>

        {/* 中间：搜索框 */}
        <div
          onClick={onSearchOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            padding: '8px 16px',
            width: '300px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <SearchOutlined style={{ fontSize: '16px', color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>搜索文章...</span>
        </div>

        {/* 右侧：用户 + 主题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isAuthenticated ? (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
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
                <UserOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                <span style={{ fontSize: '14px', color: 'var(--text)' }}>{user?.username}</span>
                <DownOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
              </button>

              {userMenuOpen && (
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
                  {/* 主题切换 */}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 500 }}>
                    主题模式
                  </div>
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setTheme(mode);
                        setUserMenuOpen(false);
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

                  <div style={{ height: '1px', background: 'var(--divider)', margin: '4px 8px' }} />

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
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
                      setUserMenuOpen(false);
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
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              type="button"
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              登录
            </button>
          )}
        </div>
      </header>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </>
  );
}
