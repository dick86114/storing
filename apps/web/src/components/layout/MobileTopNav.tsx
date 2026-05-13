'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchOutlined, PlusOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { SearchModal } from '@/components/search/SearchModal';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

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
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部或滑动关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '44px',
          padding: '0 16px',
          background: 'var(--bg)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}
      >
        {/* 左侧：Logo */}
        <div style={{ width: '44px', display: 'flex', alignItems: 'center' }}>
          <img
            src="/logo.png"
            alt="乾坤戒"
            style={{
              width: '28px',
              height: '28px',
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
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                top: '44px',
                right: '16px',
                background: 'var(--card-bg)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                padding: '4px 0',
                minWidth: '140px',
                zIndex: 200,
              }}
            >
              {/* 已登录：显示用户名 */}
              {isAuthenticated && (
                <>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 12px 4px', fontWeight: 500 }}>
                    {user?.username}
                  </div>
                  <div style={{ height: '1px', background: 'var(--divider)', margin: '4px 8px' }} />
                </>
              )}

              {/* 主题切换 */}
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

              <div style={{ height: '1px', background: 'var(--divider)', margin: '4px 8px' }} />

              {isAuthenticated ? (
                <>
                  {onAddClick && (
                    <button
                      onClick={() => {
                        onAddClick();
                        setMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: 'var(--text)',
                      }}
                    >
                      <PlusOutlined style={{ fontSize: '14px' }} />
                      添加文章
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setChangePasswordOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--text)',
                    }}
                  >
                    修改密码
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: 'var(--text)',
                    }}
                  >
                    登出
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLoginOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text)',
                  }}
                >
                  登录
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
    </>
  );
}
