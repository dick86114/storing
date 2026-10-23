'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/AuthContext';
import type { ArchiveCategory } from '@/lib/api';
import { readCategoryRecents, rememberCategoryRecent } from '@/lib/category-catalog';

type RecentState = { userId: number | null; ids: number[] };

export function useCategoryRecents(activeCategories: ArchiveCategory[]) {
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated ? user?.id ?? null : null;
  const activeIdsKey = useMemo(
    () => activeCategories.map((category) => category.id).join(','),
    [activeCategories],
  );
  const [state, setState] = useState<RecentState>({ userId: null, ids: [] });

  useEffect(() => {
    if (userId === null) {
      setState({ userId: null, ids: [] });
      return;
    }
    const activeIds = new Set(activeCategories.map((category) => category.id));
    setState({
      userId,
      ids: readCategoryRecents(window.localStorage, userId, activeIds),
    });
  }, [activeCategories, activeIdsKey, userId]);

  useEffect(() => {
    if (userId === null) return;
    const storageKey = `category.recents.${userId}`;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const activeIds = new Set(activeCategories.map((category) => category.id));
      setState({
        userId,
        ids: readCategoryRecents(window.localStorage, userId, activeIds),
      });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [activeCategories, userId]);

  const remember = useCallback((categoryId: number) => {
    if (userId === null) return;
    const activeIds = new Set(activeCategories.map((category) => category.id));
    activeIds.add(categoryId);
    const ids = rememberCategoryRecent(window.localStorage, userId, categoryId, activeIds);
    setState({ userId, ids });
  }, [activeCategories, userId]);

  return {
    userId,
    recentCategoryIds: state.userId === userId ? state.ids : [],
    remember,
  };
}
