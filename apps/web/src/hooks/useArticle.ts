'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';

export function useArticle(id: number | null, format: 'markdown' | 'html' = 'html') {
  return useSWR(id ? `article:${id}:${format}` : null, () => api.getArticle(id!, format), {
    revalidateOnFocus: false,
  });
}
