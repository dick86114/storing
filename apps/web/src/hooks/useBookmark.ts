'use client';

const BOOKMARK_KEY = 'reading_bookmark';

export interface ReadingBookmark {
  view: 'inbox' | 'archive' | 'favorites';
  articleId: number;
  scrollPosition: number;
  articleTitle?: string;
  timestamp: number;
}

export function useBookmark() {
  // 保存书签
  const saveBookmark = (bookmark: ReadingBookmark) => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
  };

  // 获取书签
  const getBookmark = (): ReadingBookmark | null => {
    const data = localStorage.getItem(BOOKMARK_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as ReadingBookmark;
    } catch {
      return null;
    }
  };

  // 清除书签
  const clearBookmark = () => {
    localStorage.removeItem(BOOKMARK_KEY);
  };

  return { saveBookmark, getBookmark, clearBookmark };
}