'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  CloudUploadOutlined,
  CloseOutlined,
  CodeSandboxOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DockerOutlined,
  EnterOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  MobileOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { useToast } from '@/components/ui/Toast';

type CollectJob = {
  id: number;
  url: string;
  normalizedUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string;
  method: 'reader' | 'singlefile';
  captureStrategy?: 'wechat_reader' | 'singlefile_sidecar' | 'singlefile_command' | 'singlefile_docker' | 'singlefile_npx' | null;
  capture_strategy?: 'wechat_reader' | 'singlefile_sidecar' | 'singlefile_command' | 'singlefile_docker' | 'singlefile_npx' | null;
  articleId?: number | null;
  title?: string | null;
  error?: string | null;
  errorSummary?: string | null;
  errorDetails?: string[];
  errorHint?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CollectConfirmState =
  | { kind: 'delete-job'; jobId: number; articleTitle: string }
  | { kind: 'clear-finished' };

const stageLabels: Record<string, string> = {
  queued: '排队中',
  starting: '准备采集',
  capturing: '抓取网页',
  capturing_mobile: '抓取移动版网页',
  reader_fetch: '读取微信正文',
  uploading_images: '上传图片',
  uploading_mobile_images: '上传移动版图片',
  saving: '写入归档',
  completed: '已入库',
  failed: '采集失败',
};

type StageAppearance = {
  Icon: ComponentType<any>;
  tone:
    | 'queued'
    | 'starting'
    | 'capturing'
    | 'capturing-mobile'
    | 'reader-fetch'
    | 'uploading'
    | 'uploading-mobile'
    | 'saving'
    | 'completed'
    | 'failed';
  animated?: boolean;
};

const stageAppearances: Record<string, StageAppearance> = {
  queued: { Icon: ClockCircleOutlined, tone: 'queued' },
  starting: { Icon: ThunderboltOutlined, tone: 'starting', animated: true },
  capturing: { Icon: DesktopOutlined, tone: 'capturing', animated: true },
  capturing_mobile: { Icon: MobileOutlined, tone: 'capturing-mobile', animated: true },
  reader_fetch: { Icon: WechatOutlined, tone: 'reader-fetch', animated: true },
  uploading_images: { Icon: CloudUploadOutlined, tone: 'uploading', animated: true },
  uploading_mobile_images: { Icon: CloudUploadOutlined, tone: 'uploading-mobile', animated: true },
  saving: { Icon: DatabaseOutlined, tone: 'saving', animated: true },
  completed: { Icon: CheckCircleOutlined, tone: 'completed' },
  failed: { Icon: ExclamationCircleOutlined, tone: 'failed' },
};

function getJobLabel(job: CollectJob) {
  return stageLabels[job.stage] || stageLabels[job.status] || '处理中';
}

function getJobAppearance(job: CollectJob): StageAppearance {
  if (job.status === 'failed') return stageAppearances.failed;
  if (job.status === 'completed') return stageAppearances.completed;
  return stageAppearances[job.stage] || stageAppearances.queued;
}

function getCaptureMeta(job: CollectJob) {
  const strategy = job.captureStrategy || job.capture_strategy || (job.method === 'reader' ? 'wechat_reader' : 'singlefile_pending');
  const map = {
    wechat_reader: {
      label: '微信',
      title: '微信公众号正文接口：沿用现有微信文章抓取链路',
      Icon: ApiOutlined,
      tone: 'reader',
    },
    singlefile_sidecar: {
      label: 'Sidecar',
      title: '网页镜像 Sidecar：通过 compose 中的 singlefile 浏览器服务抓取',
      Icon: CloudServerOutlined,
      tone: 'sidecar',
    },
    singlefile_command: {
      label: 'SingleFile',
      title: '本机 single-file 命令：直接调用运行环境里的 SingleFile CLI',
      Icon: GlobalOutlined,
      tone: 'command',
    },
    singlefile_docker: {
      label: 'Docker',
      title: 'Docker 兜底：通过本机 Docker 运行 SingleFile 镜像抓取',
      Icon: DockerOutlined,
      tone: 'docker',
    },
    singlefile_npx: {
      label: 'npx',
      title: 'npx 兜底：临时运行 single-file-cli 抓取',
      Icon: NodeIndexOutlined,
      tone: 'npx',
    },
    singlefile_pending: {
      label: '镜像',
      title: '网页镜像：当前任务还没返回实际执行方式；完成后应显示 Sidecar、SingleFile、Docker 或 npx',
      Icon: CodeSandboxOutlined,
      tone: 'pending',
    },
  } as const;

  return map[strategy as keyof typeof map] || map.singlefile_pending;
}

function validateCollectUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '先粘贴或输入一个网页链接';
  if (/\s/.test(trimmed)) return '链接不能包含空格或换行';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return '请输入有效的网页链接';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return '仅支持 http/https 网页链接';

  const host = parsed.hostname.toLowerCase();
  const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  const isIpv6 = host.includes(':');
  const isDomainLike = host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
  if (!host || host === 'localhost' || host.endsWith('.local') || (!isDomainLike && !isIpv4 && !isIpv6)) {
    return '请输入有效的公开网页链接';
  }

  if (isIpv4) {
    const parts = host.split('.').map((part) => Number(part));
    const [first, second] = parts;
    if (
      parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255) ||
      first === 10 ||
      first === 127 ||
      first === 0 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    ) {
      return '请输入有效的公开网页链接';
    }
  }

  if (isIpv6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) {
    return '请输入有效的公开网页链接';
  }

  return '';
}

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  }
}

