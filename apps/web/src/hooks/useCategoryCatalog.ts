'use client';

import { useCallback, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { useAuth } from '@/components/providers/AuthContext';
import { api } from '@/lib/api';
import { activeCategoriesFrom, categoryCatalogKey } from '@/lib/category-catalog';

export function useCategoryCatalog() {
  const { user, isAuthenticated } = useAuth();
  const userId = isAuthenticated ? user?.id ?? null : null;
  const key = userId === null ? null : categoryCatalogKey(userId);
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    () => api.getCategories(true),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      keepPreviousData: false,
    },
  );

  const isReady = data !== undefined && !error;
  const activeCategories = useMemo(() => activeCategoriesFrom(data), [data]);
  const counts = useMemo(() => Object.fromEntries(
    Object.entries(data?.counts ?? {}).map(([id, count]) => [Number(id), count]),
  ), [data?.counts]);
  const totalCount = useMemo(
    () => Object.values(data?.counts ?? {}).reduce((sum, count) => sum + count, 0),
    [data?.counts],
  );

  return {
    userId,
    key,
    data,
    categories: data?.categories ?? [],
    activeCategories,
    inactiveCategories: (data?.categories ?? []).filter((category) => !category.isActive),
    counts,
    totalCount,
    error,
    isReady,
    isLoading,
    isValidating,
    mutate,
    refresh: mutate,
  };
}

export function useRefreshCategoryCatalog() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate(
    (key) => typeof key === 'string' && key.startsWith('categories:user:'),
    undefined,
    { revalidate: true },
  ), [mutate]);
}
