'use client';

import { useState, useRef, useEffect } from 'react';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { SearchModal } from '@/components/search/SearchModal';

interface MobileTopNavProps {
  onAddClick?: () => void;
}

export function MobileTopNav({ onAddClick }: MobileTopNavProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        {/* 左侧空白占位 */}
        <div style={{ width: '44px' }} />

        {/* 中间：Logo + Storing */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>S</span>
          </div>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: 'var(--text)',
              fontFamily: "'Brush Script MT', cursive",
            }}
          >
            Storing
          </span>
        </div>

        {/* 右侧：搜索 + 加号 */}
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
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            type="button"
            aria-label="添加"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <PlusOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
          </button>

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
                padding: '8px 0',
                minWidth: '120px',
              }}
            >
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text)',
                }}
              >
                <SearchOutlined style={{ fontSize: '16px' }} />
                搜索
              </button>
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
                    padding: '12px 16px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text)',
                  }}
                >
                  <PlusOutlined style={{ fontSize: '16px' }} />
                  添加文章
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}