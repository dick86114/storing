'use client';

import type { ReactNode } from 'react';

interface ListToolbarProps {
  /** 左侧内容（例如归档页的批量整理入口） */
  start?: ReactNode;
  /** 右侧内容（排序控件） */
  end?: ReactNode;
}

/**
 * 列表顶部工具条：把「排序」和页面级操作合并到同一行，并吸附在滚动容器顶部，
 * 网格排版与列表排版共用（吸顶偏移由 --app-top-nav-h 适配各风格的顶栏高度）。
 */
export function ListToolbar({ start, end }: ListToolbarProps) {
  return (
    <div className="list-toolbar">
      <div className="list-toolbar-start">{start}</div>
      <div className="list-toolbar-end">{end}</div>
    </div>
  );
}
