'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ApiOutlined, CheckCircleOutlined, ClockCircleOutlined, CloudUploadOutlined, DeleteOutlined, EnterOutlined, ExclamationCircleOutlined, LinkOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

type CollectJob = {
  id: number;
  url: string;
  normalizedUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string;
  method: 'reader' | 'singlefile';
  articleId?: number | null;
  title?: string | null;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const stageLabels: Record<string, string> = {
  queued: '排队中',
  starting: '准备采集',
  capturing: '抓取网页',
  reader_fetch: '读取微信正文',
  uploading_images: '上传图片',
  saving: '写入归档',
  completed: '已入库',
  failed: '采集失败',
};

function getJobIcon(job: CollectJob) {
  if (job.status === 'completed') return <CheckCircleOutlined />;
  if (job.status === 'failed') return <ExclamationCircleOutlined />;
  if (job.status === 'running') return <LoadingOutlined spin />;
  return <ClockCircleOutlined />;
}

function getJobLabel(job: CollectJob) {
  return stageLabels[job.stage] || stageLabels[job.status] || '处理中';
}

function validateCollectUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '先粘贴或输入一个网页链接';
  if (/\s/.test(trimmed)) return '链接不能包含空格或换行';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return '请输入有效的网页链接';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return '仅支持 http/https 网页链接';

  const host = parsed.hostname.toLowerCase();
  const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpv6 = host.includes(':');
  const isDomainLike = host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
  if (!host || host === 'localhost' || host.endsWith('.local') || (!isDomainLike && !isIpv4 && !isIpv6)) {
    return '请输入有效的公开网页链接';
  }

  if (isIpv4) {
    const parts = host.split('.').map((part) => Number(part));
    const [first, second] = parts;
    if (
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    ) {
      return '请输入有效的公开网页链接';
    }
  }

  if (isIpv6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) {
    return '请输入有效的公开网页链接';
  }

  return '';
}

interface CollectFormProps {
  compact?: boolean;
  onSubmitted?: (job: CollectJob) => void;
}

export function CollectForm({ compact = false, onSubmitted }: CollectFormProps) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (compact) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [compact]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    const validationError = validateCollectUrl(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await api.createCollectJob(value);
      setUrl('');
      onSubmitted?.(result.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建采集任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={`collect-form${compact ? ' collect-form--compact' : ''}`} onSubmit={handleSubmit}>
      <div className="collect-input-shell">
        <LinkOutlined className="collect-input-icon" />
        <textarea
          ref={inputRef}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError('');
          }}
          placeholder="粘贴网页链接，微信公众号会自动走原有抓取接口"
          autoComplete="off"
          rows={2}
        />
        <button type="submit" disabled={submitting} aria-label={submitting ? '提交中' : '一键入库'} title={submitting ? '提交中' : '一键入库'}>
          {submitting ? <LoadingOutlined spin /> : <EnterOutlined />}
          <span>{submitting ? '提交中' : '一键入库'}</span>
        </button>
      </div>
      {error && <p className="collect-error">{error}</p>}
    </form>
  );
}

function CollectJobCard({ job, onRetry, onDelete }: { job: CollectJob; onRetry?: (id: number) => void; onDelete?: (id: number) => void }) {
  const router = useRouter();
  const canOpen = job.status === 'completed' && job.articleId;
  const canDelete = job.status !== 'running';

  return (
    <article className={`collect-job-card collect-job-card--${job.status}`}>
      <div className="collect-job-icon">{getJobIcon(job)}</div>
      <div className="collect-job-main">
        <div className="collect-job-head">
          <strong>{job.title || job.normalizedUrl || job.url}</strong>
          <span>{job.method === 'reader' ? '微信接口' : '网页镜像'}</span>
        </div>
        <p>{job.error || getJobLabel(job)}</p>
        <div className="collect-job-url">{job.normalizedUrl}</div>
      </div>
      <div className="collect-job-actions">
        {canOpen && (
          <button type="button" onClick={() => router.push(`/archive?article=${job.articleId}`)}>
            查看
          </button>
        )}
        {job.status === 'failed' && (
          <button type="button" onClick={() => onRetry?.(job.id)} aria-label="重试采集" title="重试">
            <ReloadOutlined />
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => onDelete?.(job.id)} aria-label="删除采集记录" title="删除记录">
            <DeleteOutlined />
          </button>
        )}
      </div>
    </article>
  );
}

