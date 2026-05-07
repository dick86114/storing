'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export function useArticles(view: string, page: number, category?: string) {
  const key = `articles:${view}:${page}:${category || 'all'}`;
  return useSWR(key, () => api.getArticles(view, page, category), {
    revalidateOnFocus: false,
  });
}
