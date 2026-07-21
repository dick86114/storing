'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloseOutlined, CopyOutlined, DeleteOutlined, FileTextOutlined, FolderOpenOutlined, HistoryOutlined, LinkOutlined, ReloadOutlined, SearchOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons';
import { api, type AdminAuditLog, type AdminManagedArticle, type AdminUser } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

const PAGE_SIZE = 20;

type LibraryView = 'inbox' | 'favorites' | 'archive';
type TimeRange = 'all' | '7d' | '30d' | '90d' | '365d';
type ConfirmationAction = 'regenerate' | 'delete';

const TIME_RANGE_DAYS: Record<Exclude<TimeRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

function collectedSinceFor(range: TimeRange) {
  if (range === 'all') return undefined;
  const date = new Date();
  date.setDate(date.getDate() - TIME_RANGE_DAYS[range]);
  return date.toISOString();
}

function sourceTypeInfo(value: string | null | undefined) {
  const sources: Record<string, { label: string; description: string }> = {
    legacy: { label: '历史导入', description: '旧版本数据迁移后保留的文章记录。' },
    web: { label: '网页采集', description: '由网页端采集流程保存。' },
    mcp: { label: 'MCP 采集', description: '由 MCP Client 发起并保存。' },
    agent: { label: '外部 Agent', description: '由外部 Agent 或自动化导入。' },
    system: { label: '系统任务', description: '由系统维护或自动化任务写入。' },
    'admin-copy': { label: '管理员副本', description: '管理员从其他用户文章库显式复制的副本。' },
  };
  return sources[value || ''] || { label: value || '未知来源', description: '未标记的历史来源类型。' };
}

function dateText(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

function roleLabel(role: AdminUser['role']) {
  return role === 'admin' ? '管理员' : role === 'service' ? '服务账号' : '普通用户';
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    library_viewed: '查看文章库',
    article_copied_to_admin: '复制到管理员收件箱',
    article_ai_regenerated: '重新生成 AI',
    article_metadata_deleted: '删除用户文章记录',
  };
  return labels[action] || action;
}

