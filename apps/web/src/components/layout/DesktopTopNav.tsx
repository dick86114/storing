'use client';

import { SearchOutlined, UserOutlined, SunOutlined, MoonOutlined, DownOutlined } from '@ant-design/icons';

interface DesktopTopNavProps {
  onSearchOpen: () => void;
}

export function DesktopTopNav({ onSearchOpen }: DesktopTopNavProps) {
  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <UserOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          <span style={{ fontSize: '14px', color: 'var(--text)' }}>admin</span>
          <DownOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
        </div>
      </div>
    </header>
  );
}