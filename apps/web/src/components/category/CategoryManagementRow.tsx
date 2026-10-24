'use client';

import React, { useRef } from 'react';
import { ArrowDownOutlined, ArrowUpOutlined, DragOutlined } from '@ant-design/icons';

import type { ArchiveCategory } from '@/lib/api';

type CategoryManagementRowProps = {
  category: ArchiveCategory;
  count: number;
  selected: boolean;
  first: boolean;
  last: boolean;
  locked: boolean;
  draggedId: number | null;
  onSelect: () => void;
  onMove: (offset: -1 | 1) => void;
  onDragStart: (categoryId: number) => void;
  onDragEnd: () => void;
  onDrop: (targetId: number) => void;
};

export function CategoryManagementRow({
  category,
  count,
  selected,
  first,
  last,
  locked,
  draggedId,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  onDrop,
}: CategoryManagementRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const canDrag = !category.isSystem && !locked;

  return (
    <div
      ref={rowRef}
      className={`category-management-row${selected ? ' is-selected' : ''}${category.isActive ? '' : ' is-inactive'}`}
      data-category-row-id={category.id}
      onDragOver={(event) => {
        if (!category.isSystem && draggedId !== null) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!category.isSystem && draggedId !== null) onDrop(category.id);
      }}
      role="option"
      aria-selected={selected}
    >
      {category.isSystem ? (
        <span className="category-management-fixed" title="系统分类不可排序">固定</span>
      ) : (
        <button
          className="category-management-drag"
          type="button"
          draggable={canDrag}
          aria-label={`拖动${category.name}排序；也可用上下方向键移动`}
          disabled={locked}
          onDragStart={(event) => {
            if (!canDrag) return;
            const row = rowRef.current;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(category.id));
            if (row && typeof event.dataTransfer.setDragImage === 'function') {
              event.dataTransfer.setDragImage(row, Math.min(32, row.clientWidth / 2), 22);
            }
            onDragStart(category.id);
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onMove(-1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              onMove(1);
            }
          }}
        >
          <DragOutlined aria-hidden="true" />
        </button>
      )}
      <button className="category-management-row-main" type="button" disabled={locked} onClick={onSelect}>
        <span className="category-management-color" style={{ background: category.color ?? 'var(--text-muted)' }} aria-hidden="true" />
        <span className="category-management-name">{category.name}</span>
        {!category.isActive && <span className="category-management-badge">停用</span>}
        {category.isSystem && <span className="category-management-badge is-system">系统</span>}
        <strong>{count}</strong>
      </button>
      {!category.isSystem && (
        <span className="category-management-keyboard-actions">
          <button type="button" aria-label={`上移${category.name}`} disabled={locked || first} onClick={() => onMove(-1)}><ArrowUpOutlined /></button>
          <button type="button" aria-label={`下移${category.name}`} disabled={locked || last} onClick={() => onMove(1)}><ArrowDownOutlined /></button>
        </span>
      )}
    </div>
  );
}
