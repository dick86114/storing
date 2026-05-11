'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthContext';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

const COLOR_SCHEMES = [
  { key: 'default', label: '默认', icon: '◐' },
  { key: 'spring', label: '春', icon: '🌸' },
  { key: 'summer', label: '夏', icon: '☀️' },
  { key: 'autumn', label: '秋', icon: '🍂' },
  { key: 'winter', label: '冬', icon: '❄' },
  { key: 'glass', label: '玻璃', icon: '💎' },
];

export function TopNav({ onSearchOpen }: { onSearchOpen: () => void }) {
  const { theme, resolved, setTheme, colorScheme, setColorScheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-[100] border-b"
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        borderColor: 'var(--glass-border)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{
          maxWidth: 'var(--container)',
          padding: '10px var(--gutter)',
          gap: 'var(--gap-md)',
        }}
      >
        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
          <img
            src="/logo.png"
            alt="乾坤戒"
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--radius-sm)',
              objectFit: 'contain',
            }}
          />
          <span
            className="font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}
          >
            乾坤戒
          </span>
        </div>

        <div className="flex items-center shrink-0" style={{ gap: 6 }}>
          {/* 登录/用户菜单 */}
          {isAuthenticated ? (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center rounded"
                style={{
                  gap: 6,
                  padding: '6px 10px',
                  background: 'var(--glass)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16, color: 'var(--muted)' }}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg)' }}>{user?.username}</span>
              </button>

              {/* 下拉菜单 */}
              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    minWidth: 140,
                    background: 'var(--glass)',
                    backdropFilter: 'blur(16px) saturate(1.4)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 4,
                  }}
                >
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setChangePasswordOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                    }}
                  >
                    修改密码
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                    }}
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="flex items-center rounded border"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius)',
                background: 'var(--glass)',
                borderColor: 'var(--glass-border)',
                color: 'var(--accent)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
              }}
            >
              登录
            </button>
          )}

          <button
            onClick={onSearchOpen}
            className="flex items-center rounded border"
            style={{
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              background: 'var(--glass)',
              borderColor: 'var(--glass-border)',
              color: 'var(--muted)',
              fontSize: 'var(--fs-sm)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="搜索"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 14, height: 14, flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden sm:inline">搜索文章…</span>
            <kbd
              className="hidden sm:inline-block rounded border"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '2px 5px',
                background: 'var(--fg-soft)',
                borderColor: 'var(--border)',
                color: 'var(--muted)',
                marginLeft: 8,
              }}
            >
              ⌘K
            </kbd>
          </button>
          {/* 主题切换 */}
          <div ref={themeMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="grid place-items-center rounded"
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--muted)',
              }}
              aria-label="切换主题"
            >
              {resolved === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </button>

            {themeMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  minWidth: 160,
                  background: 'var(--glass)',
                  backdropFilter: 'blur(16px) saturate(1.4)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 4,
                }}
              >
                {/* 主题模式 */}
                <div style={{ fontSize: 10, color: 'var(--muted)', padding: '6px 12px 4px', fontFamily: 'var(--font-mono)' }}>
                  主题模式
                </div>
                <button
                  onClick={() => {
                    setTheme('light');
                    setThemeMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: theme === 'light' ? 'var(--fg-soft)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                  }}
                >
                  浅色模式
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    setThemeMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: theme === 'dark' ? 'var(--fg-soft)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                  }}
                >
                  深色模式
                </button>
                <button
                  onClick={() => {
                    setTheme('system');
                    setThemeMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: theme === 'system' ? 'var(--fg-soft)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                  }}
                >
                  跟随系统
                </button>

                {/* 分隔线 */}
                <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />

                {/* 配色方案 */}
                <div style={{ fontSize: 10, color: 'var(--muted)', padding: '6px 12px 4px', fontFamily: 'var(--font-mono)' }}>
                  配色方案
                </div>
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.key}
                    onClick={() => {
                      setColorScheme(scheme.key as any);
                      setThemeMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: colorScheme === scheme.key ? 'var(--fg-soft)' : 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--fs-sm)',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{scheme.icon}</span>
                    {scheme.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 登录弹窗 */}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {/* 修改密码弹窗 */}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </header>
  );
}
