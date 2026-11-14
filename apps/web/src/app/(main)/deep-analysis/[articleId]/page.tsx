import { DeepAnalysisReportPage } from '@/components/article/DeepAnalysisReportPage';

export default async function DeepAnalysisPage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  return <DeepAnalysisReportPage articleId={Number(articleId)} />;
}
