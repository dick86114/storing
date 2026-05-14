'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchOutlined, UserOutlined, DownOutlined, LogoutOutlined, LockOutlined, PlusCircleOutlined, AppstoreOutlined, HeartOutlined, FolderOutlined, SunOutlined, MoonOutlined, DesktopOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
];

interface DesktopTopNavProps {
  onSearchOpen: () => void;
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function DesktopTopNav({ onSearchOpen, counts, activeIndex, onTabChange }: DesktopTopNavProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
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
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '56px',
          padding: '0 24px',
          background: 'var(--bg)',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        {/* 左侧：Logo + 乾坤戒 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <img
            src="/logo.png"
            alt="乾坤戒"
            style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
          />
          <span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text)' }}>乾坤戒</span>
        </div>

        {/* 竖线分隔 */}
        <div style={{ width: '1px', height: '20px', background: 'var(--divider)', margin: '0 20px', flexShrink: 0 }} />

        {/* 中间：胶囊 Tab（居中）—— 游客不显示但保留占位 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}>
          {isAuthenticated && tabs.map((tab, index) => {
            const isActive = activeIndex === index;
            const count = counts[tab.key as keyof typeof counts] ?? 0;

            return (
              <button
                key={tab.key}
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
                <tab.Icon style={{ fontSize: '15px', color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }} />
                <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {tab.label}
                </span>
                <span
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            onClick={onSearchOpen}
            type="button"
            style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
          >
            <SearchOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          </button>
          <div style={{ position: 'relative' }}>
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
                  {(['light', 'dark', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
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
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.2)', margin: '8px 12px' }} />
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => { setMenuOpen(false); setChangePasswordOpen(true); }}
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '16px', color: '#fff', cursor: 'pointer' }}
                      >
                        <LockOutlined style={{ fontSize: '16px' }} />
                        修改密码
                      </button>
                      <button
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
