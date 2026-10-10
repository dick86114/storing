'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ArticleSelection {
  selectedIds: Set<number>;
  hasSelection: boolean;
  isSelected: (id: number) => boolean;
  toggle: (id: number) => void;
  selectAllLoaded: () => void;
  invert: () => void;
  remove: (ids: Iterable<number>) => void;
  clear: () => void;
}

export function useArticleSelection(articleIds: number[]): ArticleSelection {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const articleIdsKey = useMemo(() => articleIds.join(','), [articleIds]);

  useEffect(() => {
    setSelectedIds((current) => {
      const available = new Set(articleIds);
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [articleIdsKey]);

  const toggle = useCallback((id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllLoaded = useCallback(() => {
    setSelectedIds(new Set(articleIds));
  }, [articleIds]);

  const invert = useCallback(() => {
    setSelectedIds((current) => new Set(articleIds.filter((id) => !current.has(id))));
  }, [articleIds]);

  const remove = useCallback((ids: Iterable<number>) => {
    const invalid = new Set(ids);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => !invalid.has(id)));
      return next.size === current.size ? current : next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    hasSelection: selectedIds.size > 0,
    isSelected,
    toggle,
    selectAllLoaded,
    invert,
    remove,
    clear,
  };
}
