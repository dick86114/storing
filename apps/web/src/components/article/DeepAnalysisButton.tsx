'use client';

import { useRouter } from 'next/navigation';
import { BulbOutlined, LoadingOutlined, ReadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useDeepAnalysisTask } from '@/hooks/useDeepAnalysisTask';

type DeepAnalysisButtonProps = {
  articleId: number;
  initialStatus?: string | null;
  onRequestGenerate?: () => void;
  onRequestFailure?: () => void;
};

export function DeepAnalysisButton({
  articleId,
  initialStatus,
  onRequestGenerate,
  onRequestFailure,
}: DeepAnalysisButtonProps) {
  const router = useRouter();
  const { summary, status, pending, submitting } = useDeepAnalysisTask(
    articleId,
    initialStatus,
  );
  const hasReport = summary?.hasDeepAnalysis === true || status === 'succeeded';
  const failed = status === 'failed';
  const busy = pending || submitting;
  const failureMessage = failed
    ? summary?.errorMessage?.trim() || '生成失败，请稍后重试'
    : null;

  const handleClick = async () => {
    if (busy) return;
    if (hasReport) {
      router.push(`/deep-analysis/${articleId}`);
      return;
    }
    if (failed) {
      onRequestFailure?.();
      return;
    }
    onRequestGenerate?.();
    return;
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
      {failed && <span className="visually-hidden">{failureMessage}</span>}
    </button>
  );
}
