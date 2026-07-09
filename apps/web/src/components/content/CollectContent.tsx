'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent as ReactMouseEvent } from 'react';
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
  EyeOutlined,
  DockerOutlined,
  EnterOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  MinusOutlined,
  MobileOutlined,
  NodeIndexOutlined,
  PlusOutlined,
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

type CollectProgressStep = {
  key: string;
  title: string;
  description: string;
  stage: string;
};

type CollectProgressConnector = {
  key: string;
  type: 'horizontal' | 'vertical';
  direction?: 'forward' | 'reverse';
  tone: StageAppearance['tone'];
  column: number;
  row: number;
};

const wechatProgressSteps: CollectProgressStep[] = [
  {
    key: 'queued',
    title: '已加入队列',
    description: '任务写入队列，等待 worker 处理',
    stage: 'queued',
  },
  {
    key: 'reader',
    title: '读取微信正文',
    description: '沿用微信正文接口，保留原有阅读体验',
    stage: 'reader_fetch',
  },
  {
    key: 'assets',
    title: '上传图片',
    description: '上传封面和正文图片，替换为可访问资源',
    stage: 'uploading_images',
  },
  {
    key: 'save',
    title: '写入归档',
    description: '保存正文、标题、来源和封面信息',
    stage: 'saving',
  },
  {
    key: 'done',
    title: '整理完成',
    description: '资料就绪，可以在归档中阅读',
    stage: 'completed',
  },
];

const singleFileProgressSteps: CollectProgressStep[] = [
  {
    key: 'queued',
    title: '已加入队列',
    description: '任务写入队列，等待 worker 处理',
    stage: 'queued',
  },
  {
    key: 'starting',
    title: '准备采集',
    description: '初始化抓取策略和浏览器环境',
    stage: 'starting',
  },
  {
    key: 'capturing',
    title: '抓取桌面网页',
    description: 'SingleFile 抓取桌面版完整 HTML 和素材',
    stage: 'capturing',
  },
  {
    key: 'capturing-mobile',
    title: '抓取移动网页',
    description: '使用移动端视口补充自适应内容',
    stage: 'capturing_mobile',
  },
  {
    key: 'assets',
    title: '上传图片',
    description: '上传封面和正文图片，替换为可访问资源',
    stage: 'uploading_images',
  },
  {
    key: 'mobile-assets',
    title: '上传移动图片',
    description: '上传移动版页面图片并替换为可访问资源',
    stage: 'uploading_mobile_images',
  },
  {
    key: 'save',
    title: '写入归档',
    description: '保存正文、标题、来源和封面信息',
    stage: 'saving',
  },
  {
    key: 'done',
    title: '整理完成',
    description: '资料就绪，可以在归档中阅读',
    stage: 'completed',
  },
];

function getProgressSteps(job: CollectJob) {
  return job.method === 'reader' ? wechatProgressSteps : singleFileProgressSteps;
}

function getCollectProgressIndex(job: CollectJob) {
  const steps = getProgressSteps(job);
  if (job.status === 'completed') return steps.length - 1;
  if (job.status === 'failed' && job.stage === 'failed') return 1;
  const index = steps.findIndex((step) => step.stage === job.stage);
  return index >= 0 ? index : 0;
}

