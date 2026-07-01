'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent, ReactNode } from 'react';
import useSWR from 'swr';
import { ArrowLeftOutlined, ArrowsAltOutlined, BookOutlined, BranchesOutlined, ClockCircleOutlined, ClusterOutlined, CopyOutlined, DatabaseOutlined, DeleteOutlined, DownloadOutlined, FileSearchOutlined, FileTextOutlined, HistoryOutlined, LinkOutlined, MessageOutlined, PlusOutlined, ReloadOutlined, RobotOutlined, SaveOutlined, SearchOutlined, SendOutlined, ShrinkOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/providers/AuthContext';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { api } from '@/lib/api';

type WikiStatus = {
  archived?: number;
  indexed?: number;
  pending?: number;
  pages?: number;
  pending_jobs?: number;
  running_jobs?: number;
  failed_jobs?: number;
  failed_articles?: number;
  runner_active?: boolean;
  chunks?: number;
  claims?: number;
  lint_findings?: number;
};

type WikiPageSummary = {
  id: number;
  title: string;
  slug: string;
  pageType: string;
  page_type?: string;
  summary?: string | null;
  status: string;
  version: number;
  updatedAt?: string | null;
  updated_at?: string | null;
  lastGeneratedAt?: string | null;
  last_generated_at?: string | null;
  source_count?: number;
  claim_count?: number;
};

type WikiBlock = {
  id?: string;
  type: string;
  text?: string;
  level?: number;
  items?: Array<{ text: string; sources?: number[]; claims?: number[] }>;
  articleIds?: number[];
  pageIds?: number[];
  claims?: number[];
};

type WikiJob = {
  id: number;
  jobType?: string;
  job_type?: string;
  status: string;
  attempts?: number;
  maxAttempts?: number;
  max_attempts?: number;
  lastError?: string | null;
  last_error?: string | null;
  payload?: any;
  updatedAt?: string | null;
  updated_at?: string | null;
};

type WikiArticleSummary = {
  id: number;
  title: string;
  source?: string | null;
  summary?: string | null;
  status?: string;
  lastIndexedAt?: string | null;
  last_indexed_at?: string | null;
  archivedAt?: string | null;
  archived_at?: string | null;
};

type WikiLogEntry = {
  id: number;
  eventType?: string;
  event_type?: string;
  title: string;
  details?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type WikiLintFinding = {
  id: number;
  findingType?: string;
  finding_type?: string;
  severity: string;
  title: string;
  details?: string | null;
  pageId?: number | null;
  page_id?: number | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type WikiAnswerCitation = {
  id: string;
  type: 'page' | 'claim' | 'chunk';
  title: string;
  excerpt?: string;
  pageId?: number;
  slug?: string;
  articleId?: number;
  articleTitle?: string;
  claimId?: number;
  chunkId?: number;
};

type WikiAnswer = {
  id: number;
  question: string;
  answer: string;
  citations?: WikiAnswerCitation[];
  context?: { citations?: WikiAnswerCitation[] };
  status?: string;
  filedPageId?: number | null;
  filed_page_id?: number | null;
};

type WikiStatKey = 'articles' | 'indexed' | 'pages' | 'chunks' | 'claims' | 'lint' | 'running' | 'pending' | 'failed' | 'log';

const WIKI_TYPES = [
  { key: 'all', label: '全部页面', help: '所有由归档文章生成的 Wiki 页面。' },
  { key: 'topic', label: '主题', help: '围绕文章主题、来源或专题聚合出的长页面。' },
  { key: 'concept', label: '概念', help: '从文章中抽取出的实体、工具、技术名词或关键概念。' },
  { key: 'index', label: '资料索引', help: '低价值或暂时难以归类的内容会先进入索引页。' },
  { key: 'analysis', label: '分析页', help: '从高价值问答或人工触发沉淀出的分析型页面。' },
];

function formatDate(value?: string | null) {
  if (!value) return '尚未生成';
  return new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function CompactStat({
  active,
  icon,
  label,
  value,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  value: number | undefined;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`wiki-compact-stat${active ? ' active' : ''}`} onClick={onClick}>
      <span className="wiki-compact-stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </button>
  );
}

function pageTypeOf(page: WikiPageSummary | any) {
  return page.pageType || page.page_type || 'topic';
}

function pageTypeLabel(type: string) {
  if (type === 'analysis') return '分析页';
  if (type === 'concept') return '概念';
  if (type === 'index') return '资料索引';
  return '主题';
}

function blockId(block: WikiBlock, index: number) {
  return block.id || `${block.type || 'block'}-${index + 1}`;
}

function JobList({
  title,
  jobs,
  empty,
  action,
  actionLabel,
  isBusy,
}: {
  title: string;
  jobs: WikiJob[];
  empty: string;
  action?: () => void;
  actionLabel?: string;
  isBusy?: boolean;
}) {
  return (
    <div className="wiki-job-panel">
      <div className="wiki-job-panel-head">
        <h3>{title}</h3>
        {action && (
          <button type="button" className="wiki-secondary-action" onClick={action} disabled={isBusy}>
            {isBusy ? <SyncOutlined spin /> : <ReloadOutlined />}
            {isBusy ? '处理中' : actionLabel}
          </button>
        )}
      </div>
      {jobs.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <div className="wiki-job-list">
          {jobs.map((job) => (
            <div key={job.id} className="wiki-job-item">
              <div>
                <strong>{job.jobType || job.job_type}</strong>
                <span>{formatDate(job.updatedAt || job.updated_at)}</span>
              </div>
              <small>
                {job.status} · 尝试 {job.attempts ?? 0}/{job.maxAttempts ?? job.max_attempts ?? 3}
              </small>
              {(job.lastError || job.last_error) && <em>{job.lastError || job.last_error}</em>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderInlineMarkdown(
  text: string,
  citationsById: Map<string, WikiAnswerCitation> = new Map(),
  onOpenSource?: (id: number) => void
) {
  const nodes: ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\[[PCR]\d+\])/g);
  parts.forEach((part, index) => {
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={index}>{part.slice(2, -2)}</strong>);
      return;
    }
    const citationMatch = part.match(/^\[([PCR]\d+)\]$/);
    if (citationMatch) {
      const citationId = citationMatch[1];
      const citation = citationsById.get(citationId);
      if (citation?.slug) {
        nodes.push(
          <Link key={index} className="wiki-inline-citation" href={`/wiki/${encodeURIComponent(citation.slug)}`}>
            [{citationId}]
          </Link>
        );
        return;
      }
      if (citation?.articleId) {
        nodes.push(
          <button key={index} type="button" className="wiki-inline-citation" onClick={() => onOpenSource?.(citation.articleId!)}>
            [{citationId}]
          </button>
        );
        return;
      }
      nodes.push(
        <span key={index} className="wiki-inline-citation wiki-inline-citation-disabled">
          [{citationId}]
        </span>
      );
      return;
    }
    nodes.push(part);
  });
  return nodes;
}

function MarkdownAnswer({
  text,
  citations = [],
  onOpenSource,
}: {
  text: string;
  citations?: WikiAnswerCitation[];
  onOpenSource: (id: number) => void;
}) {
  const citationsById = new Map(citations.map((citation) => [citation.id, citation]));
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item, citationsById, onOpenSource)}</li>
        ))}
      </ul>
    );
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(<h3 key={`heading-${blocks.length}`}>{renderInlineMarkdown(heading[2], citationsById, onOpenSource)}</h3>);
      return;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems.push(numbered[1]);
      return;
    }
    flushList();
    blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInlineMarkdown(trimmed, citationsById, onOpenSource)}</p>);
  });
  flushList();

  return <div className="wiki-answer-text">{blocks}</div>;
}

