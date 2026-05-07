'use client';

import useSWRInfinite from 'swr/infinite';
import { api } from '@/lib/api';

const PER_PAGE = 12;

export function useInfiniteArticles(view: string, category?: string) {
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.articles?.length) return null;
    return `articles:${view}:${pageIndex + 1}:${category || 'all'}`;
  };

  const { data, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(
    getKey,
    (key) => {
      const [, , pageStr] = key.split(':');
      return api.getArticles(view, parseInt(pageStr), category, PER_PAGE);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  const articles = data ? data.flatMap((d: any) => d.articles ?? []) : [];
  const total = data?.[0]?.total ?? 0;
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.articles?.length === 0;
  const isReachingEnd = isEmpty || (data && (data[data.length - 1]?.articles?.length ?? 0) < PER_PAGE);

  return {
    articles,
    total,
    size,
    setSize,
    isLoading,
    isLoadingMore,
    isReachingEnd,
    isValidating,
    mutate,
  };
}
