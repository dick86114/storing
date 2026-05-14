'use client';

import { useCallback } from 'react';

const BOOKMARK_KEY = 'reading_bookmark';

export interface ReadingBookmark {
  view: 'inbox' | 'archive' | 'favorites';
  articleId: number;
  scrollPosition: number;
  articleTitle?: string;
  timestamp: number;
}

// 类型守卫
function isValidBookmark(obj: unknown): obj is ReadingBookmark {
  if (typeof obj !== 'object' || obj === null) return false;
  const bookmark = obj as Record<string, unknown>;
  return (
    'view' in bookmark && ['inbox', 'archive', 'favorites'].includes(bookmark.view as string) &&
    'articleId' in bookmark && typeof bookmark.articleId === 'number' &&
    'scrollPosition' in bookmark && typeof bookmark.scrollPosition === 'number' &&
    'timestamp' in bookmark && typeof bookmark.timestamp === 'number'
  );
}

export function useBookmark() {
  // 保存书签
  const saveBookmark = useCallback((bookmark: ReadingBookmark) => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
  }, []);

  // 获取书签
  const getBookmark = useCallback((): ReadingBookmark | null => {
    const data = localStorage.getItem(BOOKMARK_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      return isValidBookmark(parsed) ? parsed : null;
    } catch (error) {
      console.error('Failed to parse bookmark:', error);
      return null;
    }
  }, []);

  // 清除书签
  const clearBookmark = useCallback(() => {
    localStorage.removeItem(BOOKMARK_KEY);
  }, []);

  return { saveBookmark, getBookmark, clearBookmark };
}