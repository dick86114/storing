'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

export function useSearch() {
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useSWR(
    debounced.trim() ? `search:${isAuthenticated ? 'all' : 'archive'}:${debounced}` : null,
    () => api.search(debounced),
    { revalidateOnFocus: false }
  );

  return { query, setQuery, results: data?.articles ?? [], total: data?.total ?? 0, isLoading };
}