function WikiAskDock({
  open,
  setOpen,
  expanded,
  setExpanded,
  question,
  setQuestion,
  answers,
  isAsking,
  isFiling,
  filingAnswerId,
  isDeleting,
  deletingAnswerId,
  copiedAnswerId,
  historyCount,
  error,
  onAsk,
  onCopy,
  onFile,
  onNewConversation,
  onShowHistory,
  onRequestDelete,
  onOpenSource,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  question: string;
  setQuestion: (value: string) => void;
  answers: WikiAnswer[];
  isAsking?: boolean;
  isFiling?: boolean;
  filingAnswerId?: number | null;
  isDeleting?: boolean;
  deletingAnswerId?: number | null;
  copiedAnswerId?: number | null;
  historyCount?: number;
  error?: string | null;
  onAsk: (event: FormEvent) => void;
  onCopy: (answer: WikiAnswer) => void;
  onFile: (answer: WikiAnswer) => void;
  onNewConversation: () => void;
  onShowHistory: () => void;
  onRequestDelete: (answer: WikiAnswer) => void;
  onOpenSource: (id: number) => void;
}) {
  const latestCount = answers.length;
  const dockRef = useRef<HTMLElement | null>(null);
  const openExpanded = () => {
    setExpanded(true);
    setOpen(true);
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const dock = dockRef.current;
    if (!dock) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = dock.getBoundingClientRect();
    const minWidth = 360;
    const minHeight = 420;
    const maxWidth = Math.max(minWidth, window.innerWidth - 32);
    const maxHeight = Math.max(minHeight, window.innerHeight - 32);

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = clamp(startRect.width + startX - moveEvent.clientX, minWidth, maxWidth);
      const nextHeight = clamp(startRect.height + startY - moveEvent.clientY, minHeight, maxHeight);
      dock.style.width = `${Math.round(nextWidth)}px`;
      dock.style.height = `${Math.round(nextHeight)}px`;
      dock.style.maxHeight = 'none';
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  if (!open) {
    return (
      <button type="button" className="wiki-ask-floating-trigger" onClick={openExpanded}>
        <MessageOutlined />
        <span>问知识库</span>
        {latestCount > 0 && <strong>{latestCount}</strong>}
      </button>
    );
  }

  return (
    <>
    <button type="button" className="wiki-ask-click-away" aria-label="收起问知识库" tabIndex={-1} onClick={() => setOpen(false)} />
    <section ref={dockRef} className={`wiki-ask-dock${expanded ? ' wiki-ask-dock-expanded' : ''}`} aria-label="问知识库对话框">
      <button
        type="button"
        className="wiki-ask-resize-cue"
        aria-label="拖动调整问知识库窗口大小"
        title="拖动调整窗口大小"
        onPointerDown={handleResizePointerDown}
      />
      <div className="wiki-ask-dock-head">
        <div>
          <h2><MessageOutlined /> 问知识库</h2>
          <p>保留最近问答，可连续追问，回答仍会附来源。</p>
        </div>
        <div className="wiki-ask-dock-actions">
          <button
            type="button"
            onClick={onShowHistory}
            aria-label="查看历史"
            title="查看历史"
          >
            <HistoryOutlined />
            <span>历史{historyCount ? ` ${historyCount}` : ''}</span>
          </button>
          <button
            type="button"
            onClick={onNewConversation}
            aria-label="新建对话"
            title="新建对话"
          >
            <PlusOutlined />
            <span>新建</span>
          </button>
          <button
            type="button"
            className="wiki-ask-expand-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? '缩小问知识库' : '放大问知识库'}
            title={expanded ? '缩小问知识库' : '放大问知识库'}
          >
            {expanded ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
            <span>{expanded ? '缩小' : '放大'}</span>
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="收起问知识库">收起</button>
        </div>
      </div>

      <div className="wiki-ask-messages">
        {answers.length === 0 ? (
          <div className="wiki-ask-empty">
            <RobotOutlined />
            <strong>可以问归档文章里的任何问题</strong>
            <span>例如：哪些 NAS 方案适合家庭服务器？Obsidian 插件有哪些值得装？</span>
          </div>
        ) : (
          answers.map((answer) => {
            const citations = answer.citations || answer.context?.citations || [];
            return (
              <article key={answer.id} className="wiki-ask-message">
                <div className="wiki-question-bubble">{answer.question}</div>
                <div className="wiki-answer-card">
                  <div className="wiki-answer-head">
                    <span>回答 #{answer.id}</span>
                    <div className="wiki-answer-head-actions">
                      <button
                        type="button"
                        className="wiki-secondary-action"
                        onClick={() => onCopy(answer)}
                        aria-label={`复制回答 #${answer.id}`}
                        title="复制回答"
                      >
                        <CopyOutlined />
                        <span>{copiedAnswerId === answer.id ? '已复制' : '复制'}</span>
                      </button>
                      <button
                        type="button"
                        className="wiki-secondary-action"
                        onClick={() => onFile(answer)}
                        disabled={isFiling || answer.status === 'filed' || Boolean(answer.filedPageId || answer.filed_page_id)}
                      >
                        {isFiling && filingAnswerId === answer.id ? <SyncOutlined spin /> : <SaveOutlined />}
                        {answer.status === 'filed' || answer.filedPageId || answer.filed_page_id ? '已沉淀' : '沉淀'}
                      </button>
                      <button
                        type="button"
                        className="wiki-secondary-action wiki-danger-inline-action"
                        onClick={() => onRequestDelete(answer)}
                        disabled={isDeleting}
                        aria-label={`删除回答 #${answer.id}`}
                        title="删除这条记录"
                      >
                        {isDeleting && deletingAnswerId === answer.id ? <SyncOutlined spin /> : <DeleteOutlined />}
                        <span>删除</span>
                      </button>
                    </div>
                  </div>
                  <MarkdownAnswer text={answer.answer} citations={citations} onOpenSource={onOpenSource} />
                  {citations.length > 0 && (
                    <div className="wiki-answer-citations">
                      {citations.slice(0, 6).map((citation) => (
                        citation.slug ? (
                          <Link key={citation.id} href={`/wiki/${encodeURIComponent(citation.slug)}`}>
                            <strong>{citation.id} · {citation.title}</strong>
                            {citation.excerpt && <span>{citation.excerpt}</span>}
                          </Link>
                        ) : (
                          <button key={citation.id} type="button" onClick={() => citation.articleId && onOpenSource(citation.articleId)} disabled={!citation.articleId}>
                            <strong>{citation.id} · {citation.title}</strong>
                            {citation.excerpt && <span>{citation.excerpt}</span>}
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {error && <div className="wiki-job-error">{error}</div>}
      <form className="wiki-ask-form wiki-ask-dock-form" onSubmit={onAsk}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="继续追问知识库..."
        />
        <button type="submit" disabled={isAsking || question.trim().length < 2}>
          {isAsking ? <SyncOutlined spin /> : <SendOutlined />}
          {isAsking ? '思考中' : '提问'}
        </button>
      </form>
    </section>
    </>
  );
}

function WikiCommandBar({
  status,
  searchInput,
  setSearchInput,
  onSearch,
}: {
  status?: WikiStatus;
  searchInput: string;
  setSearchInput: (value: string) => void;
  onSearch: (event?: FormEvent) => void;
}) {
  return (
    <section className="wiki-command-bar">
      <div className="wiki-command-title">
        <div className="wiki-eyebrow"><BookOutlined /> 自动知识库</div>
        <h1>知识库 Wiki</h1>
        <span>{status?.pages ?? 0} 页 · {status?.claims ?? 0} 条声明 · {status?.pending_jobs ?? 0} 个待处理</span>
      </div>
      <form className="wiki-command-search" onSubmit={onSearch}>
        <SearchOutlined />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="搜索 Wiki 页面、概念、来源文章..."
        />
        <button type="submit" aria-label="搜索">搜索</button>
      </form>
    </section>
  );
}

export function WikiHomeContent() {
  const { isAuthenticated } = useAuth();
  const { openArticle } = useArticleContext();
  const [activeType, setActiveType] = useState('all');
  const { data, error, isLoading, mutate } = useSWR(
    `wiki:home:${activeType}`,
    () => api.getWikiHome(activeType),
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      refreshInterval: (latest) => latest?.status?.pending_jobs || latest?.status?.running_jobs || latest?.status?.runner_active ? 3500 : 0,
    }
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRebuildingAll, setIsRebuildingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLinting, setIsLinting] = useState(false);
  const [statView, setStatView] = useState<WikiStatKey | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askExpanded, setAskExpanded] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswers, setAskAnswers] = useState<WikiAnswer[]>([]);
  const [askError, setAskError] = useState<string | null>(null);
  const [askUsesHistory, setAskUsesHistory] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [isFilingAnswer, setIsFilingAnswer] = useState(false);
  const [filingAnswerId, setFilingAnswerId] = useState<number | null>(null);
  const [isDeletingAnswer, setIsDeletingAnswer] = useState(false);
  const [deletingAnswerId, setDeletingAnswerId] = useState<number | null>(null);
  const [copiedAnswerId, setCopiedAnswerId] = useState<number | null>(null);
  const [deleteAnswerConfirm, setDeleteAnswerConfirm] = useState<WikiAnswer | null>(null);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const pages = (data?.pages ?? []) as WikiPageSummary[];
  const pageTypes = data?.pageTypes ?? [];
  const pendingJobs = (data?.jobs ?? []) as WikiJob[];
  const failedJobs = (data?.failedJobs ?? []) as WikiJob[];
  const recentArticles = (data?.recentArticles ?? []) as WikiArticleSummary[];
  const logEntries = (data?.log ?? []) as WikiLogEntry[];
  const lintFindings = (data?.lint ?? []) as WikiLintFinding[];
  const meta = data?.meta ?? {};
  const status = data?.status as WikiStatus | undefined;
  const isTypeSwitching = isLoading && Boolean(data);
  const { data: searchData, isLoading: isSearching } = useSWR(
    searchQuery ? `wiki:search:${searchQuery}` : null,
    () => api.searchWiki(searchQuery, 12),
    { revalidateOnFocus: false }
  );
  const { data: answerHistory, mutate: mutateAnswerHistory } = useSWR(
    isAuthenticated ? 'wiki:answers:recent' : null,
    () => api.getWikiAnswers(20),
    { revalidateOnFocus: false }
  );
  const activeTypeMeta = WIKI_TYPES.find((item) => item.key === activeType) ?? WIKI_TYPES[0];
  const recentAnswerHistory = useMemo(
    () => ((answerHistory?.answers ?? []) as WikiAnswer[]).slice().reverse(),
    [answerHistory]
  );

  useEffect(() => {
    if (!askUsesHistory) return;
    setAskAnswers(recentAnswerHistory);
  }, [answerHistory, askUsesHistory, recentAnswerHistory]);

  const typeCount = (type: string) => {
    if (type === 'all') return status?.pages ?? 0;
    return pageTypes.find((item: any) => item.type === type)?.count ?? 0;
  };

  const handleUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setTaskError(null);
    try {
      await api.updateWiki(4);
      setStatView('pending');
      await mutate();
    } catch (error: any) {
      setStatView('failed');
      setTaskError(error?.message || '更新知识库失败');
      await mutate();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmUpdate = async () => {
    setUpdateConfirmOpen(false);
    await handleUpdate();
  };

  const handleProcess = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTaskError(null);
    try {
      await api.processWikiJobs(4);
      setStatView('pending');
      await mutate();
    } catch (error: any) {
      setStatView('failed');
      setTaskError(error?.message || '处理 Wiki 队列失败');
      await mutate();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setTaskError(null);
    try {
      await api.retryFailedWikiJobs(4);
      await mutate();
    } catch (error: any) {
      setStatView('failed');
      setTaskError(error?.message || '重试失败任务失败');
      await mutate();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRebuildAll = async () => {
    setIsRebuildingAll(true);
    setTaskError(null);
    try {
      await api.rebuildAllWiki(4);
      setStatView('pending');
      await mutate();
    } catch (error: any) {
      setStatView('failed');
      setTaskError(error?.message || '全量重建 Wiki 失败');
      await mutate();
    } finally {
      setIsRebuildingAll(false);
      setRebuildConfirmOpen(false);
    }
  };

  const handleSearch = (event?: FormEvent) => {
    event?.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleRefreshList = async () => {
    setIsRefreshing(true);
    try {
      await mutate();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLint = async () => {
    if (isLinting) return;
    setIsLinting(true);
    setTaskError(null);
    try {
      await api.lintWiki();
      await mutate();
    } catch (error: any) {
      setTaskError(error?.message || 'Wiki 健康检查失败');
    } finally {
      setIsLinting(false);
    }
  };

  const handleAskWiki = async (event: FormEvent) => {
    event.preventDefault();
    const question = askQuestion.trim();
    if (question.length < 2 || isAsking) return;
    setIsAsking(true);
    setAskError(null);
    setAskUsesHistory(false);
    try {
      const history = askAnswers.slice(-5).map((item) => ({ question: item.question, answer: item.answer }));
      const result = await api.askWiki(question, history);
      setAskAnswers((items) => [...items, result]);
      setAskQuestion('');
      await mutateAnswerHistory();
    } catch (error: any) {
      setAskError(error?.message || '知识库问答失败');
    } finally {
      setIsAsking(false);
    }
  };

  const handleFileAnswer = async (answer: WikiAnswer) => {
    if (!answer || isFilingAnswer) return;
    setIsFilingAnswer(true);
    setFilingAnswerId(answer.id);
    setAskError(null);
    try {
      const result = await api.fileWikiAnswer(answer.id);
      setAskAnswers((items) => items.map((item) => (
        item.id === answer.id ? { ...item, status: 'filed', filedPageId: result.pageId } : item
      )));
      setActiveType('analysis');
      await mutateAnswerHistory();
      await mutate();
    } catch (error: any) {
      setAskError(error?.message || '沉淀问答失败');
    } finally {
      setIsFilingAnswer(false);
      setFilingAnswerId(null);
    }
  };

  const handleNewAskConversation = () => {
    setAskUsesHistory(false);
    setAskAnswers([]);
    setAskQuestion('');
    setAskError(null);
  };

  const handleShowAskHistory = async () => {
    setAskUsesHistory(true);
    setAskError(null);
    setAskAnswers(recentAnswerHistory);
    await mutateAnswerHistory();
  };

  const handleCopyAnswer = async (answer: WikiAnswer) => {
    if (!answer?.answer) return;
    setAskError(null);
    try {
      await navigator.clipboard.writeText(answer.answer);
      setCopiedAnswerId(answer.id);
      window.setTimeout(() => {
        setCopiedAnswerId((current) => current === answer.id ? null : current);
      }, 1600);
    } catch (error: any) {
      setAskError(error?.message || '复制回答失败');
    }
  };

  const handleDeleteAnswer = async () => {
    const answer = deleteAnswerConfirm;
    if (!answer || isDeletingAnswer) return;
    setIsDeletingAnswer(true);
    setDeletingAnswerId(answer.id);
    setAskError(null);
    try {
      await api.deleteWikiAnswer(answer.id);
      setAskAnswers((items) => items.filter((item) => item.id !== answer.id));
      setDeleteAnswerConfirm(null);
      await mutateAnswerHistory();
    } catch (error: any) {
      setAskError(error?.message || '删除问答记录失败');
    } finally {
      setIsDeletingAnswer(false);
      setDeletingAnswerId(null);
    }
  };

  const renderStatDetail = () => {
    if (!statView) return null;
    if (statView === 'articles' || statView === 'indexed') {
      return (
        <section className="wiki-stat-detail">
          <div className="wiki-section-heading">
            <div>
              <h2>来源文章</h2>
              <p>这些归档文章是 Wiki 的 raw sources，会被切块、抽取声明并合并进页面。</p>
            </div>
          </div>
          {recentArticles.length === 0 ? (
            <div className="wiki-empty wiki-compact-empty">还没有文章进入 Wiki。</div>
          ) : (
            <div className="wiki-recent-list wiki-inline-list">
              {recentArticles.map((article) => (
                <button key={article.id} type="button" onClick={() => openArticle(article.id)}>
                  <strong>{article.title}</strong>
                  <span>{article.source || '未知来源'} · {article.status || 'pending'} · {formatDate(article.lastIndexedAt || article.last_indexed_at || article.archivedAt || article.archived_at)}</span>
                  {article.summary && <small>{article.summary}</small>}
                </button>
              ))}
            </div>
          )}
        </section>
      );
    }
    if (statView === 'pages') {
      return (
        <section className="wiki-stat-detail">
          <div className="wiki-section-heading">
            <div>
              <h2>页面分类</h2>
              <p>点击分类可切换主列表，只看对应类型的 Wiki 页面。</p>
            </div>
          </div>
          <div className="wiki-type-strip">
            {WIKI_TYPES.map((item) => (
              <button key={item.key} type="button" className={activeType === item.key ? 'active' : ''} onClick={() => setActiveType(item.key)}>
                <span>{item.label}</span>
                <strong>{typeCount(item.key)}</strong>
              </button>
            ))}
          </div>
        </section>
      );
    }
    if (statView === 'claims') {
      return (
        <section className="wiki-stat-detail">
          <div className="wiki-section-heading">
            <div>
              <h2>知识声明</h2>
              <p>Claims 是从 raw chunks 抽取出的可追溯结论。打开页面可查看具体 claim 与来源。</p>
            </div>
          </div>
          <div className="wiki-mini-page-list">
            {pages.slice(0, 8).map((page) => (
              <Link key={page.id} href={`/wiki/${encodeURIComponent(page.slug)}`}>
                <strong>{page.title}</strong>
                <span>{page.claim_count ?? 0} claims · {page.source_count ?? 0} 来源</span>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    if (statView === 'lint') {
      return (
        <section className="wiki-stat-detail">
          <div className="wiki-section-heading">
            <div>
              <h2>知识库健康</h2>
              <p>低来源、缺少引用和失败任务会在这里提示。</p>
            </div>
            {isAuthenticated && (
              <button type="button" className="wiki-secondary-action" onClick={handleLint} disabled={isLinting}>
                {isLinting ? <SyncOutlined spin /> : <WarningOutlined />}
                {isLinting ? '检查中' : '运行 Lint'}
              </button>
            )}
          </div>
          {lintFindings.length === 0 ? (
            <div className="wiki-empty wiki-compact-empty">当前没有开放的健康问题。</div>
          ) : (
            <div className="wiki-finding-list">
              {lintFindings.map((finding) => (
                <div key={finding.id} className={`wiki-finding-item wiki-finding-${finding.severity || 'info'}`}>
                  <strong>{finding.title}</strong>
                  <span>{finding.findingType || finding.finding_type} · {formatDate(finding.createdAt || finding.created_at)}</span>
                  {finding.details && <p>{finding.details}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }
    if (statView === 'pending') {
      return (
        <JobList
          title="待处理任务"
          jobs={pendingJobs}
          empty="当前没有待处理任务。"
          action={isAuthenticated ? handleProcess : undefined}
          actionLabel="继续处理队列"
          isBusy={isProcessing}
        />
      );
    }
    if (statView === 'failed') {
      return (
        <JobList
          title="失败任务"
          jobs={failedJobs}
          empty="当前没有失败任务。"
          action={isAuthenticated ? handleRetry : undefined}
          actionLabel="重试失败任务"
          isBusy={isRetrying}
        />
      );
    }
    if (statView === 'log') {
      return (
        <section className="wiki-stat-detail">
          <div className="wiki-section-heading">
            <div>
              <h2>演化日志</h2>
              <p>记录 ingest、页面合并、健康检查和单页导出事件。</p>
            </div>
          </div>
          {logEntries.length === 0 ? (
            <div className="wiki-empty wiki-compact-empty">还没有演化日志。</div>
          ) : (
            <div className="wiki-log-list">
              {logEntries.map((entry) => (
                <div key={entry.id} className="wiki-log-item">
                  <strong>{entry.title}</strong>
                  <span>{entry.eventType || entry.event_type} · {formatDate(entry.createdAt || entry.created_at)}</span>
                  {entry.details && <p>{entry.details}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }
    return null;
  };

  if (isLoading && !data) {
    return <div className="wiki-page-shell"><div className="wiki-loading">正在读取知识库...</div></div>;
  }

  if (error) {
    return (
      <div className="wiki-page-shell">
        <WikiCommandBar
          status={status}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSearch={handleSearch}
        />
        <div className="wiki-empty">知识库加载失败，请确认已登录并且 API 服务可用。</div>
      </div>
    );
  }

  return (
    <div className="wiki-page-shell">
      <WikiCommandBar
        status={status}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={handleSearch}
      />

      {searchQuery && (
        <section className="wiki-search-panel">
          <div className="wiki-search-results">
            <div className="wiki-section-heading">
              <div>
                <h2>搜索结果</h2>
                <p>{isSearching ? '正在搜索...' : `“${searchQuery}” 的 Wiki 匹配结果`}</p>
              </div>
              <button type="button" className="wiki-secondary-action" onClick={() => { setSearchQuery(''); setSearchInput(''); }}>
                清空
              </button>
            </div>
            <div className="wiki-search-columns">
              <div>
                <h3>Wiki 页面</h3>
                {(searchData?.pages ?? []).length === 0 ? <p>没有匹配的 Wiki 页面。</p> : (
                  searchData.pages.map((page: any) => (
                    <Link key={page.id} href={`/wiki/${encodeURIComponent(page.slug)}`}>
                      <strong>{page.title}</strong>
                      <span>{pageTypeLabel(pageTypeOf(page))} · {page.source_count ?? 0} 来源</span>
                    </Link>
                  ))
                )}
              </div>
              <div>
                <h3>来源文章</h3>
                {(searchData?.articles ?? []).length === 0 ? <p>没有匹配的来源文章。</p> : (
                  searchData.articles.map((article: WikiArticleSummary) => (
                    <button key={article.id} type="button" onClick={() => openArticle(article.id)}>
                      <strong>{article.title}</strong>
                      <span>{article.source || '未知来源'} · {article.status || 'indexed'}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="wiki-dashboard">
        <CompactStat active={statView === 'articles'} icon={<DatabaseOutlined />} label="归档" value={status?.archived} onClick={() => setStatView(statView === 'articles' ? null : 'articles')} />
        <CompactStat active={statView === 'pages'} icon={<BookOutlined />} label="页面" value={status?.pages} onClick={() => { setActiveType('all'); setStatView(statView === 'pages' ? null : 'pages'); }} />
        <CompactStat active={statView === 'claims'} icon={<ClusterOutlined />} label="声明" value={status?.claims} onClick={() => setStatView(statView === 'claims' ? null : 'claims')} />
        <CompactStat active={statView === 'lint'} icon={<WarningOutlined />} label="健康" value={status?.lint_findings} onClick={() => setStatView(statView === 'lint' ? null : 'lint')} />
        <CompactStat active={statView === 'pending'} icon={<ClockCircleOutlined />} label="待处理" value={status?.pending_jobs} onClick={() => setStatView(statView === 'pending' ? null : 'pending')} />
        <CompactStat active={statView === 'failed'} icon={<FileSearchOutlined />} label="失败" value={status?.failed_jobs} onClick={() => setStatView(statView === 'failed' ? null : 'failed')} />
        <CompactStat active={statView === 'log'} icon={<BranchesOutlined />} label="日志" value={logEntries.length} onClick={() => setStatView(statView === 'log' ? null : 'log')} />
      </section>

      {!isAuthenticated && <div className="wiki-readonly-banner">当前为游客只读模式：可以浏览 Wiki 页面、搜索和打开归档来源文章，维护操作需登录。</div>}

      {isAuthenticated && taskError && <div className="wiki-job-error">{taskError}</div>}

      {renderStatDetail()}

      <section className="wiki-layout">
        <aside className="wiki-sidebar">
          <div className="wiki-sidebar-title">目录</div>
          {WIKI_TYPES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`wiki-sidebar-item${activeType === item.key ? ' active' : ''}`}
              onClick={() => setActiveType(item.key)}
            >
              <span>{item.label}</span>
              <strong>{typeCount(item.key)}</strong>
            </button>
          ))}
          <div className="wiki-sidebar-title">状态摘要</div>
          <div className="wiki-sidebar-note">
            <div>最近更新：{formatDate(meta.last_updated_at || meta.lastUpdatedAt || meta.last_finished_at)}</div>
            <div>版本记录：{meta.versions ?? 0}</div>
            <div>模型：{meta.provider || 'default'} / {meta.model || 'default'}</div>
          </div>
          {isAuthenticated && (
            <>
              <div className="wiki-sidebar-title">维护</div>
              <button type="button" className="wiki-sidebar-item" onClick={() => setUpdateConfirmOpen(true)} disabled={isUpdating}>
                {isUpdating ? '更新中' : '更新知识库'}
              </button>
              <button type="button" className="wiki-sidebar-item" onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? '重试中' : '重试失败任务'}
              </button>
              <button type="button" className="wiki-sidebar-item" onClick={handleLint} disabled={isLinting}>
                {isLinting ? '检查中' : '健康检查 / Lint'}
              </button>
              <button type="button" className="wiki-sidebar-item wiki-sidebar-item-danger" onClick={() => setRebuildConfirmOpen(true)} disabled={isRebuildingAll}>
                {isRebuildingAll ? '重建中' : '全量重建 Wiki'}
              </button>
            </>
          )}
        </aside>

        <main className="wiki-main">
          <div className="wiki-mobile-type-nav" aria-label="Wiki 目录筛选">
            {WIKI_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeType === item.key ? 'active' : ''}
                onClick={() => setActiveType(item.key)}
              >
                <span>{item.label}</span>
                <strong>{typeCount(item.key)}</strong>
              </button>
            ))}
          </div>
          <div className="wiki-section-heading">
            <div>
              <h2>{activeTypeMeta.label}</h2>
              <p>{activeTypeMeta.help}</p>
            </div>
            <button type="button" className="wiki-secondary-action" onClick={handleRefreshList} disabled={isRefreshing}>
              {isRefreshing ? <SyncOutlined spin /> : <ReloadOutlined />}
              {isRefreshing ? '刷新中' : '刷新列表'}
            </button>
            {isTypeSwitching && <span className="wiki-inline-loading"><SyncOutlined spin /> 筛选中</span>}
          </div>

          {pages.length === 0 ? (
            <div className="wiki-empty">
              <RobotOutlined />
              <strong>还没有 Wiki 页面</strong>
              <span>可在左侧维护区更新知识库，系统会读取当前归档文章并生成主题页。</span>
            </div>
          ) : (
            <div className={`wiki-card-grid${isTypeSwitching ? ' wiki-card-grid-loading' : ''}`}>
              {pages.map((page) => (
                <Link key={page.id} className="wiki-card" href={`/wiki/${encodeURIComponent(page.slug)}`}>
                  <div className="wiki-card-top">
                    <span className="wiki-card-type">{pageTypeLabel(pageTypeOf(page))}</span>
                    <span className="wiki-card-version">v{page.version}</span>
                  </div>
                  <h3>{page.title}</h3>
                  <p>{page.summary || '等待页面合并器补全摘要。'}</p>
                  <div className="wiki-card-meta">
                    <span><ClockCircleOutlined /> {formatDate(page.lastGeneratedAt || page.last_generated_at || page.updatedAt || page.updated_at)}</span>
                    <span><BranchesOutlined /> {page.source_count ?? 0} 来源 · {page.claim_count ?? 0} 声明</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </section>

      {isAuthenticated && (
        <WikiAskDock
          open={askOpen}
          setOpen={setAskOpen}
          expanded={askExpanded}
          setExpanded={setAskExpanded}
          question={askQuestion}
          setQuestion={setAskQuestion}
          answers={askAnswers}
          isAsking={isAsking}
          isFiling={isFilingAnswer}
          filingAnswerId={filingAnswerId}
          isDeleting={isDeletingAnswer}
          deletingAnswerId={deletingAnswerId}
          copiedAnswerId={copiedAnswerId}
          historyCount={recentAnswerHistory.length}
          error={askError}
          onAsk={handleAskWiki}
          onCopy={handleCopyAnswer}
          onFile={handleFileAnswer}
          onNewConversation={handleNewAskConversation}
          onShowHistory={handleShowAskHistory}
          onRequestDelete={setDeleteAnswerConfirm}
          onOpenSource={openArticle}
        />
      )}

      {isAuthenticated && updateConfirmOpen && (
        <div className="wiki-confirm-overlay" role="presentation" onMouseDown={() => !isUpdating && setUpdateConfirmOpen(false)}>
          <section
            className="wiki-confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wiki-update-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="wiki-eyebrow"><ReloadOutlined /> 维护任务</div>
            <h2 id="wiki-update-title">更新知识库</h2>
            <p>系统会扫描当前已归档文章，创建或推进 Wiki 编译队列，并处理一批待处理任务。文章较多时后台可能持续运行一段时间，期间可以继续浏览页面。</p>
            <div className="wiki-confirm-actions">
              <button type="button" className="wiki-secondary-action" onClick={() => setUpdateConfirmOpen(false)} disabled={isUpdating}>
                取消
              </button>
              <button type="button" className="wiki-primary-action" onClick={handleConfirmUpdate} disabled={isUpdating}>
                {isUpdating ? <SyncOutlined spin /> : <ReloadOutlined />}
                {isUpdating ? '更新中' : '确认更新'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isAuthenticated && rebuildConfirmOpen && (
        <div className="wiki-confirm-overlay" role="presentation" onMouseDown={() => !isRebuildingAll && setRebuildConfirmOpen(false)}>
          <section
            className="wiki-confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wiki-rebuild-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="wiki-eyebrow"><ReloadOutlined /> 高风险操作</div>
            <h2 id="wiki-rebuild-title">全量重建 Wiki</h2>
            <p>系统会先隐藏当前 Wiki 页面，并从所有归档文章重新编译知识库。已有文章不会被删除，但 Wiki 页面会按最新抽取结果重新生成。</p>
            <div className="wiki-confirm-actions">
              <button type="button" className="wiki-secondary-action" onClick={() => setRebuildConfirmOpen(false)} disabled={isRebuildingAll}>
                取消
              </button>
              <button type="button" className="wiki-primary-action wiki-danger-action" onClick={handleRebuildAll} disabled={isRebuildingAll}>
                {isRebuildingAll ? <SyncOutlined spin /> : <ReloadOutlined />}
                {isRebuildingAll ? '重建中' : '确认重建'}
              </button>
            </div>
          </section>
        </div>
      )}

      {isAuthenticated && deleteAnswerConfirm && (
        <div className="wiki-confirm-overlay" role="presentation" onMouseDown={() => !isDeletingAnswer && setDeleteAnswerConfirm(null)}>
          <section
            className="wiki-confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wiki-delete-answer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="wiki-eyebrow"><DeleteOutlined /> 问答记录</div>
            <h2 id="wiki-delete-answer-title">删除这条记录</h2>
            <p>这只会删除当前问答历史记录，不会删除已经沉淀生成的 Wiki 页面。</p>
            <div className="wiki-confirm-preview">{deleteAnswerConfirm.question}</div>
            <div className="wiki-confirm-actions">
              <button type="button" className="wiki-secondary-action" onClick={() => setDeleteAnswerConfirm(null)} disabled={isDeletingAnswer}>
                取消
              </button>
              <button type="button" className="wiki-primary-action wiki-danger-action" onClick={handleDeleteAnswer} disabled={isDeletingAnswer}>
                {isDeletingAnswer ? <SyncOutlined spin /> : <DeleteOutlined />}
                {isDeletingAnswer ? '删除中' : '确认删除'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function renderBlock(block: WikiBlock, index: number, sourcesById: Map<number, any>, claimsById: Map<number, any>, onOpenSource: (id: number) => void) {
  const id = blockId(block, index);
  if (block.type === 'summary') return <div key={id} id={id} className="wiki-doc-summary">{block.text}</div>;
  if (block.type === 'heading') {
    const Tag = block.level === 3 ? 'h3' : 'h2';
    return <Tag key={id} id={id}>{block.text}</Tag>;
  }
  if (block.type === 'bullet_list') {
    return (
      <ul key={id} id={id} className="wiki-doc-list">
        {(block.items || []).map((item, index) => (
          <li key={`${id}-${index}`}>
            <span className="wiki-doc-list-text">
              {item.text}
              {Boolean(item.sources?.length || item.claims?.length) && (
                <small className="wiki-citation-row" aria-label="来源和声明">
                  {item.sources?.map((id, sourceIndex) => (
                    <button
                      key={`source-${id}`}
                      type="button"
                      onClick={() => onOpenSource(id)}
                      title={sourcesById.get(id)?.title || `来源 #${id}`}
                    >
                      S{sourceIndex + 1}
                    </button>
                  ))}
                  {item.claims?.map((id) => (
                    <span
                      key={`claim-${id}`}
                      title={`${claimsById.get(id)?.claim || `Claim #${id}`}${claimsById.get(id)?.confidence ? ` · ${claimsById.get(id).confidence}%` : ''}`}
                    >
                      C{id}
                    </span>
                  ))}
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'source_list') {
    return (
      <div key={id} id={id} className="wiki-source-list-inline">
        {(block.articleIds || []).map((id) => {
          const source = sourcesById.get(id);
          return source ? (
            <button key={id} type="button" onClick={() => onOpenSource(id)}>
              <LinkOutlined />
              {source.title}
            </button>
          ) : null;
        })}
      </div>
    );
  }
  return <p key={id} id={id}>{block.text}</p>;
}

export function WikiPageContent() {
  const { isAuthenticated } = useAuth();
  const params = useParams<{ slug: string }>();
  const { openArticle } = useArticleContext();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { data, error, isLoading, mutate } = useSWR(slug ? `wiki:page:${slug}` : null, () => api.getWikiPage(slug), { revalidateOnFocus: false });
  const [isRebuildingPage, setIsRebuildingPage] = useState(false);
  const [isExportingPage, setIsExportingPage] = useState(false);
  const [pageActionError, setPageActionError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="wiki-page-shell"><div className="wiki-loading">正在读取 Wiki 页面...</div></div>;
  }

  if (error || !data) {
    return <div className="wiki-page-shell"><div className="wiki-empty">这个 Wiki 页面暂时不存在。</div></div>;
  }

  const blocks = (data.blocks || []) as WikiBlock[];
  const sources = data.sources || [];
  const relatedPages = data.relatedPages || [];
  const claims = data.claims || [];
  const versions = data.versions || [];
  const sourcesById = new Map<number, any>(sources.map((source: any) => [source.id, source]));
  const claimsById = new Map<number, any>(claims.map((claim: any) => [claim.id, claim]));

  const handleRebuild = async () => {
    if (isRebuildingPage) return;
    setIsRebuildingPage(true);
    setPageActionError(null);
    try {
      await api.rebuildWikiPage(data.id);
      await mutate();
    } catch (error: any) {
      setPageActionError(error?.message || '重建本页失败');
    } finally {
      setIsRebuildingPage(false);
    }
  };

  const handleExportPage = async () => {
    if (isExportingPage || !slug) return;
    setIsExportingPage(true);
    setPageActionError(null);
    try {
      const result = await api.exportWikiPageMarkdown(slug);
      const blob = new Blob([result.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename || `${slug}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setPageActionError(error?.message || '导出 Markdown 失败');
    } finally {
      setIsExportingPage(false);
    }
  };

  return (
    <div className="wiki-page-shell wiki-detail-shell">
      <section className="wiki-doc-layout">
        <aside className="wiki-doc-toc">
          <Link href="/wiki" className="wiki-back-link" aria-label="返回知识库" title="返回知识库">
            <ArrowLeftOutlined />
          </Link>
          <div className="wiki-sidebar-title">页面大纲</div>
          {blocks.map((block, index) => ({ block, id: blockId(block, index) }))
            .filter(({ block }) => block.type === 'heading')
            .map(({ block, id }) => (
              <a key={id} href={`#${id}`}>{block.text}</a>
            ))}
        </aside>

        <article className="wiki-doc">
          <div className="wiki-doc-title-row">
            <div>
              <div className="wiki-eyebrow"><FileTextOutlined /> {pageTypeLabel(pageTypeOf(data))}</div>
              <h1>{data.title}</h1>
              <p>版本 v{data.version} · 最近生成 {formatDate(data.lastGeneratedAt)}</p>
            </div>
            {isAuthenticated && (
              <div className="wiki-doc-actions">
                <button type="button" className="wiki-secondary-action" onClick={handleExportPage} disabled={isExportingPage}>
                  {isExportingPage ? <SyncOutlined spin /> : <DownloadOutlined />}
                  {isExportingPage ? '导出中' : '导出 Markdown'}
                </button>
                <button type="button" className="wiki-secondary-action" onClick={handleRebuild} disabled={isRebuildingPage}>
                  {isRebuildingPage ? <SyncOutlined spin /> : <ReloadOutlined />}
                  {isRebuildingPage ? '重建中' : '重建本页'}
                </button>
              </div>
            )}
          </div>
          {pageActionError && <div className="wiki-job-error">{pageActionError}</div>}
          <div className="wiki-doc-body">
            {blocks.length ? blocks.map((block, index) => renderBlock(block, index, sourcesById, claimsById, openArticle)) : <div className="wiki-empty">本页还没有生成内容。</div>}
          </div>
        </article>

        <aside className="wiki-doc-context">
          <div className="wiki-context-card">
            <h3>相关页面</h3>
            {relatedPages.length === 0 ? (
              <p>暂无关联页面。</p>
            ) : (
              relatedPages.map((page: any) => (
                <Link key={page.id} href={`/wiki/${encodeURIComponent(page.slug)}`}>
                  <strong><LinkOutlined /> {page.title}</strong>
                  <span>{pageTypeLabel(pageTypeOf(page))} · {page.reason || '相关页面'}</span>
                </Link>
              ))
            )}
          </div>
          <div className="wiki-context-card">
            <h3>知识声明</h3>
            {claims.length === 0 ? (
              <p>暂无 claim 引用。</p>
            ) : (
              claims.slice(0, 10).map((claim: any) => (
                <button key={claim.id} type="button" onClick={() => claim.article_id && openArticle(claim.article_id)}>
                  <strong>{claim.claim}</strong>
                  <span>{claim.article_title || '来源文章'} · {claim.confidence ?? 70}%</span>
                </button>
              ))
            )}
          </div>
          <div className="wiki-context-card">
            <h3>来源文章</h3>
            {sources.length === 0 ? (
              <p>暂无来源。</p>
            ) : (
              sources.map((source: any) => (
                <button key={source.id} type="button" onClick={() => openArticle(source.id)}>
                  <strong>{source.title}</strong>
                  <span>{source.source || '未知来源'}</span>
                </button>
              ))
            )}
          </div>
          <div className="wiki-context-card">
            <h3>版本记录</h3>
            {versions.length === 0 ? (
              <p>暂无版本。</p>
            ) : (
              versions.map((version: any) => (
                <div key={version.id} className="wiki-version-row">
                  <strong>v{version.version}</strong>
                  <span>{formatDate(version.createdAt || version.created_at)} · {(version.sourceArticleIds || version.source_article_ids || []).length} 来源</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
