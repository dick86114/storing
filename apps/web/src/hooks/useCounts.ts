'use client';

import useSWR, { useSWRConfig } from 'swr';
import { api } from '@/lib/api';

export function useCounts() {
  const { mutate } = useSWRConfig();

  // 使用合并的 counts API，减少请求次数
  const { data } = useSWR('counts', () => api.getCounts(), {
    revalidateOnFocus: false,
  });

  // 刷新所有计数
  const refreshCounts = () => {
    mutate('counts');
  };

  return {
    inbox: data?.inbox ?? 0,
    favorites: data?.favorites ?? 0,
    archive: data?.archive ?? 0,
    refreshCounts,
  };
}