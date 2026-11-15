'use client';

import { useRouter } from 'next/navigation';
import { LoadingOutlined, ReadOutlined } from '@ant-design/icons';
import { useDeepAnalysisTask } from '@/hooks/useDeepAnalysisTask';

type DeepAnalysisButtonProps = {
  articleId: number;
  initialStatus?: string | null;
};

export function DeepAnalysisButton({
  articleId,
  initialStatus,
}: DeepAnalysisButtonProps) {
  const router = useRouter();
  const { summary, status, pending, submitting } = useDeepAnalysisTask(
    articleId,
    initialStatus,
  );
  const hasReport = summary?.hasDeepAnalysis === true || status === 'succeeded';
  const busy = pending || submitting;

  if (!hasReport && !busy) return null;

  const handleClick = async () => {
    if (hasReport) {
      router.push(`/deep-analysis/${articleId}`);
      return;
    }
  };

  const label = '深度报告';

  return (
    <button
      className="detail-panel-action-btn"
      type="button"
      onClick={handleClick}
      disabled={busy && !hasReport}
      title={busy && !hasReport ? '深度报告生成中' : '查看深度报告'}
      aria-label={busy && !hasReport ? '深度报告生成中' : '深度报告'}
      aria-live="polite"
    >
      {busy ? <LoadingOutlined spin /> : <ReadOutlined />}
      <span className="detail-panel-action-label">{label}</span>
    </button>
  );
}
