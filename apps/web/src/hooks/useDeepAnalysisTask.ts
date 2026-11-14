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
};

type DeepAnalysisTaskState = {
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
      setState((current) => ({ ...current, summary, error: null }));
    }
    return summary;
  }, [articleId]);

  useEffect(() => {
    setState((current) => ({
      ...current,
      summary: initialStatus
        ? {
          hasDeepAnalysis: initialStatus === 'succeeded',
          status: initialStatus as DeepAnalysisStatus,
          version: current.summary?.version ?? null,
          generatedAt: current.summary?.generatedAt ?? null,
          stale: current.summary?.stale ?? false,
          errorCode: current.summary?.errorCode ?? null,
        }
        : current.summary,
    }));
  }, [initialStatus]);

  useEffect(() => {
    if (!articleId) {
      setState((current) => ({ ...current, summary: null, error: null }));
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, error: null }));
    refresh().catch((error) => {
      if (cancelled) return;
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : '深度报告状态加载失败',
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [articleId, refresh]);

  const pending = state.summary?.status === 'queued' || state.summary?.status === 'running';

  useEffect(() => {
    if (!articleId || !pending) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const summary = await refresh();
        if (!cancelled && (summary?.status === 'queued' || summary?.status === 'running')) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : '深度报告状态刷新失败',
          }));
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
    if (!articleId || state.submitting) return false;

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
      setState((current) => ({
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
          },
      }));
      return false;
    } finally {
      setState((current) => ({ ...current, submitting: false }));
    }
  }, [articleId, refresh, state.submitting]);

  return {
    summary: state.summary,
    status: state.summary?.status ?? null,
    pending,
    submitting: state.submitting,
    error: state.error,
    generate,
    refresh,
  };
}