export function CollectProgressTimeline({ job }: { job: CollectJob }) {
  const steps = getProgressSteps(job);
  const activeIndex = getCollectProgressIndex(job);
  const isFailed = job.status === 'failed';
  const isFinished = job.status === 'completed';
  const progressMax = Math.max(steps.length - 1, 1);
  const stepsRef = useRef<HTMLDivElement>(null);
  const [flowColumns, setFlowColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      const element = stepsRef.current;
      if (!element) return;
      const value = getComputedStyle(element).getPropertyValue('--collect-progress-columns');
      const columns = parseInt(value, 10);
      if (!Number.isNaN(columns) && columns > 0) {
        setFlowColumns(columns);
      }
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const getFlowPosition = (stepIndex: number) => {
    const row = Math.floor(stepIndex / flowColumns);
    const isReverse = row % 2 === 1;
    const column = isReverse ? flowColumns - (stepIndex % flowColumns) : (stepIndex % flowColumns) + 1;
    return { row, column, isReverse };
  };

  const flowSteps = steps.map((step, index) => {
    const appearance = stageAppearances[step.stage] || stageAppearances.queued;
    const { row, column, isReverse } = getFlowPosition(index);
    const nextPosition = index < steps.length - 1 ? getFlowPosition(index + 1) : null;

    return {
      step,
      appearance,
      flowRow: row,
      flowColumn: column,
      isReverseRow: isReverse,
      isActive: !isFinished && !isFailed && index === activeIndex,
      isDone: isFinished || index < activeIndex,
      isError: isFailed && index === activeIndex,
      hasHorizontalConnection: Boolean(nextPosition && nextPosition.row === row),
      hasVerticalConnectionDown: Boolean(nextPosition && nextPosition.row === row + 1 && nextPosition.column === column),
    };
  });

  const connectors: CollectProgressConnector[] = flowSteps.flatMap((item) => {
    const next: CollectProgressConnector[] = [];

    if (item.hasHorizontalConnection) {
      next.push({
        key: `${item.step.key}-horizontal`,
        type: 'horizontal',
        direction: item.isReverseRow ? 'reverse' : 'forward',
        tone: item.appearance.tone,
        column: item.flowColumn,
        row: item.flowRow + 1,
      });
    }

    if (item.hasVerticalConnectionDown) {
      next.push({
        key: `${item.step.key}-vertical`,
        type: 'vertical',
        tone: item.appearance.tone,
        column: item.flowColumn,
        row: item.flowRow + 1,
      });
    }

    return next;
  });

  return (
    <div
      className={`collect-progress-timeline collect-progress-timeline--${job.status}`}
      style={{
        ['--collect-progress-index' as string]: activeIndex,
        ['--collect-progress-max' as string]: progressMax,
      }}
      aria-label={`采集进度：${getJobLabel(job)}`}
    >
      <div
        className="collect-progress-steps"
        ref={stepsRef}
        style={{
          ['--collect-progress-count' as string]: steps.length,
        }}
      >
      {connectors.map((connector) => (
        <span
          key={connector.key}
          className={`collect-progress-grid-connector collect-progress-step--${connector.tone} collect-progress-grid-connector--${connector.type}${connector.direction ? ` collect-progress-grid-connector--${connector.direction}` : ''}`}
          style={{
            gridColumn: String(connector.column),
            gridRow: connector.type === 'vertical' ? `${connector.row} / span 2` : String(connector.row),
          }}
          aria-hidden="true"
        />
      ))}
      {flowSteps.map(({ step, appearance, isActive, isDone, isError, flowColumn, flowRow, isReverseRow }) => {
        const Icon = appearance.Icon;

        return (
          <div
            key={step.key}
            className={`collect-progress-step collect-progress-step--${appearance.tone} collect-progress-step--${isReverseRow ? 'reverse' : 'forward'}${appearance.animated && isActive ? ' collect-progress-step--animated' : ''}${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}${isError ? ' is-error' : ''}`}
            style={{
              ['--collect-flow-column' as string]: flowColumn,
              ['--collect-flow-row' as string]: flowRow + 1,
            }}
          >
            <span className="collect-progress-step-marker">
              <Icon />
            </span>
            <span className="collect-progress-step-copy">
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
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
  const shouldAutoShowProgress = job.status === 'pending' || job.status === 'running' || job.status === 'failed';
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
  const [progressOpen, setProgressOpen] = useState(shouldAutoShowProgress);
  const errorPopoverRef = useRef<HTMLDivElement>(null);
  const errorTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (shouldAutoShowProgress) setProgressOpen(true);
  }, [shouldAutoShowProgress]);

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

  const stopCardToggle = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  const handleOpenArticle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!job.articleId) return;
    openArticle(job.articleId);
    router.push('/archive');
  };

  const handleCopyUrl = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
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
    onClick: canShowErrorPopover
      ? (event: ReactMouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setErrorOpen((open) => !open);
        }
      : undefined,
  };

  return (
    <article
      className={`collect-job-card collect-job-card--${job.status}${progressOpen ? ' collect-job-card--progress-open' : ''}`}
      onClick={() => setProgressOpen((open) => !open)}
      data-progress-open={progressOpen ? 'true' : 'false'}
    >
      <div className="collect-job-status" onClick={stopCardToggle}>
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
        {progressOpen && <CollectProgressTimeline job={job} />}
      </div>
      <div className="collect-job-actions" onClick={stopCardToggle}>
        <button
          className="collect-job-action-button"
          type="button"
          onClick={() => setProgressOpen((open) => !open)}
          aria-label={progressOpen ? '收起采集步骤' : '展开采集步骤'}
          title={progressOpen ? '收起步骤' : '展开步骤'}
        >
          {progressOpen ? <MinusOutlined /> : <PlusOutlined />}
        </button>
        {canOpen && (
          <button
            className="collect-job-action-button"
            type="button"
            onClick={handleOpenArticle}
            aria-label="查看归档内容"
            title="查看归档"
          >
            <EyeOutlined />
          </button>
        )}
        {job.status === 'failed' && (
          <button className="collect-job-action-button" type="button" onClick={() => onRetry?.(job.id)} aria-label="重试采集" title="重试">
            <ReloadOutlined />
          </button>
        )}
        {canDelete && (
          <button className="collect-job-action-button" type="button" onClick={() => onDelete?.(job.id)} aria-label="删除采集记录" title="删除记录">
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
