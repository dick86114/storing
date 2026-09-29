'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SideNavSlotContext = createContext<HTMLElement | null>(null);

export const SideNavSlotProvider = SideNavSlotContext.Provider;

export function useSideNavSlot() {
  return useContext(SideNavSlotContext);
}

/**
 * 把页面级的二级筛选（如归档的分类/来源/标签）投递到列表排版的左栏里。
 * 网格排版下没有左栏，slot 为 null，页面会退回渲染自己的侧栏。
 */
export function SideNavPortal({ children }: { children: ReactNode }) {
  const target = useSideNavSlot();
  if (!target) return null;
  return createPortal(children, target);
}
