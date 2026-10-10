'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ArticleBulkAction, ArticleBulkAiResult, ArticleBulkActionResult, ArticleBulkIssue, BulkExportJob } from '@storing/shared';
import { api } from '@/lib/api';

export type BulkToolbarAction =
  | ArticleBulkAction
  | 'set-category'
  | 'reclassify'
  | 'generate-ai'
  | 'export-zip'
  | 'export-obsidian';

export type BulkToolbarView = 'inbox' | 'favorites' | 'archive' | 'published';

export interface BulkActionBarProps {
  view: BulkToolbarView;
  mode: boolean;
  selectedCount: number;
  loading: boolean;
  onToggleMode: () => void;
  onSelectAll: () => void;
  onInvert: () => void;
  onAction: (action: BulkToolbarAction) => void;
  onResultClose: () => void;
  result: ArticleBulkActionResult | ArticleBulkAiResult | null;
  exportJob?: BulkExportJob | null;
}

const VIEW_ACTIONS: Record<BulkToolbarView, BulkToolbarAction[]> = {
  inbox: ['favorite', 'archive', 'delete', 'generate-ai', 'publish', 'export-zip', 'export-obsidian'],
  favorites: ['unfavorite', 'archive', 'delete', 'generate-ai', 'publish', 'export-zip', 'export-obsidian'],
  archive: [
    'favorite',
    'unfavorite',
    'unarchive',
    'set-category',
    'reclassify',
    'generate-ai',
    'delete',
    'publish',
    'unpublish',
    'export-zip',
    'export-obsidian',
  ],
  published: ['unpublish', 'delete', 'export-zip', 'export-obsidian'],
};

const ACTION_LABELS: Record<BulkToolbarAction, string> = {
  favorite: '收藏',
  unfavorite: '取消收藏',
  archive: '归档',
  unarchive: '移回收件箱',
  delete: '删除',
  permanent_delete: '彻底删除',
  publish: '发布',
  unpublish: '取消发布',
  'set-category': '设置分类',
  reclassify: '重判分类',
  'generate-ai': '生成 AI',
  'export-zip': '导出 ZIP',
  'export-obsidian': '导出 Obsidian',
};

function issueKey(issue: ArticleBulkIssue, index: number) {
  return `${issue.articleId}-${issue.code}-${index}`;
}

