'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ApiOutlined, CheckCircleOutlined, ClockCircleOutlined, CloudUploadOutlined, EnterOutlined, ExclamationCircleOutlined, LinkOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
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

interface CollectFormProps {
  compact?: boolean;
  onSubmitted?: (job: CollectJob) => void;
}

export function CollectForm({ compact = false, onSubmitted }: CollectFormProps) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (compact) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [compact]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    if (!value) {
      setError('先粘贴或输入一个网页链接');
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
        <input
          ref={inputRef}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="粘贴网页链接，微信公众号会自动走原有抓取接口"
          autoComplete="off"
        />
        <button type="submit" disabled={submitting}>
          {submitting ? <LoadingOutlined spin /> : <EnterOutlined />}
          <span>{submitting ? '提交中' : '一键入库'}</span>
        </button>
      </div>
      {error && <p className="collect-error">{error}</p>}
    </form>
  );
}

function CollectJobCard({ job, onRetry }: { job: CollectJob; onRetry?: (id: number) => void }) {
  const router = useRouter();
  const canOpen = job.status === 'completed' && job.articleId;

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
          <button type="button" onClick={() => onRetry?.(job.id)}>
            <ReloadOutlined />
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
  const { data, mutate } = useSWR(isAuthenticated ? 'collect:jobs' : null, () => api.getCollectJobs(12), {
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

  return (
    <div className="collect-page-shell">
      <section className="collect-hero">
        <div>
          <span className="collect-kicker"><CloudUploadOutlined /> 手动采集</span>
          <h1>把网页收入归档</h1>
          <p>粘贴任意公开网页链接。微信公众号继续使用现有正文接口，其他网页使用镜像抓取并上传图片，完成后自动归档并进入 Wiki。</p>
        </div>
        <ApiOutlined className="collect-hero-mark" />
      </section>

      <section className="collect-panel">
        <CollectForm onSubmitted={handleSubmitted} />
        {activeJobData?.job && (
          <div className="collect-active-job">
            <CollectJobCard job={activeJobData.job} onRetry={handleRetry} />
          </div>
        )}
      </section>

      <section className="collect-history">
        <div className="collect-section-head">
          <div>
            <h2>最近采集</h2>
            <p>任务会在后台继续运行，完成后可直接进入归档阅读。</p>
          </div>
          <button type="button" onClick={() => mutate()}>
            <ReloadOutlined /> 刷新
          </button>
        </div>
        <div className="collect-job-list">
          {jobs.length > 0 ? jobs.map((job) => <CollectJobCard key={job.id} job={job} onRetry={handleRetry} />) : (
            <div className="collect-empty">还没有采集任务，先收一篇网页试试。</div>
          )}
        </div>
      </section>
    </div>
  );
}
