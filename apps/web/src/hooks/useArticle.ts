'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export function useArticle(id: number | null) {
  return useSWR(id ? `article:${id}` : null, () => api.getArticle(id!), {
    revalidateOnFocus: false,
  });
}
