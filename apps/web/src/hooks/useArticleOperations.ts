'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import type { ArticleListItem } from '@storing/shared';

/**
 * 文章操作 Hook
 * 操作成功后直接更新 SWR 缓存数据，实现即时 UI 同步。
 * 所有操作函数均用 useCallback 稳定引用，避免列表卡片 memo 失效。
 */
export function useArticleOperations() {
  const { mutate: globalMutate } = useSWRConfig();

  const updateArticleInView = useCallback(function updateArticleInView(view: string, articleId: number, updates: Partial<ArticleListItem>) {
    globalMutate(
      (key) => typeof key === 'string' && key.startsWith(`articles:${view}:`),
      (currentData: any) => {
        if (!currentData?.articles) return currentData;
        return {
          ...currentData,
          articles: currentData.articles.map((a: ArticleListItem) =>
            a.id === articleId ? { ...a, ...updates } : a
          ),
        };
      },
      false
    );
  }, [globalMutate]);

  const removeArticleFromView = useCallback(function removeArticleFromView(view: string, articleId: number) {
    globalMutate(
      (key) => typeof key === 'string' && key.startsWith(`articles:${view}:`),
      (currentData: any) => {
        if (!currentData?.articles) return currentData;
        return {
          ...currentData,
          articles: currentData.articles.filter((a: ArticleListItem) => a.id !== articleId),
          total: currentData.total - 1,
        };
      },
      false
    );
  }, [globalMutate]);

  const refreshCounts = useCallback(function refreshCounts() {
    globalMutate('counts');
    globalMutate('categories');
  }, [globalMutate]);

  const archive = useCallback(async function archive(articleId: number): Promise<boolean> {
    try {
      await api.archive(articleId);
      removeArticleFromView('inbox', articleId);
      removeArticleFromView('favorites', articleId);
      updateArticleInView('archive', articleId, { isArchived: true });
      refreshCounts();
      return true;
    } catch (error) {
      console.error('Archive failed:', error);
      return false;
    }
  }, [removeArticleFromView, updateArticleInView, refreshCounts]);

  const unarchive = useCallback(async function unarchive(articleId: number): Promise<boolean> {
    try {
      await api.unarchive(articleId);
      removeArticleFromView('archive', articleId);
      updateArticleInView('inbox', articleId, { isArchived: false });
      refreshCounts();
      return true;
    } catch (error) {
      console.error('Unarchive failed:', error);
      return false;
    }
  }, [removeArticleFromView, updateArticleInView, refreshCounts]);

  const toggleFavorite = useCallback(async function toggleFavorite(articleId: number, currentState: boolean): Promise<boolean> {
    try {
      await api.toggleFavorite(articleId);
      const newState = !currentState;
      updateArticleInView('inbox', articleId, { isFavorited: newState });
      updateArticleInView('favorites', articleId, { isFavorited: newState });
      updateArticleInView('archive', articleId, { isFavorited: newState });
      if (newState) {
        removeArticleFromView('inbox', articleId);
      }
      if (!newState) {
        removeArticleFromView('favorites', articleId);
      }
      refreshCounts();
      return true;
    } catch (error) {
      console.error('Toggle favorite failed:', error);
      return false;
    }
  }, [updateArticleInView, removeArticleFromView, refreshCounts]);

  return {
    archive,
    unarchive,
    toggleFavorite,
    updateArticleInView,
    removeArticleFromView,
    refreshCounts,
  };
}