export function BulkActionBar({
  view,
  mode,
  selectedCount,
  loading,
  onToggleMode,
  onSelectAll,
  onInvert,
  onAction,
  onResultClose,
  result,
  exportJob,
}: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<'delete' | 'permanent_delete' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [trackedExportJob, setTrackedExportJob] = useState<BulkExportJob | null>(exportJob ?? null);
  const actions = VIEW_ACTIONS[view];

  useEffect(() => {
    setTrackedExportJob(exportJob ?? null);
    if (!exportJob || exportJob.status === 'succeeded' || exportJob.status === 'failed') return;

    const timer = window.setInterval(async () => {
      try {
        const trackedJob = exportJob;
        setTrackedExportJob(await api.getBulkExport(trackedJob.id));
      } catch (error) {
        console.error('Bulk export status refresh failed:', error);
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [exportJob]);
  const normalizedResult = useMemo(() => {
    if (!result) return null;
    if ('queuedIds' in result) {
      return {
        succeededCount: result.queuedIds.length,
        skippedCount: result.alreadyQueuedIds.length,
        issues: result.failed,
        publications: [] as Array<{ articleId: number; publicUrl: string }>,
      };
    }
    return {
      succeededCount: result.succeededIds.length,
      skippedCount: result.skipped.length,
      issues: [...result.skipped, ...result.failed],
      publications: result.publications ?? [],
    };
  }, [result]);

  const runAction = (action: BulkToolbarAction) => {
    if (action === 'delete' || action === 'permanent_delete') {
      setConfirmAction(action);
      return;
    }
    if (action === 'export-zip' || action === 'export-obsidian') {
      setExportOpen(true);
      return;
    }
    onAction(action);
  };

  if (!mode) {
    return (
      <div className="bulk-action-bar">
        <button className="bulk-action-button primary" disabled={loading} onClick={onToggleMode} type="button">
          批量操作
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bulk-action-bar">
        <span className="bulk-action-count">已选 {selectedCount} 篇</span>
        <div className="bulk-action-actions">
          <button disabled={loading} onClick={onSelectAll} type="button">全选</button>
          <button disabled={loading} onClick={onInvert} type="button">反选</button>
          {actions.map((action) => (
            <button
              disabled={loading || selectedCount === 0}
              key={action}
              onClick={() => runAction(action)}
              type="button"
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
          <button className="secondary" disabled={loading} onClick={onToggleMode} type="button">退出</button>
        </div>
      </div>

      {confirmAction && (
        <div className="bulk-action-overlay" role="presentation">
          <section aria-modal="true" className="bulk-action-dialog" role="dialog">
            <h2>{confirmAction === 'delete' ? '确认删除' : '确认彻底删除'}</h2>
            <p>
              {confirmAction === 'delete'
                ? `确定删除选中的 ${selectedCount} 篇文章吗？`
                : `确定彻底删除选中的 ${selectedCount} 篇文章吗？此操作不可恢复。`}
            </p>
            <div className="bulk-action-dialog-actions">
              <button onClick={() => setConfirmAction(null)} type="button">取消</button>
              <button
                className="danger"
                disabled={loading}
                onClick={() => {
                  onAction(confirmAction);
                  setConfirmAction(null);
                }}
                type="button"
              >
                {confirmAction === 'delete' ? '删除' : '彻底删除'}
              </button>
            </div>
          </section>
        </div>
      )}

      {exportOpen && (
        <div className="bulk-action-overlay" role="presentation">
          <section aria-modal="true" className="bulk-action-dialog" role="dialog">
            <h2>批量导出</h2>
            <p>ZIP 适合备份；Obsidian ZIP 可解压导入笔记保管库。</p>
            <div className="bulk-action-dialog-actions">
              <button onClick={() => setExportOpen(false)} type="button">取消</button>
              <button
                disabled={loading}
                onClick={() => {
                  onAction('export-zip');
                  setExportOpen(false);
                }}
                type="button"
              >
                ZIP
              </button>
              <button
                disabled={loading}
                onClick={() => {
                  onAction('export-obsidian');
                  setExportOpen(false);
                }}
                type="button"
              >
                Obsidian
              </button>
            </div>
          </section>
        </div>
      )}

      {trackedExportJob && !normalizedResult && (
        <div className="bulk-action-overlay" role="presentation">
          <section aria-modal="true" className="bulk-action-dialog" role="dialog">
            <h2>批量导出</h2>
            <p>
              {trackedExportJob.status === 'succeeded'
                ? `导出完成，成功 ${trackedExportJob.succeededCount} 篇，失败 ${trackedExportJob.failedCount} 篇。`
                : trackedExportJob.status === 'failed'
                  ? '导出失败，请重新提交。'
                  : '正在生成导出文件...'}
            </p>
            {trackedExportJob.status === 'succeeded' && trackedExportJob.downloadUrl && (
              <div className="bulk-result-publications">
                <a download href={trackedExportJob.downloadUrl}>下载 ZIP</a>
              </div>
            )}
            {trackedExportJob.status === 'failed' && <p className="bulk-result-issues">导出失败</p>}
            <div className="bulk-action-dialog-actions">
              <button onClick={() => setTrackedExportJob(null)} type="button">关闭</button>
            </div>
          </section>
        </div>
      )}

      {normalizedResult && (
        <div className="bulk-action-overlay" role="presentation">
          <section aria-modal="true" className="bulk-action-dialog result" role="dialog">
            <h2>批量结果</h2>
            <div className="bulk-result-summary">
              <span>成功 {normalizedResult.succeededCount}</span>
              <span>跳过 {normalizedResult.skippedCount}</span>
              <span>失败 {normalizedResult.issues.length}</span>
            </div>
            {normalizedResult.publications.length > 0 && (
              <div className="bulk-result-publications">
                {normalizedResult.publications.map((publication) => (
                  <a href={publication.publicUrl} key={publication.articleId}>
                    文章 #{publication.articleId}
                  </a>
                ))}
              </div>
            )}
            {normalizedResult.issues.length > 0 && (
              <ul className="bulk-result-issues">
                {normalizedResult.issues.map((issue, index) => (
                  <li key={issueKey(issue, index)}>
                    #{issue.articleId} · {issue.code}
                    {issue.message ? ` · ${issue.message}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <div className="bulk-action-dialog-actions">
              <button onClick={onResultClose} type="button">关闭</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
