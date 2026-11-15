'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type DeepAnalysisStatus =
  | 'not_generated'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type DeepAnalysisSummary = {
  hasDeepAnalysis: boolean;
  status: DeepAnalysisStatus;
  version: number | null;
  generatedAt: string | null;
  stale: boolean;
  errorCode: string | null;
  errorMessage?: string | null;
};

type DeepAnalysisTaskState = {
  articleId: number | null;
  summary: DeepAnalysisSummary | null;
  submitting: boolean;
  error: string | null;
};

const POLL_INTERVAL_MS = 2500;

export function useDeepAnalysisTask(
  articleId: number | null,
  initialStatus?: string | null,
) {
  const [state, setState] = useState<DeepAnalysisTaskState>({
    articleId: articleId ?? null,
    summary: initialStatus
      ? {
        hasDeepAnalysis: initialStatus === 'succeeded',
        status: initialStatus as DeepAnalysisStatus,
        version: null,
        generatedAt: null,
        stale: false,
        errorCode: null,
      }
      : null,
    submitting: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!articleId) return null;
    const response = await api.getDeepAnalysis(articleId);
    const summary = response?.summary as DeepAnalysisSummary | null;
    if (summary) {
      setState((current) => (
        current.articleId === articleId
          ? { ...current, summary, error: null }
          : current
      ));
    }
    return summary;
  }, [articleId]);

  useEffect(() => {
    setState((current) => {
      const sameArticle = current.articleId === articleId;
      return {
        articleId: articleId ?? null,
        summary: articleId == null
          ? null
          : initialStatus
            ? {
              hasDeepAnalysis: initialStatus === 'succeeded',
              status: initialStatus as DeepAnalysisStatus,
              version: sameArticle ? current.summary?.version ?? null : null,
              generatedAt: sameArticle ? current.summary?.generatedAt ?? null : null,
              stale: sameArticle ? current.summary?.stale ?? false : false,
              errorCode: sameArticle ? current.summary?.errorCode ?? null : null,
              errorMessage: sameArticle ? current.summary?.errorMessage ?? null : null,
            }
            : sameArticle
              ? current.summary
              : null,
        submitting: sameArticle ? current.submitting : false,
        error: null,
      };
    });
  }, [articleId, initialStatus]);

  useEffect(() => {
    if (!articleId) {
      return;
    }

    let cancelled = false;
    refresh().catch((error) => {
      if (cancelled) return;
      setState((current) => (
        current.articleId === articleId
          ? {
            ...current,
            error: error instanceof Error ? error.message : '深度报告状态加载失败',
          }
          : current
      ));
    });
    return () => {
      cancelled = true;
    };
  }, [articleId, refresh]);

  const summary = state.articleId === articleId ? state.summary : null;
  const pending = summary?.status === 'queued' || summary?.status === 'running';

  useEffect(() => {
    if (!articleId || !pending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const polledSummary = await refresh();
        if (!cancelled && (polledSummary?.status === 'queued' || polledSummary?.status === 'running')) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => (
            current.articleId === articleId
              ? {
                ...current,
                error: error instanceof Error ? error.message : '深度报告状态刷新失败',
              }
              : current
          ));
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [articleId, pending, refresh]);

  const generate = useCallback(async () => {
    if (!articleId || state.submitting || state.articleId !== articleId) return false;

    setState((current) => ({
      ...current,
      submitting: true,
      error: null,
      summary: {
        hasDeepAnalysis: current.summary?.hasDeepAnalysis ?? false,
        status: 'queued',
        version: current.summary?.version ?? null,
        generatedAt: current.summary?.generatedAt ?? null,
        stale: current.summary?.stale ?? false,
        errorCode: null,
      },
    }));

    try {
      await api.submitDeepAnalysis(articleId);
      await refresh();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '深度解析提交失败';
      setState((current) => (
        current.articleId === articleId
          ? {
            ...current,
            submitting: false,
            error: message,
            summary: current.summary
              ? { ...current.summary, status: 'failed' }
              : {
                hasDeepAnalysis: false,
                status: 'failed',
                version: null,
                generatedAt: null,
                stale: false,
                errorCode: null,
                errorMessage: null,
              },
          }
          : current
      ));
      return false;
    } finally {
      setState((current) => (
        current.articleId === articleId
          ? { ...current, submitting: false }
          : current
      ));
    }
  }, [articleId, refresh, state.articleId, state.submitting]);

  return {
    summary,
    status: summary?.status ?? null,
    pending,
    submitting: state.articleId === articleId ? state.submitting : false,
    error: state.articleId === articleId ? state.error : null,
    generate,
    refresh,
  };
}
