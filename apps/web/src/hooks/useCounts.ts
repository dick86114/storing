'use client';

import useSWR, { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

export function useCounts() {
  const { mutate } = useSWRConfig();
  const { user, isAuthenticated } = useAuth();
  const countsKey = isAuthenticated && user ? `counts:user:${user.id}` : 'counts:public';

  // 使用合并的 counts API，减少请求次数
  const { data } = useSWR(countsKey, () => api.getCounts(), {
    revalidateOnFocus: false,
  });

  // 刷新所有计数
  const refreshCounts = () => {
    mutate(countsKey);
  };

  return {
    inbox: data?.inbox ?? 0,
    favorites: data?.favorites ?? 0,
    archive: data?.archive ?? 0,
    published: data?.published ?? 0,
    refreshCounts,
  };
}
