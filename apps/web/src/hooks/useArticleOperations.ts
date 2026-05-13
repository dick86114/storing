'use client';

import { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import type { ArticleListItem } from '@storing/shared';

/**
 * 文章操作 Hook
 * 操作成功后直接更新 SWR 缓存数据，实现即时 UI 同步
 */
export function useArticleOperations() {
  const { mutate: globalMutate } = useSWRConfig();

  /**
   * 更新指定视图缓存中某篇文章的状态
   */
  function updateArticleInView(view: string, articleId: number, updates: Partial<ArticleListItem>) {
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
  }

  /**
   * 从指定视图缓存中移除某篇文章
   */
  function removeArticleFromView(view: string, articleId: number) {
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
  }

  /**
   * 刷新计数
   */
  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
    globalMutate('categories');
  }

  /**
   * 归档文章
   * - 从 inbox/favorites 移除
   * - 更新 archive 中文章状态为 isArchived=true
   */
  async function archive(articleId: number): Promise<boolean> {
    try {
      await api.archive(articleId);
      // 从收件箱和收藏页移除
      removeArticleFromView('inbox', articleId);
      removeArticleFromView('favorites', articleId);
      // 更新归档页中该文章的状态（如果已存在）
      updateArticleInView('archive', articleId, { isArchived: true });
      refreshCounts();
      return true;
    } catch (error) {
      console.error('Archive failed:', error);
      return false;
    }
  }

  /**
   * 取消归档
   * - 从 archive 移除
   * - 更新 inbox 中文章状态为 isArchived=false
   */
  async function unarchive(articleId: number): Promise<boolean> {
    try {
      await api.unarchive(articleId);
      // 从归档页移除
      removeArticleFromView('archive', articleId);
      // 更新收件箱中该文章的状态（如果已存在）
      updateArticleInView('inbox', articleId, { isArchived: false });
      refreshCounts();
      return true;
    } catch (error) {
      console.error('Unarchive failed:', error);
      return false;
    }
  }

  /**
   * 切换收藏状态
   * - 更新所有视图中的 isFavorited 状态
   * - 如果是收藏操作，从 inbox 移除
   * - 如果是取消收藏操作，从 favorites 移除
   */
  async function toggleFavorite(articleId: number, currentState: boolean): Promise<boolean> {
    try {
      await api.toggleFavorite(articleId);
      const newState = !currentState;

      // 更新所有视图中的收藏状态
      updateArticleInView('inbox', articleId, { isFavorited: newState });
      updateArticleInView('favorites', articleId, { isFavorited: newState });
      updateArticleInView('archive', articleId, { isFavorited: newState });

      // 如果变成收藏状态，从收件箱移除
      if (newState) {
        removeArticleFromView('inbox', articleId);
      }
      // 如果取消收藏，从收藏页移除
      if (!newState) {
        removeArticleFromView('favorites', articleId);
      }

      refreshCounts();
      return true;
    } catch (error) {
      console.error('Toggle favorite failed:', error);
      return false;
    }
  }

  return {
    archive,
    unarchive,
    toggleFavorite,
    updateArticleInView,
    removeArticleFromView,
    refreshCounts,
  };
}