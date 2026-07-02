'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, type ArticleHtmlVariant } from '@/lib/api';
import {
  getArticleContentCacheKey,
  readCachedArticleContent,
  writeCachedArticleContent,
} from '@/lib/articleContentCache';

type ArticleCacheState = {
  key: string | null;
  data: any;
  ready: boolean;
};

export function useArticle(
  id: number | null,
  format: 'markdown' | 'html' = 'html',
  htmlVariant: ArticleHtmlVariant = 'desktop'
) {
  const key = useMemo(
    () => (id ? getArticleContentCacheKey(id, format, htmlVariant) : null),
    [id, format, htmlVariant]
  );
  const [cacheState, setCacheState] = useState<ArticleCacheState>({
    key: null,
    data: null,
    ready: !id,
  });
  const cachedArticle = cacheState.key === key ? cacheState.data : null;
  const isCacheReady = !key || (cacheState.key === key && cacheState.ready);

  useEffect(() => {
    let cancelled = false;

    if (!key) {
      setCacheState({ key: null, data: null, ready: true });
      return;
    }

    setCacheState({ key, data: null, ready: false });
    readCachedArticleContent(key)
      .then((cached) => {
        if (cancelled) return;
        setCacheState({ key, data: cached, ready: true });
      })
      .catch(() => {
        if (cancelled) return;
        setCacheState({ key, data: null, ready: true });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return useSWR(
    key && isCacheReady ? key : null,
    async () => {
      const article = await api.getArticle(id!, format, htmlVariant);
      void writeCachedArticleContent(key!, article);
      return article;
    },
    {
      fallbackData: cachedArticle ?? undefined,
      revalidateOnMount: !cachedArticle,
      revalidateOnFocus: false,
    }
  );
}

export function useArticleMeta(id: number | null) {
  return useSWR(id ? `article-meta:${id}` : null, () => api.getArticleMeta(id!), {
    revalidateOnFocus: false,
  });
}
