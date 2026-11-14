'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BulbOutlined, LoadingOutlined, ReadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useToast } from '@/components/ui/Toast';
import { useDeepAnalysisTask } from '@/hooks/useDeepAnalysisTask';

type DeepAnalysisButtonProps = {
  articleId: number;
  initialStatus?: string | null;
};

export function DeepAnalysisButton({ articleId, initialStatus }: DeepAnalysisButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { summary, status, pending, submitting, error, generate } = useDeepAnalysisTask(
    articleId,
    initialStatus,
  );
  const hasReport = summary?.hasDeepAnalysis === true || status === 'succeeded';
  const failed = status === 'failed';
  const busy = pending || submitting;

  useEffect(() => {
    if (error) showToast(error);
  }, [error, showToast]);

  const handleClick = async () => {
    if (busy) return;
    if (hasReport) {
      router.push(`/deep-analysis/${articleId}`);
      return;
    }
    const submitted = await generate();
    if (submitted) showToast('深度报告已提交，生成完成后可查看');
  };

  const label = busy
    ? '生成中'
    : hasReport
      ? '查看深度解析报告'
      : failed
        ? '重新生成'
        : '深度解析';

  return (
    <button
      className={`detail-deep-analysis-btn${busy ? ' is-running' : ''}${hasReport ? ' is-ready' : ''}`}
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-live="polite"
    >
      {busy ? (
        <LoadingOutlined spin />
      ) : hasReport ? (
        <ReadOutlined />
      ) : failed ? (
        <ReloadOutlined />
      ) : (
        <BulbOutlined />
      )}
      <span>{label}</span>
    </button>
  );
}
