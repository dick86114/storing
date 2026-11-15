'use client';

import { useRouter } from 'next/navigation';

type DeepAnalysisButtonProps = {
  articleId: number;
  hasReport: boolean;
};

export function DeepAnalysisButton({
  articleId,
  hasReport,
}: DeepAnalysisButtonProps) {
  const router = useRouter();

  if (!hasReport) return null;

  const handleClick = () => {
    router.push(`/deep-analysis/${articleId}`);
  };

  return (
    <button
      className="detail-panel-action-btn is-active"
      type="button"
      onClick={handleClick}
      title="查看深度解析报告"
      aria-label="查看深度解析报告"
    >
      <svg className="detail-report-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M13 3h8c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2h-2v3l-3-3h-3c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2Z" />
        <path fill="currentColor" d="M4 8h11c1.7 0 3 1.3 3 3v4c0 1.7-1.3 3-3 3H8l-4 3v-3c-1.7 0-3-1.3-3-3v-4c0-1.7 1.3-3 3-3Z" />
        <path fill="currentColor" d="m20 12.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
        <path fill="currentColor" d="m7 1 .6 1.7L9.3 3.3l-1.7.6L7 5.6l-.6-1.7-1.7-.6 1.7-.6L7 1Z" />
      </svg>
      <span className="detail-panel-action-label">解析</span>
    </button>
  );
}
