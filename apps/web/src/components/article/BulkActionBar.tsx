'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

import type { ArticleBulkAction, ArticleBulkAiResult, ArticleBulkActionResult, ArticleBulkIssue, BulkExportJob } from '@storing/shared';
import { api } from '@/lib/api';

export type BulkToolbarAction =
  | ArticleBulkAction
  | 'set-category'
  | 'reclassify'
  | 'generate-ai'
  | 'export-zip';

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
  inbox: ['favorite', 'archive', 'delete', 'generate-ai', 'publish', 'export-zip'],
  favorites: ['unfavorite', 'archive', 'delete', 'generate-ai', 'publish', 'export-zip'],
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
  ],
  published: ['unpublish', 'delete', 'export-zip'],
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
};

const ACTION_CONFIRMATIONS: Record<BulkToolbarAction, { title: string; copy: string }> = {
  favorite: { title: '确认批量收藏？', copy: '将把所选文章统一标记为收藏。' },
  unfavorite: { title: '确认批量取消收藏？', copy: '将把所选文章从收藏中移除。' },
  archive: { title: '确认批量归档？', copy: '未归档文章会进入「待整理」，并按设置触发 AI 任务。' },
  unarchive: { title: '确认批量移回收件箱？', copy: '所选文章将全部回到收件箱。' },
  delete: { title: '确认批量删除？', copy: '将从当前账号移除所选文章。' },
  permanent_delete: { title: '确认批量彻底删除？', copy: '共享原文只会在没有其他用户引用时物理删除，此操作不可恢复。' },
  publish: { title: '确认批量发布？', copy: '未归档文章会自动归档，并生成游客可见的公开链接。' },
  unpublish: { title: '确认批量取消发布？', copy: '公开链接将立即失效；归档状态和公开 ID 会保留。' },
  'set-category': { title: '确认批量设置分类？', copy: '确认后将打开分类选择弹窗。' },
  reclassify: { title: '确认批量重判分类？', copy: '仅已归档且未被你确认过的文章会重新进入 AI 分类。' },
  'generate-ai': { title: '确认批量生成 AI？', copy: '将按当前 AI 配置为所选文章排队生成摘要和标签。' },
  'export-zip': { title: '确认批量导出 ZIP？', copy: '系统会在后台生成 Markdown 压缩包，完成后可直接下载。' },
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
  const [pendingAction, setPendingAction] = useState<BulkToolbarAction | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [trackedExportJob, setTrackedExportJob] = useState<BulkExportJob | null>(exportJob ?? null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actions = VIEW_ACTIONS[view];

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = () => setMenuOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const handleScroll = () => setMenuOpen(false);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menuOpen]);

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
      setPendingAction(null);
      return;
    }
    setPendingAction(action);
  };

  const confirmDialog = pendingAction
    ? ACTION_CONFIRMATIONS[pendingAction]
    : confirmAction
      ? ACTION_CONFIRMATIONS[confirmAction]
      : null;
  const dangerAction = pendingAction === 'delete' || pendingAction === 'permanent_delete'
    || confirmAction === 'delete' || confirmAction === 'permanent_delete';
  const activeAction = pendingAction ?? confirmAction;

  const closeConfirmation = () => {
    setPendingAction(null);
    setConfirmAction(null);
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
          <div ref={menuRef} className="bulk-actions-control">
            <button
              className="bulk-action-button primary"
              disabled={loading || selectedCount === 0}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((next) => !next)}
              type="button"
            >
              批量动作
              <DownOutlined className={`bulk-actions-chevron${menuOpen ? ' open' : ''}`} />
            </button>
            {menuOpen && (
              <div className="bulk-actions-menu" role="menu">
                {actions.map((action) => (
                  <button
                    className={`bulk-actions-menu-item${action === 'delete' || action === 'permanent_delete' ? ' danger' : ''}`}
                    disabled={loading}
                    key={action}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      runAction(action);
                    }}
                    type="button"
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="bulk-action-button primary" disabled={loading} onClick={onToggleMode} type="button">退出</button>
        </div>
      </div>

      {confirmDialog && activeAction && createPortal(
        <div
          className="confirm-dialog-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !loading) closeConfirmation();
          }}
        >
          <section
            aria-modal="true"
            className={`confirm-dialog-panel${activeAction === 'permanent_delete' ? ' confirm-dialog-panel--permanent' : ''}`}
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`confirm-dialog-icon ${dangerAction ? 'confirm-dialog-icon--danger' : 'confirm-dialog-icon--action'}`} aria-hidden="true">
              <ExclamationCircleOutlined />
            </div>
            <div className="confirm-dialog-content">
              <h2 className="confirm-dialog-title">{confirmDialog.title}</h2>
              <p className="confirm-dialog-copy">
                已选择 {selectedCount} 篇文章。{confirmDialog.copy}
              </p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="confirm-dialog-button confirm-dialog-button--secondary" disabled={loading} onClick={closeConfirmation} type="button">取消</button>
              <button
                className={`confirm-dialog-button ${dangerAction ? 'confirm-dialog-button--danger' : 'confirm-dialog-button--primary'}`}
                disabled={loading}
                onClick={() => {
                  onAction(activeAction);
                  closeConfirmation();
                }}
                type="button"
              >
                确认执行
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      {trackedExportJob && !normalizedResult && createPortal(
        <div className="confirm-dialog-overlay" role="presentation">
          <section aria-modal="true" className="confirm-dialog-panel" role="dialog">
            <div className="confirm-dialog-icon confirm-dialog-icon--action" aria-hidden="true">
              <ExclamationCircleOutlined />
            </div>
            <div className="confirm-dialog-content">
              <h2 className="confirm-dialog-title">批量导出</h2>
              <p className="confirm-dialog-copy">
                {trackedExportJob.status === 'succeeded'
                  ? `导出完成，成功 ${trackedExportJob.succeededCount} 篇，失败 ${trackedExportJob.failedCount} 篇。`
                  : trackedExportJob.status === 'failed'
                    ? '导出失败，请重新提交。'
                    : '正在后台生成 Markdown 压缩包...'}
              </p>
              {trackedExportJob.status === 'succeeded' && trackedExportJob.downloadUrl && (
                <a className="confirm-dialog-link" download href={trackedExportJob.downloadUrl}>下载 ZIP</a>
              )}
            </div>
            <div className="confirm-dialog-actions">
              <button className="confirm-dialog-button confirm-dialog-button--secondary" onClick={() => setTrackedExportJob(null)} type="button">关闭</button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      {normalizedResult && createPortal(
        <div className="confirm-dialog-overlay" role="presentation">
          <section aria-modal="true" className="confirm-dialog-panel" role="dialog">
            <div className={`confirm-dialog-icon ${normalizedResult.issues.length > 0 ? 'confirm-dialog-icon--warning' : 'confirm-dialog-icon--success'}`} aria-hidden="true">
              <ExclamationCircleOutlined />
            </div>
            <div className="confirm-dialog-content">
              <h2 className="confirm-dialog-title">批量结果</h2>
              <p className="confirm-dialog-copy">
                成功 {normalizedResult.succeededCount} 篇，跳过 {normalizedResult.skippedCount} 篇，失败 {normalizedResult.issues.length} 篇。
              </p>
              {normalizedResult.publications.length > 0 && (
                <div className="bulk-result-publications">
                  {normalizedResult.publications.map((publication) => (
                    <a className="confirm-dialog-link" href={publication.publicUrl} key={publication.articleId}>
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
            </div>
            <div className="confirm-dialog-actions">
              <button className="confirm-dialog-button confirm-dialog-button--secondary" onClick={onResultClose} type="button">关闭</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
