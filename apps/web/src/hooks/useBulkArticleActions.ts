'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';

import { api } from '@/lib/api';
import type {
  ArticleBulkAction,
  ArticleBulkActionResult,
  ArticleBulkAiResult,
  BulkExportFormat,
  BulkExportJob,
} from '@storing/shared';

export type BulkActionLoading = ArticleBulkAction | 'ai' | 'export' | null;

export function useBulkArticleActions() {
  const { mutate: globalMutate } = useSWRConfig();
  const [loadingAction, setLoadingAction] = useState<BulkActionLoading>(null);

  const refreshArticleCaches = useCallback(async () => {
    await globalMutate(
      (key) => typeof key === 'string' && (key.startsWith('articles:') || key.startsWith('articles ')),
      undefined,
      { revalidate: true },
    );
    await globalMutate('counts');
    await globalMutate('categories');
  }, [globalMutate]);

  const runAction = useCallback(async function runAction(
    action: ArticleBulkAction,
    ids: number[],
  ): Promise<ArticleBulkActionResult | null> {
    setLoadingAction(action);
    try {
      const result = await api.bulkArticles(action, ids);
      await refreshArticleCaches();
      return result;
    } finally {
      setLoadingAction(null);
    }
  }, [refreshArticleCaches]);

  const runAi = useCallback(async function runAi(
    ids: number[],
    includeCategory: boolean,
  ): Promise<ArticleBulkAiResult | null> {
    setLoadingAction('ai');
    try {
      const result = await api.bulkRegenerateArticleAi(ids, includeCategory);
      await refreshArticleCaches();
      return result;
    } finally {
      setLoadingAction(null);
    }
  }, [refreshArticleCaches]);

  const createExport = useCallback(async function createExport(input: {
    articleIds: number[];
    format: BulkExportFormat;
    includeAi: boolean;
    organizeByCategory: boolean;
  }): Promise<BulkExportJob | null> {
    setLoadingAction('export');
    try {
      return await api.createBulkExport(input);
    } finally {
      setLoadingAction(null);
    }
  }, []);

  return { runAction, runAi, createExport, loadingAction };
}
