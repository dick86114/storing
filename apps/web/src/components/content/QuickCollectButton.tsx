'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CloseOutlined, CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import { CollectForm } from '@/components/content/CollectContent';
import { api } from '@/lib/api';
import { useArticleContext } from '@/components/providers/ArticleContext';

type CollectJob = {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string;
  articleId?: number | null;
  title?: string | null;
  error?: string | null;
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

export function QuickCollectButton() {
  const router = useRouter();
  const { openArticle } = useArticleContext();
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<CollectJob | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('quick-collect-open');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('quick-collect-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const timer = window.setInterval(async () => {
      try {
        const result = await api.getCollectJob(job.id);
        setJob(result.job);
      } catch {
        window.clearInterval(timer);
      }
    }, 1400);

    return () => window.clearInterval(timer);
  }, [job]);

  const handleSubmitted = (nextJob: CollectJob) => {
    setJob(nextJob);
  };

  const handleOpenArticle = () => {
    if (!job?.articleId) return;
    setOpen(false);
    openArticle(job.articleId);
    router.push('/archive');
  };

  const overlay = open && mounted ? createPortal(
    <>
      <button
        className="quick-collect-scrim"
        type="button"
        aria-label="关闭快速采集"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      <div className="quick-collect-panel">
        <div className="quick-collect-head">
          <span><CloudUploadOutlined /> 快速采集</span>
          <button type="button" aria-label="关闭快速采集" onClick={() => setOpen(false)}>
            <CloseOutlined />
          </button>
        </div>
        <CollectForm compact onSubmitted={handleSubmitted} />
        {job && (
          <div className={`quick-collect-status quick-collect-status--${job.status}`}>
            <strong>{job.title || stageLabels[job.stage] || '采集中'}</strong>
            <p>{job.error || stageLabels[job.stage] || job.status}</p>
            {job.status === 'completed' && job.articleId && (
              <button type="button" onClick={handleOpenArticle}>进入归档阅读</button>
            )}
          </div>
        )}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button className="quick-collect-trigger" type="button" aria-label="快速采集网页" onClick={() => setOpen(true)}>
        <PlusOutlined />
      </button>
      {overlay}
    </>
  );
}
