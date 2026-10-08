export const AI_STATUS_TEXT: Record<string, string> = {
  not_generated: '未生成',
  disabled: '自动生成已关闭',
  not_configured: '未配置模型',
  queued: 'AI 排队中',
  running: 'AI 生成中',
  succeeded: 'AI 已完成',
  failed: 'AI 失败',
};

export function aiStatusText(status: string | null | undefined) {
  return AI_STATUS_TEXT[status || 'not_generated'] || '未生成';
}
