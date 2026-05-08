'use client';

import useSWR, { useSWRConfig } from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

export function useCounts() {
  const { isAuthenticated } = useAuth();
  const { mutate } = useSWRConfig();

  // 游客只请求 archive，管理员请求全部
  const { data: inbox } = useSWR(
    isAuthenticated ? 'count:inbox' : null,
    () => api.getArticles('inbox', 1),
    { revalidateOnFocus: false }
  );
  const { data: favorites } = useSWR(
    isAuthenticated ? 'count:favorites' : null,
    () => api.getArticles('favorites', 1),
    { revalidateOnFocus: false }
  );
  const { data: archive } = useSWR(
    'count:archive',
    () => api.getArticles('archive', 1),
    { revalidateOnFocus: false }
  );

  // 刷新所有计数
  const refreshCounts = () => {
    mutate('count:inbox');
    mutate('count:favorites');
    mutate('count:archive');
  };

  return {
    inbox: inbox?.total ?? 0,
    favorites: favorites?.total ?? 0,
    archive: archive?.total ?? 0,
    refreshCounts,
  };
}
