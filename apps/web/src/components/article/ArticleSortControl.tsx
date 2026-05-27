'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckOutlined, DownOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';

export type ArticleSortKey = 'collected' | 'published' | 'favorited' | 'archived';
export type ArticleSortOrder = 'asc' | 'desc';

export interface ArticleSortOption {
  value: ArticleSortKey;
  label: string;
}

interface ArticleSortControlProps {
  options: ArticleSortOption[];
  value: ArticleSortKey;
  order: ArticleSortOrder;
  onChange: (value: ArticleSortKey) => void;
  onOrderChange: (order: ArticleSortOrder) => void;
}

export function ArticleSortControl({ options, value, order, onChange, onOrderChange }: ArticleSortControlProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeOption = useMemo(() => options.find((option) => option.value === value) ?? options[0], [options, value]);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', close, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <div className="article-sort-toolbar">
      <div ref={wrapRef} className="article-sort-control">
        <button
          type="button"
          className="article-sort-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((next) => !next)}
        >
          <span className="article-sort-prefix">排序</span>
          <span className="article-sort-current">{activeOption?.label}</span>
          <DownOutlined className={`article-sort-chevron${open ? ' open' : ''}`} />
        </button>

        {open && (
          <div className="article-sort-menu" role="menu">
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`article-sort-menu-item${isActive ? ' active' : ''}`}
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isActive && <CheckOutlined />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        className="article-sort-order-button"
        aria-label={order === 'asc' ? '切换为最新在前' : '切换为最早在前'}
        title={order === 'asc' ? '最早在前' : '最新在前'}
        onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
      >
        {order === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
      </button>
    </div>
  );
}
