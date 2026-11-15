'use client';

import { FileTextOutlined } from '@ant-design/icons';
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
      className="detail-panel-action-btn detail-report-action is-active"
      type="button"
      onClick={handleClick}
      title="查看深度解析报告"
      aria-label="查看深度解析报告"
    >
      <FileTextOutlined />
      <span className="detail-panel-action-label">解析</span>
    </button>
  );
}