function CollectConfirmDialog({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: CollectConfirmState;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = state.kind === 'delete-job'
    ? {
        title: '删除采集记录',
        body: `确定要处理《${state.articleTitle}》吗？`,
        note: '这只会删除这条采集记录，不会删除已入库文章。',
        confirmLabel: '删除记录',
        loadingLabel: '删除中…',
      }
    : {
        title: '清空采集记录',
        body: '确定要清空已完成和失败的采集记录吗？',
        note: '运行中的任务会保留，已入库文章不会被删除。',
        confirmLabel: '清空记录',
        loadingLabel: '清空中…',
      };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [loading, onCancel]);

  return createPortal(
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        className="confirm-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-icon confirm-dialog-icon--danger" aria-hidden="true">
          <ExclamationCircleOutlined />
        </div>
        <div className="confirm-dialog-content">
          <h2 id="collect-confirm-title" className="confirm-dialog-title">{copy.title}</h2>
          <p className="confirm-dialog-copy">{copy.body}</p>
          <p className="confirm-dialog-note">{copy.note}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-button confirm-dialog-button--secondary" type="button" onClick={onCancel} disabled={loading}>
            取消
          </button>
          <button className="confirm-dialog-button confirm-dialog-button--danger" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? copy.loadingLabel : copy.confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

interface CollectFormProps {
  compact?: boolean;
  onSubmitted?: (job: CollectJob) => void;
}

export function CollectForm({ compact = false, onSubmitted }: CollectFormProps) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (compact) window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [compact]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = url.trim();
    const validationError = validateCollectUrl(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await api.createCollectJob(value);
      setUrl('');
      onSubmitted?.(result.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建采集任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const applyPastedText = (text: string) => {
    setUrl(text);
    setError('');
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(text.length, text.length);
  };

  const handlePaste = async () => {
    if (pasting || submitting) return;

    setPasting(true);
    try {
      let text = '';

      if (navigator.clipboard?.readText) {
        try {
          text = (await navigator.clipboard.readText()).trim();
        } catch (pasteError) {
          console.warn('Clipboard read failed', pasteError);
        }
      }

      if (!text) {
        const input = inputRef.current;
        if (input) {
          const selectionStart = input.selectionStart ?? input.value.length;
          const selectionEnd = input.selectionEnd ?? input.value.length;
          input.focus();
          input.setSelectionRange(selectionStart, selectionEnd);
          const beforeValue = input.value;
          const pasted = typeof document.execCommand === 'function' ? document.execCommand('paste') : false;
          if (pasted && input.value !== beforeValue) {
            setError('');
            showToast('已从系统剪切板填入链接');
            return;
          }
        }

        showToast('请在输入框中按下 Cmd/Ctrl+V 粘贴链接');
        return;
      }

      applyPastedText(text);
      showToast('已从系统剪切板填入链接');
    } finally {
      setPasting(false);
    }
  };

  return (
    <form className={`collect-form${compact ? ' collect-form--compact' : ''}`} onSubmit={handleSubmit}>
      <div className="collect-input-shell">
        <button
          className="collect-input-icon-button"
          type="button"
          onClick={handlePaste}
          disabled={pasting || submitting}
          aria-label={pasting ? '读取剪切板中' : '从系统剪切板粘贴'}
          title={pasting ? '读取剪切板中' : '从系统剪切板粘贴'}
        >
          <CopyOutlined />
          <span>{pasting ? '读取中' : '粘贴'}</span>
        </button>
        <textarea
          ref={inputRef}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError('');
          }}
          placeholder="粘贴网页链接，微信公众号会自动走原有抓取接口"
          autoComplete="off"
          rows={2}
        />
        <button
          className="collect-input-submit"
          type="submit"
          disabled={submitting}
          aria-label={submitting ? '提交中' : '一键入库'}
          title={submitting ? '提交中' : '一键入库'}
        >
          <EnterOutlined />
          <span>{submitting ? '提交中' : '一键入库'}</span>
        </button>
      </div>
      {error && <p className="collect-error">{error}</p>}
    </form>
  );
}

function CollectJobCard({ job, onRetry, onDelete }: { job: CollectJob; onRetry?: (id: number) => void; onDelete?: (id: number) => void }) {
  const router = useRouter();
  const { openArticle } = useArticleContext();
  const { showToast } = useToast();
  const canOpen = job.status === 'completed' && job.articleId;
  const canDelete = job.status !== 'running';
  const captureMeta = getCaptureMeta(job);
  const CaptureIcon = captureMeta.Icon;
  const displayUrl = job.normalizedUrl || job.url;
  const appearance = getJobAppearance(job);
  const AppearanceIcon = appearance.Icon;
  const statusLabel = getJobLabel(job);
  const errorSummary = job.errorSummary || job.error || statusLabel;
  const errorDetails = job.errorDetails?.filter(Boolean) || [];
  const errorHint = job.errorHint;
  const canShowErrorPopover = job.status === 'failed' && Boolean(errorSummary || errorDetails.length || errorHint);
  const [errorOpen, setErrorOpen] = useState(false);
  const errorPopoverRef = useRef<HTMLDivElement>(null);
  const errorTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (job.status !== 'failed' && errorOpen) setErrorOpen(false);
  }, [errorOpen, job.status]);

  useEffect(() => {
    if (!errorOpen) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setErrorOpen(false);
    };
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (errorPopoverRef.current?.contains(target)) return;
      if (errorTriggerRef.current?.contains(target)) return;
      setErrorOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointer);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointer);
    };
  }, [errorOpen]);

  const handleOpenArticle = () => {
    if (!job.articleId) return;
    openArticle(job.articleId);
    router.push('/archive');
  };

  const handleCopyUrl = async () => {
    if (!displayUrl) return;

    const copied = await copyTextToClipboard(displayUrl);
    showToast(copied ? '链接已复制' : '当前浏览器不允许复制链接');
  };

  const statusButtonProps = {
    className: `collect-job-icon collect-job-icon-button collect-job-icon--${appearance.tone}${appearance.animated ? ' collect-job-icon--active' : ''}${canShowErrorPopover ? ' collect-job-icon-button--interactive' : ''}`,
    type: 'button' as const,
    title: canShowErrorPopover ? '查看采集异常信息' : statusLabel,
    'aria-label': canShowErrorPopover ? '查看采集异常信息' : statusLabel,
    'aria-expanded': canShowErrorPopover ? errorOpen : undefined,
    disabled: !canShowErrorPopover,
    onClick: canShowErrorPopover ? () => setErrorOpen((open) => !open) : undefined,
  };

  return (
    <article className={`collect-job-card collect-job-card--${job.status}`}>
      <div className="collect-job-status">
        <button ref={errorTriggerRef} {...statusButtonProps}>
          <AppearanceIcon />
        </button>
        {errorOpen && canShowErrorPopover && (
          <div ref={errorPopoverRef} className="collect-job-status-popover" role="dialog" aria-label="采集异常详情">
            <div className="collect-job-status-popover-head">
              <span>{errorSummary}</span>
              <button
                type="button"
                className="collect-job-status-popover-close"
                onClick={() => setErrorOpen(false)}
                aria-label="关闭异常详情"
                title="关闭"
              >
                <CloseOutlined />
              </button>
            </div>
            {errorDetails.length > 0 && (
              <ul className="collect-job-status-popover-details">
                {errorDetails.map((detail, index) => (
                  <li key={`${job.id}-detail-${index}`}>{detail}</li>
                ))}
              </ul>
            )}
            {errorHint && <p className="collect-job-status-popover-hint">{errorHint}</p>}
          </div>
        )}
      </div>
      <div className="collect-job-main">
        <div className="collect-job-head">
          <strong>{job.title || job.normalizedUrl || job.url}</strong>
          <span className={`collect-method-badge collect-method-badge--${captureMeta.tone}`} title={captureMeta.title}>
            <CaptureIcon />
            <span>{captureMeta.label}</span>
          </span>
        </div>
        <div className="collect-job-url-row">
          <div className="collect-job-url" title={displayUrl}>{displayUrl}</div>
          {displayUrl && (
            <button className="collect-job-copy-button" type="button" onClick={handleCopyUrl} aria-label="复制采集链接" title="复制链接">
              <CopyOutlined />
            </button>
          )}
        </div>
      </div>
      <div className="collect-job-actions">
        {canOpen && (
          <button type="button" onClick={handleOpenArticle}>
            查看
          </button>
        )}
        {job.status === 'failed' && (
          <button type="button" onClick={() => onRetry?.(job.id)} aria-label="重试采集" title="重试">
            <ReloadOutlined />
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={() => onDelete?.(job.id)} aria-label="删除采集记录" title="删除记录">
            <DeleteOutlined />
          </button>
        )}
      </div>
    </article>
  );
}

