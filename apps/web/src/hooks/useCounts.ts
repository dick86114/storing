'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export function useCounts() {
  const { data: inbox } = useSWR('count:inbox', () => api.getArticles('inbox', 1), { revalidateOnFocus: false });
  const { data: favorites } = useSWR('count:favorites', () => api.getArticles('favorites', 1), { revalidateOnFocus: false });
  const { data: archive } = useSWR('count:archive', () => api.getArticles('archive', 1), { revalidateOnFocus: false });

  return {
    inbox: inbox?.total ?? 0,
    favorites: favorites?.total ?? 0,
    archive: archive?.total ?? 0,
  };
}