export function AdminLibraryContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [view, setView] = useState<LibraryView>('inbox');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<AdminManagedArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);
  const [actingArticleId, setActingArticleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ article: AdminManagedArticle; action: ConfirmationAction } | null>(null);

  const selectedUser = useMemo(() => users.find((item) => item.id === selectedUserId) || null, [selectedUserId, users]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadAudit = useCallback(async (targetUserId?: number | null) => {
    const data = await api.getAdminAuditLogs({ targetUserId: targetUserId || undefined, limit: 30 });
    setAuditLogs(data.logs);
  }, []);

  const loadUsers = useCallback(async () => {
    const data = await api.getAdminUsers();
    const params = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const requestedUserId = params ? Number(params.get('userId')) : null;
    const requestedView = params?.get('view');
    if (requestedView === 'inbox' || requestedView === 'favorites' || requestedView === 'archive') setView(requestedView);
    setUsers(data.users);
    setSelectedUserId((current) => {
      if (Number.isFinite(requestedUserId) && data.users.some((item) => item.id === requestedUserId)) return requestedUserId;
      return current && data.users.some((item) => item.id === current) ? current : (data.users[0]?.id ?? null);
    });
  }, []);

  const loadArticles = useCallback(async (targetUserId: number, nextPage = page, nextView = view, nextQuery = appliedQuery, nextTimeRange = timeRange) => {
    setArticleLoading(true);
    try {
      const data = await api.getAdminUserArticles(targetUserId, { view: nextView, q: nextQuery, collectedSince: collectedSinceFor(nextTimeRange), page: nextPage, perPage: PAGE_SIZE });
      setArticles(data.data);
      setTotal(data.total);
      setPage(data.page);
    } finally {
      setArticleLoading(false);
    }
  }, [appliedQuery, page, timeRange, view]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      await loadUsers();
      if (selectedUserId) {
        await Promise.all([
          loadArticles(selectedUserId, page, view, appliedQuery, timeRange),
          loadAudit(selectedUserId),
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载管理数据失败');
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, isAuthenticated, loadArticles, loadAudit, loadUsers, page, selectedUserId, timeRange, user?.role, view]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedUserId || !isAuthenticated || user?.role !== 'admin') return;
    loadArticles(selectedUserId, page, view, appliedQuery, timeRange).catch((err) => setError(err instanceof Error ? err.message : '加载文章库失败'));
    loadAudit(selectedUserId).catch((err) => setError(err instanceof Error ? err.message : '加载审计记录失败'));
  }, [appliedQuery, isAuthenticated, loadArticles, loadAudit, page, selectedUserId, timeRange, user?.role, view]);

  useEffect(() => {
    if (!pendingConfirmation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [pendingConfirmation]);

  const selectUser = (userId: number) => {
    setSelectedUserId(userId);
    setPage(1);
    setQuery('');
    setAppliedQuery('');
    setNotice(null);
    setError(null);
  };

  const runAction = async (article: AdminManagedArticle, action: 'copy' | 'regenerate' | 'delete') => {
    if (!selectedUserId) return;
    setActingArticleId(article.id);
    setError(null);
    setNotice(null);
    try {
      if (action === 'copy') {
        const result = await api.copyAdminUserArticleToMine(selectedUserId, article.id);
        setNotice(result.created ? '已复制到你的收件箱。' : '这篇文章已在你的收件箱中。');
      } else if (action === 'regenerate') {
        await api.regenerateAdminUserArticleAi(selectedUserId, article.id);
        setNotice('已在目标用户的数据空间中重新生成 AI 摘要与标签。');
      } else {
        await api.deleteAdminUserArticle(selectedUserId, article.id);
        setNotice('已删除该用户的文章记录；全局文章和其他用户数据未受影响。');
      }
      await Promise.all([loadArticles(selectedUserId, page, view, appliedQuery, timeRange), loadAudit(selectedUserId), loadUsers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '管理操作失败');
    } finally {
      setActingArticleId(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;
    const { article, action } = pendingConfirmation;
    setPendingConfirmation(null);
    await runAction(article, action);
  };

  const applyFilters = () => {
    setAppliedQuery(query.trim());
    setPage(1);
  };

  if (isLoading) return <div className="admin-library-loading">正在打开用户文章库…</div>;
  if (!isAuthenticated || user?.role !== 'admin') return <div className="admin-library-shell"><div className="mcp-empty-state"><FolderOpenOutlined /><h2>需要管理员权限</h2><p>用户文章库只对管理员开放，不会改变普通收件箱的个人隔离规则。</p></div></div>;
  if (loading) return <div className="admin-library-loading">正在加载用户文章库…</div>;

  return <div className="admin-library-shell">
    <header className="admin-library-header">
      <div><p className="mcp-kicker">系统管理 / 内容治理</p><h1>用户文章库</h1><p>跨用户处理集中在这里；你的个人收件箱仍只显示 admin 自己的数据。</p></div>
      <div className="mcp-header-actions"><Link href="/admin/users" className="mcp-btn mcp-btn-quiet"><UserOutlined /> 用户管理</Link><button type="button" className="mcp-btn mcp-btn-quiet" onClick={refresh}><ReloadOutlined /> 刷新</button></div>
    </header>

    {error && <div className="mcp-inline-alert is-error">{error}</div>}
    {notice && <div className="mcp-inline-alert is-ok">{notice}</div>}

    <div className="admin-library-content-grid">
      <section className="admin-library-panel admin-library-primary">
        <div className="admin-library-primary-head">
          <div><p className="mcp-kicker">文章管理</p><h2>{selectedUser?.username || '选择数据所有者'} <span>{total} 篇</span></h2></div>
          {selectedUser && <span className="admin-library-scope">{roleLabel(selectedUser.role)} · user_id={selectedUser.id}</span>}
        </div>

        <div className="admin-library-toolbar">
          <label><span>收录时间</span><select value={timeRange} onChange={(event) => { setTimeRange(event.target.value as TimeRange); setPage(1); }} aria-label="按收录时间筛选"><option value="all">全部时间</option><option value="7d">最近 7 天</option><option value="30d">最近 30 天</option><option value="90d">最近 90 天</option><option value="365d">最近一年</option></select></label>
          <label><span>内容状态</span><select value={view} onChange={(event) => { setView(event.target.value as LibraryView); setPage(1); }}><option value="inbox">收件箱</option><option value="favorites">收藏</option><option value="archive">归档</option></select></label>
          <label className="admin-library-search"><SearchOutlined /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyFilters(); }} placeholder="按标题或原文链接搜索" aria-label="搜索用户文章" /></label>
          <button type="button" className="mcp-btn mcp-btn-primary" onClick={applyFilters}><SearchOutlined /> 搜索</button>
        </div>

        {articleLoading ? <div className="admin-library-empty">正在加载文章…</div> : <div className="admin-library-article-list">
          {articles.map((article) => {
            const sourceInfo = sourceTypeInfo(article.source_type);
            return <article key={article.id} className="admin-library-article-card">
            {article.cover_image ? <span className="admin-library-article-cover" role="img" aria-label="文章封面" style={{ backgroundImage: `url(${article.cover_image})` }} /> : <span className="admin-library-article-placeholder"><FileTextOutlined /></span>}
            <div className="admin-library-article-content"><div className="admin-library-article-title"><h3>{article.title || '未命名文章'}</h3><span title={sourceInfo.description}>{sourceInfo.label}</span></div><p>{article.ai_summary || article.author || article.source || '暂无摘要或来源信息'}</p><small>{article.client_name ? `MCP：${article.client_name} · ` : ''}收录于 {dateText(article.created_at)} · {article.is_archived ? '已归档' : article.is_favorited ? '已收藏' : '收件箱'}</small></div>
            <div className="admin-library-article-actions">
              {article.original_url && <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => window.open(article.original_url!, '_blank', 'noopener,noreferrer')}><LinkOutlined /> 原文</button>}
              <button type="button" className="mcp-btn mcp-btn-quiet" disabled={actingArticleId === article.id} onClick={() => runAction(article, 'copy')}><CopyOutlined /> 复制到我的收件箱</button>
              <button type="button" className="mcp-btn mcp-btn-quiet" disabled={actingArticleId === article.id} onClick={() => setPendingConfirmation({ article, action: 'regenerate' })}><SyncOutlined /> 重建 AI</button>
              <button type="button" className="mcp-btn mcp-btn-danger" disabled={actingArticleId === article.id} onClick={() => setPendingConfirmation({ article, action: 'delete' })}><DeleteOutlined /> 删除该用户记录</button>
            </div>
          </article>;
          })}
          {articles.length === 0 && <div className="admin-library-empty">这个筛选条件下没有文章。</div>}
        </div>}
        <nav className="admin-library-pagination" aria-label="用户文章分页"><button type="button" className="mcp-btn mcp-btn-quiet" disabled={articleLoading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><span>第 {page} / {totalPages} 页</span><button type="button" className="mcp-btn mcp-btn-quiet" disabled={articleLoading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button></nav>
      </section>

      <section className="admin-library-panel admin-library-audit-panel">
        <div className="admin-library-panel-head"><div><p className="mcp-kicker">审计记录</p><h2><HistoryOutlined /> 最近管理操作</h2></div><p>只记录跨用户的关键变更，方便追溯。</p></div>
        <div className="admin-library-audit-list">{auditLogs.map((log) => <div key={log.id}><div><strong>{actionLabel(log.action)}</strong><span>{dateText(log.created_at)}</span></div><p>{log.actor_username || `用户 #${log.actor_user_id}`} → {log.target_username || (log.target_user_id ? `用户 #${log.target_user_id}` : '系统')}{log.article_title ? ` · ${log.article_title}` : log.article_id ? ` · 文章 #${log.article_id}` : ''}</p></div>)}{auditLogs.length === 0 && <div className="admin-library-empty">暂无管理审计记录。</div>}</div>
      </section>
    {pendingConfirmation && <div className="admin-library-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingConfirmation(null); }}>
      <section className="admin-library-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="admin-library-confirm-title">
        <header><div><p className="mcp-kicker">管理员确认</p><h2 id="admin-library-confirm-title">{pendingConfirmation.action === 'regenerate' ? '重新生成 AI 摘要、分类和标签' : '确认删除该用户记录'}</h2></div><button type="button" className="admin-library-modal-close" onClick={() => setPendingConfirmation(null)} aria-label="关闭"><CloseOutlined /></button></header>
        <div className="admin-library-confirm-content">
          <strong>{pendingConfirmation.article.title || '未命名文章'}</strong>
          {pendingConfirmation.action === 'regenerate' ? <p>将基于当前已保存的正文，为 <b>{selectedUser?.username || '目标用户'}</b> 重新生成 AI 摘要、分类和标签。不会重新抓取原文，也不会改变文章归属、收件箱、收藏或归档状态。</p> : <p>将从 <b>{selectedUser?.username || '目标用户'}</b> 的文章库中删除这条记录。不会删除全局文章内容，也不会影响其他用户拥有的同一篇文章。</p>}
        </div>
        <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setPendingConfirmation(null)}>取消</button><button type="button" className={pendingConfirmation.action === 'delete' ? 'mcp-btn mcp-btn-danger' : 'mcp-btn mcp-btn-primary'} onClick={confirmPendingAction}>{pendingConfirmation.action === 'delete' ? '确认删除' : '开始重建'}</button></footer>
      </section>
    </div>}
    </div>
  </div>;
}