const COLLECT_PAGE_SIZE = 12;

function mergeUniqueCollectJobs(headJobs: CollectJob[], extraJobs: CollectJob[]) {
  if (extraJobs.length === 0) return headJobs;
  const seen = new Set(headJobs.map((job) => job.id));
  const merged = [...headJobs];
  for (const job of extraJobs) {
    if (seen.has(job.id)) continue;
    merged.push(job);
    seen.add(job.id);
  }
  return merged;
}

export function CollectContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [confirmState, setConfirmState] = useState<CollectConfirmState | null>(null);
  const [pendingAction, setPendingAction] = useState<'delete-job' | 'clear-finished' | null>(null);
  const [extraJobs, setExtraJobs] = useState<CollectJob[]>([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [extraHasMore, setExtraHasMore] = useState(false);
  const [extraTotal, setExtraTotal] = useState<number | null>(null);
  const { data, mutate } = useSWR(isAuthenticated ? 'collect:jobs:head' : null, () => api.getCollectJobs(COLLECT_PAGE_SIZE, 0), {
    refreshInterval: (latest) => {
      const jobs = latest?.jobs || [];
      return jobs.some((job: CollectJob) => job.status === 'pending' || job.status === 'running') ? 1800 : 0;
    },
  });

  const headJobs = useMemo<CollectJob[]>(() => data?.jobs || [], [data]);
  const jobs = useMemo<CollectJob[]>(() => mergeUniqueCollectJobs(headJobs, extraJobs), [extraJobs, headJobs]);
  const hasMoreJobs = extraJobs.length > 0 ? extraHasMore : Boolean(data?.hasMore);
  const totalJobs = Number((extraTotal ?? data?.total) || 0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/archive');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div className="collect-page-shell"><div className="collect-panel">加载中...</div></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSubmitted = () => {
    mutate();
  };

  const handleRetry = async (id: number) => {
    await api.retryCollectJob(id);
    mutate();
  };

  const handleDelete = async (id: number) => {
    const job = jobs.find((item) => item.id === id);
    setConfirmState({
      kind: 'delete-job',
      jobId: id,
      articleTitle: job?.title || job?.normalizedUrl || job?.url || `采集记录 #${id}`,
    });
  };

  const handleClearFinished = async () => {
    setConfirmState({ kind: 'clear-finished' });
  };

  const handleLoadMore = async () => {
    if (extraLoading || !hasMoreJobs) return;

    setExtraLoading(true);
    try {
      const offset = headJobs.length + extraJobs.length;
      const result = await api.getCollectJobs(COLLECT_PAGE_SIZE, offset);
      const incomingJobs = (result?.jobs || []) as CollectJob[];
      const merged = mergeUniqueCollectJobs([...headJobs, ...extraJobs], incomingJobs);
      setExtraJobs(merged.slice(headJobs.length));
      setExtraHasMore(Boolean(result?.hasMore));
      if (typeof result?.total === 'number') setExtraTotal(result.total);
    } finally {
      setExtraLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;

    const action = confirmState.kind;
    setPendingAction(action);

    try {
      if (confirmState.kind === 'delete-job') {
        await api.deleteCollectJob(confirmState.jobId);
        setExtraJobs((items) => items.filter((item) => item.id !== confirmState.jobId));
      } else {
        await api.clearFinishedCollectJobs();
        setExtraJobs([]);
        setExtraHasMore(false);
        setExtraTotal(null);
      }
      setConfirmState(null);
      mutate();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="collect-page-shell">
      {confirmState && (
        <CollectConfirmDialog
          state={confirmState}
          loading={pendingAction === confirmState.kind}
          onCancel={() => setConfirmState(null)}
          onConfirm={handleConfirmAction}
        />
      )}
      <section className="collect-entry">
        <div className="collect-entry-head">
          <span className="collect-kicker"><CloudUploadOutlined /> 手动采集</span>
        </div>
        <CollectForm onSubmitted={handleSubmitted} />
      </section>

      <section className="collect-history">
        <div className="collect-section-head">
          <div>
            <h2>最近采集</h2>
            <p>任务会在后台继续运行，完成后可直接进入归档阅读。</p>
          </div>
          <div className="collect-section-actions">
            <button className="collect-refresh-button" type="button" onClick={() => mutate()} aria-label="刷新最近采集" title="刷新">
              <ReloadOutlined />
            </button>
            <button className="collect-clear-button" type="button" onClick={handleClearFinished} disabled={jobs.every((job) => job.status === 'pending' || job.status === 'running')}>
              <DeleteOutlined />
              <span>清空记录</span>
            </button>
          </div>
        </div>
        <div className="collect-job-list">
          {jobs.length > 0 ? jobs.map((job) => <CollectJobCard key={job.id} job={job} onRetry={handleRetry} onDelete={handleDelete} />) : (
            <div className="collect-empty">还没有采集任务，先收一篇网页试试。</div>
          )}
        </div>
        {jobs.length > 0 && (
          <div className="collect-history-footer">
            <span>已显示 {jobs.length} / {totalJobs} 条</span>
            {hasMoreJobs && (
              <button type="button" onClick={handleLoadMore} disabled={extraLoading}>
                {extraLoading ? '加载中…' : '查看更多'}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
