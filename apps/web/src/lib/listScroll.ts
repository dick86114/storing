'use client';

import { createContext, useContext } from 'react';

/** 列表排版下右栏是独立滚动容器，无限加载的 observer 需要以它为 root。 */
export const ListScrollRootContext = createContext<HTMLElement | null>(null);

export function useListScrollRoot() {
  return useContext(ListScrollRootContext);
}

export const LIST_SCROLL_SELECTOR = '[data-scroll-container="list"]';

/** 列表排版返回右栏滚动容器；网格排版回退到 main（移动端为滚动容器）。 */
export function getListScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(LIST_SCROLL_SELECTOR) ?? document.querySelector<HTMLElement>('main');
}

export function getListScrollTop(): number {
  const container = getListScrollContainer();
  return Math.max(container?.scrollTop ?? 0, window.scrollY);
}

export function setListScrollTop(top: number) {
  const container = getListScrollContainer();
  if (container) container.scrollTop = top;
}

export function scrollListToTop() {
  const container = getListScrollContainer();
  if (container) {
    container.scrollTop = 0;
    return;
  }
  window.scrollTo(0, 0);
}
