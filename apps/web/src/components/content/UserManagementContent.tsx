'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppstoreOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FolderOutlined, HeartOutlined, KeyOutlined, LockOutlined, PlusOutlined, ReloadOutlined, SafetyOutlined, SearchOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons';
import { api, type AdminBootstrapStatus, type AdminUser, type AdminUserActivity } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

type UserRole = AdminUser['role'];
type UserStatus = AdminUser['status'];

const EMPTY_CREATE_FORM = { username: '', password: '', role: 'user' as UserRole };
const ACTIVITY_PAGE_SIZE = 3;

function dateText(value: string | null) {
  if (!value) return '从未';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

function roleLabel(role: UserRole) {
  return role === 'admin' ? '管理员' : role === 'service' ? '服务账号' : '普通用户';
}

function transportLabel(transport: string) {
  if (transport === 'streamable-http') return 'Streamable HTTP';
  if (transport === 'stdio') return '本地 stdio';
  if (transport === 'direct-api') return '直接 API';
  return '历史记录（未记录方式）';
}

function roleDescription(role: UserRole) {
  return role === 'admin'
    ? '可访问系统级管理功能，管理员账号不能被禁用或降级。'
    : role === 'service'
      ? '用于 MCP、自动化任务或系统集成；可拥有连接，但不代表真人用户。'
      : '用于真人用户登录、管理自己的收集内容与 MCP 连接。';
}

export function UserManagementContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [bootstrap, setBootstrap] = useState<AdminBootstrapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'all' | UserRole>('all');
  const [status, setStatus] = useState<'all' | UserStatus>('all');
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');
  const [activityUser, setActivityUser] = useState<AdminUser | null>(null);
  const [activity, setActivity] = useState<AdminUserActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityOffset, setActivityOffset] = useState(0);
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'user' as UserRole, status: 'active' as UserStatus });
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isAdminMaintenanceOpen, setAdminMaintenanceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const [userData, bootstrapData] = await Promise.all([api.getAdminUsers(), api.getAdminBootstrapStatus()]);
      setUsers(userData.users);
      setBootstrap(bootstrapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户数据失败');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const hasOpenModal = isCreateModalOpen || Boolean(editingUser) || Boolean(deletingUser) || Boolean(activityUser) || isAdminMaintenanceOpen;
    if (!hasOpenModal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [activityUser, deletingUser, editingUser, isAdminMaintenanceOpen, isCreateModalOpen]);

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesQuery = !query.trim() || item.username.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (role === 'all' || item.role === role) && (status === 'all' || item.status === status);
  }), [users, query, role, status]);

  const metrics = useMemo(() => ({
    active: users.filter((item) => item.status === 'active').length,
    mcpUsers: users.filter((item) => item.mcp_client_count > 0).length,
    mcpRequests: users.reduce((sum, item) => sum + item.mcp_request_count, 0),
  }), [users]);

  const activityPage = Math.floor(activityOffset / ACTIVITY_PAGE_SIZE) + 1;
  const activityPageCount = Math.max(1, Math.ceil((activity?.logs_total ?? 0) / ACTIVITY_PAGE_SIZE));

  function openCreateModal() {
    setError(null);
    setNotice(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateModalOpen(true);
  }

  function openEditModal(item: AdminUser) {
    setError(null);
    setNotice(null);
    setEditingUser(item);
    setEditForm({ username: item.username, password: '', role: item.role, status: item.status });
  }

  function openDeleteModal(item: AdminUser) {
    if (item.role === 'admin') {
      setError('管理员账号受保护，不能删除。');
      return;
    }
    setError(null);
    setNotice(null);
    setDeleteConfirmUsername('');
    setDeletingUser(item);
  }

  function closeDeleteModal() {
    if (saving) return;
    setDeletingUser(null);
    setDeleteConfirmUsername('');
  }

  async function loadActivity(item: AdminUser, offset: number) {
    setActivityLoading(true);
    setError(null);
    try {
      setActivity(await api.getAdminUserActivity(item.id, ACTIVITY_PAGE_SIZE, offset));
      setActivityOffset(offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户活动失败');
    } finally {
      setActivityLoading(false);
    }
  }

  async function openActivityModal(item: AdminUser) {
    setActivityUser(item);
    setActivity(null);
    await loadActivity(item, 0);
  }

  function closeActivityModal() {
    setActivityUser(null);
    setActivity(null);
    setActivityOffset(0);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.createAdminUser({ ...createForm, status: 'active' });
      setCreateModalOpen(false);
      setNotice('用户已创建。');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建用户失败');
    } finally {
      setSaving(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const input = {
        username: editForm.username,
        role: editForm.role,
        status: editForm.status,
        ...(editForm.password ? { password: editForm.password } : {}),
      };
      await api.updateAdminUser(editingUser.id, input);
      setEditingUser(null);
      setNotice('用户信息已更新。');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新用户失败');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletingUser) return;
    if (deleteConfirmUsername !== deletingUser.username) {
      setError('请输入完整用户名以确认删除。');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.deleteAdminUser(deletingUser.id, deleteConfirmUsername);
      setDeletingUser(null);
      setDeleteConfirmUsername('');
      setNotice(`用户「${result.user.username}」已删除；已清理 ${result.cleanup.deleted_metadata_count} 条私有资料、${result.cleanup.deleted_mcp_client_count} 个 MCP 连接和 ${result.cleanup.deleted_active_session_count} 个有效会话。`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除用户失败');
    } finally {
      setSaving(false);
    }
  }

  function openUserLibrary(userId: number, view: 'inbox' | 'favorites' | 'archive' = 'inbox') {
    router.push(`/admin/library?userId=${userId}&view=${view}`);
  }

  async function toggleUser(item: AdminUser) {
    if (item.role === 'admin') {
      setError('管理员账号受保护，不能被禁用。');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateAdminUser(item.id, { status: item.status === 'active' ? 'disabled' : 'active' });
      setNotice(item.status === 'active' ? '用户已禁用。' : '用户已启用。');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新用户失败');
    } finally {
      setSaving(false);
    }
  }

  async function syncConfiguredAdminPassword() {
    if (!bootstrap) return;
    const confirmed = window.confirm(`将使用当前部署环境的 ADMIN_PASSWORD 重置管理员「${bootstrap.configured_username}」的密码，并确保该账号启用。此操作会立即使旧密码失效。`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.resetConfiguredAdminPassword(bootstrap.configured_username);
      setNotice(`${result.configured_username} 的环境密码已同步。`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步管理员密码失败');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="user-admin-loading">正在打开用户管理…</div>;
  if (!isAuthenticated || user?.role !== 'admin') return <div className="user-admin-shell"><div className="mcp-empty-state"><LockOutlined /><h2>需要管理员权限</h2><p>用户管理是系统级管理模块，仅管理员可访问。</p></div></div>;
  if (loading) return <div className="user-admin-loading">正在加载用户数据…</div>;

  return <div className="user-admin-shell">
    <header className="user-admin-header">
      <div>
        <p className="mcp-kicker">系统管理</p>
        <h1>用户管理</h1>
        <p>管理系统身份、角色和状态，查看每位用户的内容空间与 MCP 使用情况。</p>
      </div>
      <div className="mcp-header-actions">
        <Link href="/admin/mcp" className="mcp-btn mcp-btn-quiet">MCP 运营控制台</Link>
        <button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setAdminMaintenanceOpen(true)}><SafetyOutlined /> 管理员维护</button>
        <button type="button" className="mcp-btn mcp-btn-quiet" onClick={refresh}><ReloadOutlined /> 刷新</button>
      </div>
    </header>

    {error && <div className="mcp-inline-alert is-error">{error}</div>}
    {notice && <div className="mcp-inline-alert is-ok">{notice}</div>}

    <section className="user-admin-metrics">
      <div><span>注册用户</span><strong>{users.length}</strong><small>系统全部身份</small></div>
      <div><span>启用用户</span><strong>{metrics.active}</strong><small>{users.length - metrics.active} 个已禁用</small></div>
      <div><span>MCP 用户</span><strong>{metrics.mcpUsers}</strong><small>至少有一个连接</small></div>
      <div><span>MCP 调用</span><strong>{metrics.mcpRequests}</strong><small>历史审计记录</small></div>
    </section>

    <section className="user-admin-directory">
      <div className="user-admin-directory-head">
        <div><p className="mcp-kicker">用户目录</p><h2>全部用户 <span>{filteredUsers.length}</span></h2></div>
        <button type="button" className="mcp-btn mcp-btn-primary" onClick={openCreateModal}><PlusOutlined /> 新建用户</button>
      </div>
      <div className="user-admin-toolbar">
        <label className="user-admin-search"><SearchOutlined /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户名" aria-label="搜索用户名" /></label>
        <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} aria-label="按角色筛选"><option value="all">全部角色</option><option value="admin">管理员</option><option value="user">普通用户</option><option value="service">服务账号</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="按状态筛选"><option value="all">全部状态</option><option value="active">启用</option><option value="disabled">禁用</option></select>
      </div>

      <div className="user-admin-list">
        {filteredUsers.map((item) => {
          const protectedAdmin = item.role === 'admin';
          return <article className="user-admin-card user-admin-card--library-link" key={item.id} role="link" tabIndex={0} onClick={() => openUserLibrary(item.id)} onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openUserLibrary(item.id);
            }
          }}>
            <div className="user-admin-card-head">
              <div className="user-admin-identity">
                <span className="user-admin-avatar"><UserOutlined /></span>
                <div><div className="user-admin-name"><h3>{item.username}</h3><span className={`user-admin-role-pill user-admin-role-pill--${item.role}`}>{roleLabel(item.role)}</span><i className={item.status === 'active' ? 'is-active' : 'is-disabled'}>{item.status === 'active' ? '启用' : '禁用'}</i></div><p>注册于 {dateText(item.created_at)}</p><p className="user-admin-session">最后登录 {dateText(item.last_login_at)} · 最近 MCP 调用 {dateText(item.last_mcp_used_at)}</p></div>
              </div>
              <div className="user-admin-actions">
                <button type="button" className="user-admin-edit-button" aria-label="编辑用户" title="编辑用户" disabled={saving} onClick={(event) => { event.stopPropagation(); openEditModal(item); }}><EditOutlined /></button>
                {protectedAdmin ? <span className="user-admin-protected"><SafetyOutlined /> 管理员受保护</span> : <>
                  <button type="button" className="mcp-btn mcp-btn-quiet" disabled={saving} onClick={(event) => { event.stopPropagation(); toggleUser(item); }}>{item.status === 'active' ? '禁用' : '启用'}</button>
                  <button type="button" className="mcp-btn mcp-btn-danger" disabled={saving} onClick={(event) => { event.stopPropagation(); openDeleteModal(item); }}><DeleteOutlined /> 删除</button>
                </>}
              </div>
            </div>
            <div className="user-admin-usage">
              <button type="button" className="user-admin-usage-button" onClick={(event) => { event.stopPropagation(); openUserLibrary(item.id, 'inbox'); }}><AppstoreOutlined /><span>收件箱</span><strong>{item.inbox_count}</strong><small>打开收件箱视图</small></button>
              <button type="button" className="user-admin-usage-button" onClick={(event) => { event.stopPropagation(); openUserLibrary(item.id, 'archive'); }}><FolderOutlined /><span>归档</span><strong>{item.archive_count}</strong><small>打开归档视图</small></button>
              <button type="button" className="user-admin-usage-button" onClick={(event) => { event.stopPropagation(); openUserLibrary(item.id, 'favorites'); }}><HeartOutlined /><span>收藏</span><strong>{item.favorite_count}</strong><small>打开收藏视图</small></button>
              <button type="button" className="user-admin-usage-button" onClick={(event) => { event.stopPropagation(); openActivityModal(item); }}><KeyOutlined /><span>MCP 连接</span><strong>共 {item.mcp_client_count} 个</strong><small>{item.mcp_client_count === 0 ? '暂无连接' : item.active_mcp_client_count === item.mcp_client_count ? '全部已启用' : `${item.active_mcp_client_count} 个已启用`}</small></button>
              <button type="button" className="user-admin-usage-button" onClick={(event) => { event.stopPropagation(); openActivityModal(item); }}><SafetyOutlined /><span>MCP 调用</span><strong>{item.mcp_request_count} 次</strong><small>{item.last_mcp_used_at ? `最近 ${dateText(item.last_mcp_used_at)}` : '暂无调用记录'}</small></button>
            </div>
          </article>;
        })}
        {filteredUsers.length === 0 && <div className="mcp-table-empty">没有匹配的用户。</div>}
      </div>
    </section>

    {isCreateModalOpen && <div className="user-admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateModalOpen(false); }}>
      <form className="user-admin-modal" onSubmit={createUser}>
        <header><div><p className="mcp-kicker">新建用户</p><h2>创建系统身份</h2></div><button type="button" className="user-admin-modal-close" onClick={() => setCreateModalOpen(false)} aria-label="关闭"><CloseOutlined /></button></header>
        <p className="user-admin-modal-intro">创建后，普通用户可登录并管理个人内容；服务账号适合 MCP 与自动化集成。</p>
        <div className="user-admin-modal-fields">
          <label>用户名<input autoFocus placeholder="例如：acme-agent" value={createForm.username} onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })} required /></label>
          <label>初始密码<input type="password" placeholder="至少 4 个字符" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} required /></label>
          <label>账号类型<select value={createForm.role} onChange={(event) => setCreateForm({ ...createForm, role: event.target.value as UserRole })}><option value="user">普通用户</option><option value="service">服务账号</option><option value="admin">管理员</option></select></label>
        </div>
        <p className="user-admin-role-hint">{roleDescription(createForm.role)}</p>
        <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setCreateModalOpen(false)}>取消</button><button type="submit" className="mcp-btn mcp-btn-primary" disabled={saving}><PlusOutlined /> 创建用户</button></footer>
      </form>
    </div>}

    {editingUser && <div className="user-admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingUser(null); }}>
      <form className="user-admin-modal" onSubmit={saveUser}>
        <header><div><p className="mcp-kicker">编辑用户</p><h2>{editingUser.username}</h2></div><button type="button" className="user-admin-modal-close" onClick={() => setEditingUser(null)} aria-label="关闭"><CloseOutlined /></button></header>
        <p className="user-admin-modal-intro">可修改用户名、账号类型、状态并重置密码。新密码留空时不会改动现有密码。</p>
        <div className="user-admin-modal-fields">
          <label>用户名<input value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} required /></label>
          <label>重置密码（可选）<input type="password" placeholder="留空则不修改" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /></label>
          <label>账号类型<select value={editForm.role} disabled={editingUser.role === 'admin'} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}><option value="user">普通用户</option><option value="service">服务账号</option><option value="admin">管理员</option></select></label>
          <label>账号状态<select value={editForm.status} disabled={editingUser.role === 'admin'} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as UserStatus })}><option value="active">启用</option><option value="disabled">禁用</option></select></label>
        </div>
        <p className="user-admin-role-hint">{editingUser.role === 'admin' ? '管理员账号受系统保护：不能被禁用或降级，但可由管理员重置密码。' : roleDescription(editForm.role)}</p>
        <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setEditingUser(null)}>取消</button><button type="submit" className="mcp-btn mcp-btn-primary" disabled={saving}><EditOutlined /> 保存修改</button></footer>
      </form>
    </div>}

    {deletingUser && <div className="user-admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteModal(); }}>
      <section className="user-admin-modal user-admin-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
        <header><div><p className="mcp-kicker">不可逆操作</p><h2 id="delete-user-title">删除用户</h2></div><button type="button" className="user-admin-modal-close" onClick={closeDeleteModal} aria-label="关闭" disabled={saving}><CloseOutlined /></button></header>
        <form onSubmit={deleteUser}>
          <p className="user-admin-modal-intro">将永久删除用户「{deletingUser.username}」及其私有资料库、MCP 连接和所有登录会话。采集与 MCP 请求历史会保留为无归属记录；全局文章不会删除。</p>
          <div className="user-admin-delete-warning"><SafetyOutlined /><span>此操作无法撤销。请确认你已备份需要保留的个人资料。</span></div>
          <div className="user-admin-modal-fields"><label>输入用户名 <strong>{deletingUser.username}</strong> 以确认<input value={deleteConfirmUsername} onChange={(event) => setDeleteConfirmUsername(event.target.value)} autoComplete="off" placeholder={deletingUser.username} disabled={saving} aria-label="输入用户名确认删除" /></label></div>
          <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={closeDeleteModal} disabled={saving}>取消</button><button type="submit" className="mcp-btn mcp-btn-danger" disabled={saving || deleteConfirmUsername !== deletingUser.username}><DeleteOutlined /> 确认删除</button></footer>
        </form>
      </section>
    </div>}

    {activityUser && <div className="user-admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeActivityModal(); }}>
      <section className="user-admin-modal user-admin-activity-modal" role="dialog" aria-modal="true" aria-label={`${activityUser.username} 用户活动`}>
        <header><div><p className="mcp-kicker">用户活动</p><h2>{activityUser.username}</h2></div><button type="button" className="user-admin-modal-close" onClick={closeActivityModal} aria-label="关闭"><CloseOutlined /></button></header>
        <div className="user-admin-activity-content">
          <p className="user-admin-modal-intro">查看最近登录、MCP 连接状态与最近调用记录。</p>
          <div className="user-admin-activity-summary"><div><span>最后登录</span><strong>{dateText(activityUser.last_login_at)}</strong></div><div><span>最近 MCP 调用</span><strong>{dateText(activityUser.last_mcp_used_at)}</strong></div><div><span>MCP 连接</span><strong>{activityUser.mcp_client_count} 个</strong></div><div><span>MCP 调用</span><strong>{activityUser.mcp_request_count} 次</strong></div></div>
          {activityLoading ? <div className="user-admin-activity-loading">正在加载活动记录…</div> : <>
            <section className="user-admin-activity-section"><div className="user-admin-activity-head"><h3>MCP 连接</h3><span>{activity?.clients.length ?? 0} 个</span></div><div className="user-admin-client-list">{activity?.clients.length ? activity.clients.map((client) => <div key={client.id}><div><strong>{client.name}</strong><span className={client.enabled ? 'is-active' : 'is-disabled'}>{client.enabled ? '已启用' : '已禁用'}</span></div><small>最后使用 {dateText(client.last_used_at)} · {client.scopes.length} 个权限</small></div>) : <p>该用户还没有 MCP 连接。</p>}</div></section>
            <section className="user-admin-activity-section"><div className="user-admin-activity-head"><h3>最近 MCP 调用</h3><span>{activity?.logs_total ?? 0} 条</span></div><div className="user-admin-log-list">{activity?.logs.length ? activity.logs.map((log) => <div key={log.id}><div><strong>{log.tool_name}</strong><span className={log.status === 'success' ? 'is-success' : 'is-error'}>{log.status}</span></div><small><b>调用方式：{transportLabel(log.transport)}</b> · {dateText(log.created_at)} · {log.client_name || '未知连接'}{log.request_method && log.request_path ? ` · ${log.request_method} ${log.request_path}` : ''}{log.duration_ms ? ` · ${log.duration_ms}ms` : ''}{log.error_code ? ` · ${log.error_code}` : ''}{log.client_agent ? ` · ${log.client_agent}` : ''}</small></div>) : <p>该用户暂无 MCP 调用记录。</p>}</div>{(activity?.logs_total ?? 0) > ACTIVITY_PAGE_SIZE && <nav className="user-admin-pagination" aria-label="MCP 调用分页"><button type="button" className="mcp-btn mcp-btn-quiet" disabled={activityLoading || activityOffset === 0} onClick={() => loadActivity(activityUser, Math.max(0, activityOffset - ACTIVITY_PAGE_SIZE))}>上一页</button><span>第 {activityPage} / {activityPageCount} 页</span><button type="button" className="mcp-btn mcp-btn-quiet" disabled={activityLoading || activityOffset + ACTIVITY_PAGE_SIZE >= (activity?.logs_total ?? 0)} onClick={() => loadActivity(activityUser, activityOffset + ACTIVITY_PAGE_SIZE)}>下一页</button></nav>}</section>
          </>}
        </div>
        <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={closeActivityModal}>关闭</button></footer>
      </section>
    </div>}

    {isAdminMaintenanceOpen && <div className="user-admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminMaintenanceOpen(false); }}>
      <section className="user-admin-modal">
        <header><div><p className="mcp-kicker">管理员维护</p><h2>{bootstrap?.configured_username ?? '恢复管理员'}</h2></div><button type="button" className="user-admin-modal-close" onClick={() => setAdminMaintenanceOpen(false)} aria-label="关闭"><CloseOutlined /></button></header>
        <p className="user-admin-modal-intro">启动配置指定的恢复管理员。服务启动会确保账号存在且启用，但不会自动覆盖数据库中的密码。</p>
        <div className="user-admin-maintenance-status"><span className={bootstrap?.configured_password_matches ? 'is-match' : 'is-mismatch'}>{bootstrap?.configured_password_matches ? '环境密码已同步' : '环境密码未同步'}</span><p>{bootstrap?.configured_password_matches ? '数据库凭据与当前 ADMIN_PASSWORD 一致。' : '请确认当前部署环境的 ADMIN_PASSWORD 后，再执行同步。同步会立即使旧密码失效。'}</p></div>
        <footer><button type="button" className="mcp-btn mcp-btn-quiet" onClick={() => setAdminMaintenanceOpen(false)}>关闭</button><button type="button" className="mcp-btn mcp-btn-primary" disabled={saving || !bootstrap} onClick={syncConfiguredAdminPassword}><SyncOutlined /> 同步环境密码</button></footer>
      </section>
    </div>}
  </div>;
}
