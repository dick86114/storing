'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import useSWR from 'swr';
import { ArrowLeftOutlined, BookOutlined, BranchesOutlined, ClockCircleOutlined, FileTextOutlined, LinkOutlined, ReloadOutlined, RobotOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons';
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
};

type WikiBlock = {
  id?: string;
  type: string;
  text?: string;
  level?: number;
  items?: Array<{ text: string; sources?: number[] }>;
  articleIds?: number[];
  pageIds?: number[];
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

const WIKI_TYPES = [
  { key: 'all', label: '全部页面', help: '所有由归档文章生成的 Wiki 页面。' },
  { key: 'topic', label: '主题', help: '围绕文章主题、来源或专题聚合出的长页面。' },
  { key: 'concept', label: '概念', help: '从文章中抽取出的实体、工具、技术名词或关键概念。' },
  { key: 'index', label: '资料索引', help: '低价值或暂时难以归类的内容会先进入索引页。' },
];

function formatDate(value?: string | null) {
  if (!value) return '尚未生成';
  return new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ label, value }: { label: string; value: number | undefined }) {
  return (
    <span className="wiki-status-pill">
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </span>
  );
}

function pageTypeOf(page: WikiPageSummary | any) {
  return page.pageType || page.page_type || 'topic';
}

function pageTypeLabel(type: string) {
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

function WikiHeader({
  status,
  onUpdate,
  isUpdating,
}: {
  status?: WikiStatus;
  onUpdate?: () => void;
  isUpdating?: boolean;
}) {
  return (
    <section className="wiki-hero">
      <div>
        <div className="wiki-eyebrow"><BookOutlined /> 自动知识库</div>
        <h1>知识库 Wiki</h1>
        <p>
          由 {status?.archived ?? 0} 篇归档文章自动整理，当前生成 {status?.pages ?? 0} 个 Wiki 页面。
          {status?.pending_jobs ? ` 还有 ${status.pending_jobs} 个任务等待处理。` : ' 知识库处于可浏览状态。'}
        </p>
      </div>
      {onUpdate && (
        <button className="wiki-primary-action" type="button" onClick={onUpdate} disabled={isUpdating}>
          {isUpdating ? <SyncOutlined spin /> : <ReloadOutlined />}
          {isUpdating ? '更新中' : '更新知识库'}
        </button>
      )}
    </section>
  );
}

export function WikiHomeContent() {
  const { openArticle } = useArticleContext();
  const [activeType, setActiveType] = useState('all');
  const { data, error, isLoading, mutate } = useSWR(
    `wiki:home:${activeType}`,
    () => api.getWikiHome(activeType),
    {
      revalidateOnFocus: false,
      refreshInterval: (latest) => latest?.status?.pending_jobs || latest?.status?.running_jobs || latest?.status?.runner_active ? 3500 : 0,
    }
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRebuildingAll, setIsRebuildingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [taskView, setTaskView] = useState<'pending' | 'failed' | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [rebuildConfirmOpen, setRebuildConfirmOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const pages = (data?.pages ?? []) as WikiPageSummary[];
  const pageTypes = data?.pageTypes ?? [];
  const pendingJobs = (data?.jobs ?? []) as WikiJob[];
  const failedJobs = (data?.failedJobs ?? []) as WikiJob[];
  const recentArticles = (data?.recentArticles ?? []) as WikiArticleSummary[];
  const meta = data?.meta ?? {};
  const status = data?.status as WikiStatus | undefined;
  const { data: searchData, isLoading: isSearching } = useSWR(
    searchQuery ? `wiki:search:${searchQuery}` : null,
    () => api.searchWiki(searchQuery, 12),
    { revalidateOnFocus: false }
  );
  const activeTypeMeta = WIKI_TYPES.find((item) => item.key === activeType) ?? WIKI_TYPES[0];

  const typeCount = (type: string) => {
    if (type === 'all') return status?.pages ?? 0;
    return pageTypes.find((item: any) => item.type === type)?.count ?? 0;
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setTaskError(null);
    try {
      await api.updateWiki(4);
      setTaskView('pending');
      await mutate();
    } catch (error: any) {
      setTaskView('failed');
      setTaskError(error?.message || '更新知识库失败');
      await mutate();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProcess = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTaskError(null);
    try {
      await api.processWikiJobs(4);
      setTaskView('pending');
      await mutate();
    } catch (error: any) {
      setTaskView('failed');
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
      setTaskView('failed');
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
      setTaskView('pending');
      await mutate();
    } catch (error: any) {
      setTaskView('failed');
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

  if (isLoading) {
    return <div className="wiki-page-shell"><div className="wiki-loading">正在读取知识库...</div></div>;
  }

  if (error) {
    return (
      <div className="wiki-page-shell">
        <WikiHeader status={status} />
        <div className="wiki-empty">知识库加载失败，请确认已登录并且 API 服务可用。</div>
      </div>
    );
  }

  return (
    <div className="wiki-page-shell">
      <WikiHeader status={status} onUpdate={handleUpdate} isUpdating={isUpdating} />

      <section className="wiki-search-panel">
        <form className="wiki-search-form" onSubmit={handleSearch}>
          <SearchOutlined />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索 Wiki 页面、概念、来源文章..."
          />
          <button type="submit">搜索</button>
        </form>
        {searchQuery && (
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
        )}
      </section>

      <section className="wiki-dashboard">
        <StatusPill label="归档文章" value={status?.archived} />
        <StatusPill label="已编译" value={status?.indexed} />
        <StatusPill label="Wiki 页面" value={status?.pages} />
        <StatusPill label="处理中" value={status?.running_jobs || (status?.runner_active ? 1 : 0)} />
        <button type="button" className="wiki-status-button" onClick={() => setTaskView(taskView === 'pending' ? null : 'pending')}>
          <StatusPill label="待处理任务" value={status?.pending_jobs} />
        </button>
        <button type="button" className="wiki-status-button" onClick={() => setTaskView(taskView === 'failed' ? null : 'failed')}>
          <StatusPill label="失败任务" value={status?.failed_jobs} />
        </button>
      </section>

      {taskError && <div className="wiki-job-error">{taskError}</div>}

      {taskView === 'pending' && (
        <JobList
          title="待处理任务"
          jobs={pendingJobs}
          empty="当前没有待处理任务。"
          action={handleProcess}
          actionLabel="继续处理队列"
          isBusy={isProcessing}
        />
      )}
      {taskView === 'failed' && (
        <JobList
          title="失败任务"
          jobs={failedJobs}
          empty="当前没有失败任务。"
          action={handleRetry}
          actionLabel="重试失败任务"
          isBusy={isRetrying}
        />
      )}

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
          <div className="wiki-sidebar-note">{activeTypeMeta.help}</div>
          <div className="wiki-sidebar-title">状态摘要</div>
          <div className="wiki-sidebar-note">
            <div>最近更新：{formatDate(meta.last_updated_at || meta.lastUpdatedAt || meta.last_finished_at)}</div>
            <div>版本记录：{meta.versions ?? 0}</div>
            <div>模型：{meta.provider || 'default'} / {meta.model || 'default'}</div>
          </div>
          <div className="wiki-sidebar-title">维护</div>
          <button type="button" className="wiki-sidebar-item" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? '重试中' : '重试失败任务'}
          </button>
          <button type="button" className="wiki-sidebar-item wiki-sidebar-item-danger" onClick={() => setRebuildConfirmOpen(true)} disabled={isRebuildingAll}>
            {isRebuildingAll ? '重建中' : '全量重建 Wiki'}
          </button>
        </aside>

        <main className="wiki-main">
          <div className="wiki-section-heading">
            <div>
              <h2>{activeTypeMeta.label}</h2>
              <p>{activeTypeMeta.help}</p>
            </div>
            <button type="button" className="wiki-secondary-action" onClick={handleRefreshList} disabled={isRefreshing}>
              {isRefreshing ? <SyncOutlined spin /> : <ReloadOutlined />}
              {isRefreshing ? '刷新中' : '刷新列表'}
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="wiki-empty">
              <RobotOutlined />
              <strong>还没有 Wiki 页面</strong>
              <span>点击“更新知识库”，系统会读取当前归档文章并生成主题页。</span>
            </div>
          ) : (
            <div className="wiki-card-grid">
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
                    <span><BranchesOutlined /> {page.source_count ?? 0} 来源</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <section className="wiki-recent-articles">
            <div className="wiki-section-heading">
              <div>
                <h2>最近进入 Wiki 的文章</h2>
                <p>这些归档文章会作为 Wiki 页面和来源引用的原始资料。</p>
              </div>
            </div>
            {recentArticles.length === 0 ? (
              <div className="wiki-empty">还没有文章进入 Wiki。</div>
            ) : (
              <div className="wiki-recent-list">
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
        </main>
      </section>

      {rebuildConfirmOpen && (
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
    </div>
  );
}

function renderBlock(block: WikiBlock, index: number, sourcesById: Map<number, any>, onOpenSource: (id: number) => void) {
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
            <span>{item.text}</span>
            {item.sources?.length ? <small>来源 {item.sources.map((id) => sourcesById.get(id)?.title || `#${id}`).join('、')}</small> : null}
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
  const params = useParams<{ slug: string }>();
  const { openArticle } = useArticleContext();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { data, error, isLoading, mutate } = useSWR(slug ? `wiki:page:${slug}` : null, () => api.getWikiPage(slug), { revalidateOnFocus: false });

  if (isLoading) {
    return <div className="wiki-page-shell"><div className="wiki-loading">正在读取 Wiki 页面...</div></div>;
  }

  if (error || !data) {
    return <div className="wiki-page-shell"><div className="wiki-empty">这个 Wiki 页面暂时不存在。</div></div>;
  }

  const blocks = (data.blocks || []) as WikiBlock[];
  const sources = data.sources || [];
  const relatedPages = data.relatedPages || [];
  const sourcesById = new Map<number, any>(sources.map((source: any) => [source.id, source]));

  const handleRebuild = async () => {
    await api.rebuildWikiPage(data.id);
    await mutate();
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
            <button type="button" className="wiki-secondary-action" onClick={handleRebuild}>
              <ReloadOutlined /> 重建本页
            </button>
          </div>
          <div className="wiki-doc-body">
            {blocks.length ? blocks.map((block, index) => renderBlock(block, index, sourcesById, openArticle)) : <div className="wiki-empty">本页还没有生成内容。</div>}
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
                  <span>{pageTypeLabel(pageTypeOf(page))}</span>
                </Link>
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
        </aside>
      </section>
    </div>
  );
}