export function CollectContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const { data, mutate } = useSWR(isAuthenticated ? `collect:jobs:${visibleCount}` : null, () => api.getCollectJobs(visibleCount, 0), {
    refreshInterval: (latest) => {
      const jobs = latest?.jobs || [];
      return jobs.some((job: CollectJob) => job.status === 'pending' || job.status === 'running') ? 1800 : 0;
    },
  });
  const { data: activeJobData } = useSWR(activeJobId ? `collect:job:${activeJobId}` : null, () => api.getCollectJob(activeJobId as number), {
    refreshInterval: (latest) => {
      const status = latest?.job?.status;
      return status === 'pending' || status === 'running' ? 1200 : 0;
    },
  });

  useEffect(() => {
    if (!activeJobData?.job) return;
    mutate();
    if (activeJobData.job.status === 'completed' && activeJobData.job.articleId) {
      router.prefetch(`/archive?article=${activeJobData.job.articleId}`);
    }
  }, [activeJobData, mutate, router]);

  const jobs = useMemo<CollectJob[]>(() => data?.jobs || [], [data]);
  const hasMoreJobs = Boolean(data?.hasMore);
  const totalJobs = Number(data?.total || 0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/archive');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="collect-page-shell"><div className="collect-panel">加载中...</div></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSubmitted = (job: CollectJob) => {
    setActiveJobId(job.id);
    mutate();
  };

  const handleRetry = async (id: number) => {
    await api.retryCollectJob(id);
    setActiveJobId(id);
    mutate();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('只删除这条采集记录，不会删除已入库文章。确定删除吗？')) return;
    await api.deleteCollectJob(id);
    if (activeJobId === id) setActiveJobId(null);
    mutate();
  };

  const handleClearFinished = async () => {
    if (!window.confirm('只清空已完成和失败的采集记录，运行中的任务会保留。确定清空吗？')) return;
    await api.clearFinishedCollectJobs();
    setActiveJobId(null);
    setVisibleCount(12);
    mutate();
  };

  return (
    <div className="collect-page-shell">
      <section className="collect-hero">
        <div>
          <span className="collect-kicker"><CloudUploadOutlined /> 手动采集</span>
          <h1>网页采集</h1>
        </div>
        <ApiOutlined className="collect-hero-mark" />
      </section>

      <section className="collect-panel">
        <CollectForm onSubmitted={handleSubmitted} />
        {activeJobData?.job && (
          <div className="collect-active-job">
            <CollectJobCard job={activeJobData.job} onRetry={handleRetry} onDelete={handleDelete} />
          </div>
        )}
      </section>

      <section className="collect-history">
        <div className="collect-section-head">
          <div>
            <h2>最近采集</h2>
            <p>任务会在后台继续运行，完成后可直接进入归档阅读。</p>
          </div>
          <button className="collect-refresh-button" type="button" onClick={() => mutate()} aria-label="刷新最近采集" title="刷新">
            <ReloadOutlined />
          </button>
          <button className="collect-clear-button" type="button" onClick={handleClearFinished} disabled={jobs.every((job) => job.status === 'pending' || job.status === 'running')}>
            <DeleteOutlined />
            <span>清空记录</span>
          </button>
        </div>
        <div className="collect-job-list">
          {jobs.length > 0 ? jobs.map((job) => <CollectJobCard key={job.id} job={job} onRetry={handleRetry} onDelete={handleDelete} />) : (
            <div className="collect-empty">还没有采集任务，先收一篇网页试试。</div>
          )}
        </div>
        {jobs.length > 0 && (
          <div className="collect-history-footer">
            <span>已显示 {jobs.length} / {totalJobs} 条</span>
            {hasMoreJobs && (
              <button type="button" onClick={() => setVisibleCount((count) => count + 12)}>
                查看更多
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
