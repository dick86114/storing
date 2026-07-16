'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRightOutlined, CheckOutlined, CopyOutlined, DeleteOutlined, KeyOutlined, LockOutlined, PlusOutlined, ReloadOutlined, SafetyOutlined, SettingOutlined, ThunderboltOutlined, UserOutlined } from '@ant-design/icons';
import { api, type AdminUser, type McpClient, type McpRequestLog, type UpdateMcpClientInput, type UpdateMyMcpClientInput } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthContext';

const READONLY_SCOPES = ['summary:create', 'job:read:self'];
const FULL_SCOPES = ['summary:create', 'job:read:self', 'collect:create', 'inbox:write'];
const MCP_PRESETS = [
  { key: 'readonly', scopes: READONLY_SCOPES, title: '只读摘要', description: '让 Agent 给你总结网页内容，不写入收件箱。', icon: ThunderboltOutlined },
  { key: 'full', scopes: FULL_SCOPES, title: '摘要+入库', description: '既能总结网页，也能让 Agent 把文章收藏到你的收件箱。', icon: PlusOutlined },
];
const DEFAULT_SCOPES = READONLY_SCOPES;
type WorkspaceTab = 'overview' | 'guide' | 'logs';
type KeyResult = { title: string; clientName: string; apiKey: string; scopes: string[] };
type FormState = { name: string; scopes: string[]; rateLimitPerMinute: string; rateLimitPerDay: string; concurrentCollectLimit: string };

type AdminTab = 'clients' | 'defaults' | 'logs';

function freshForm(): FormState {
  return { name: '', scopes: DEFAULT_SCOPES, rateLimitPerMinute: '20', rateLimitPerDay: '500', concurrentCollectLimit: '3' };
}

function numOrNull(value: string) {
  const parsed = Number(value.trim());
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function dateText(value: string | null) {
  if (!value) return '从未使用';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
}

function statusText(status: string) {
  if (status === 'success') return '成功';
  if (status === 'error') return '失败';
  if (status === 'rate_limited') return '已限流';
  return status;
}

function remoteMcpUrl() {
  if (process.env.NEXT_PUBLIC_MCP_REMOTE_URL) return process.env.NEXT_PUBLIC_MCP_REMOTE_URL;
  if (typeof window !== 'undefined') return `${window.location.origin}/mcp`;
  return 'https://your-storing-domain.example/mcp';
}

function configSnippet(apiKey: string) {
  return JSON.stringify({
    mcpServers: {
      storing: {
        url: remoteMcpUrl(),
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    },
  }, null, 2);
}

function ApiKeyReveal({ result, onClose }: { result: KeyResult; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  };
  const json = configSnippet(result.apiKey);
  return (
    <div className="mcp-reveal-overlay" role="dialog" aria-modal="true" aria-label="MCP API Key">
      <div className="mcp-reveal-card">
        <div className="mcp-reveal-icon"><KeyOutlined /></div>
        <p className="mcp-kicker">只显示这一次</p>
        <h2>{result.title}</h2>
        <p className="mcp-muted">{result.clientName} 已创建。请立即保存 API Key；系统不会再次显示完整内容。</p>
        <div className="mcp-key-box"><code>{result.apiKey}</code><button type="button" onClick={() => copy(result.apiKey, 'key')}><CopyOutlined /> {copied === 'key' ? '已复制' : '复制 Key'}</button></div>
        <div className="mcp-reveal-meta">已启用权限：{result.scopes.join(' · ')}</div>
        <div className="mcp-reveal-section"><div className="mcp-reveal-section-title"><span>Streamable HTTP 远程配置（推荐）</span><button type="button" onClick={() => copy(json, 'json')}><CopyOutlined /> {copied === 'json' ? '已复制' : '复制 JSON'}</button></div><pre>{json}</pre></div>
        <div className="mcp-reveal-actions"><button type="button" className="mcp-btn mcp-btn-primary" onClick={onClose}>我已保存，继续</button></div>
      </div>
    </div>
  );
}

function ScopePicker({ scopes, onChange }: { scopes: string[]; onChange: (scopes: string[]) => void }) {
  const selectedKey = scopes.length === FULL_SCOPES.length && FULL_SCOPES.every((s) => scopes.includes(s)) ? 'full' : 'readonly';
  const selectPreset = (key: string) => {
    const preset = MCP_PRESETS.find((p) => p.key === key);
    if (preset) onChange(preset.scopes);
  };
  return <div className="mcp-preset-picker">{MCP_PRESETS.map(({ key, title, description, icon: Icon }) => {
    const checked = key === selectedKey;
    return <label key={key} className={`mcp-preset-option${checked ? ' is-selected' : ''}`}>
      <input className="mcp-visually-hidden" type="radio" name="mcp-preset" checked={checked} onChange={() => selectPreset(key)} />
      <span className="mcp-preset-check" aria-hidden="true">{checked && <CheckOutlined />}</span>
      <span className="mcp-preset-icon"><Icon /></span>
      <span className="mcp-preset-content"><strong>{title}</strong><small>{description}</small></span>
    </label>;
  })}</div>;
}

function ClientStatus({ enabled }: { enabled: boolean }) {
  return <span className={`mcp-status-pill ${enabled ? 'is-on' : 'is-off'}`}><i />{enabled ? '运行中' : '已暂停'}</span>;
}

function ClientCard({ client, onToggle, onRotate, onDelete }: { client: McpClient; onToggle: () => void; onRotate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <article className={`mcp-connection-card${open ? ' is-open' : ''}`}>
    <div className="mcp-connection-main">
      <div className="mcp-connection-mark"><KeyOutlined /></div>
      <div className="mcp-connection-copy"><div className="mcp-connection-name"><h3>{client.name}</h3><ClientStatus enabled={client.enabled} /></div><p>创建于 {dateText(client.created_at)} · {client.last_used_at ? `最近使用 ${dateText(client.last_used_at)}` : '还没有调用记录'}</p></div>
      <button type="button" className="mcp-chevron" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '收起' : '详情'} <ArrowRightOutlined /></button>
    </div>
    {open && <div className="mcp-connection-detail"><div className="mcp-detail-grid"><div><span>权限</span><strong>{client.scopes.length ? client.scopes.join(' · ') : '未配置'}</strong></div><div><span>频率限制</span><strong>{client.rate_limit_per_minute ?? '不限'} / 分钟 · {client.rate_limit_per_day ?? '不限'} / 天</strong></div><div><span>并发采集</span><strong>{client.concurrent_collect_limit ?? '不限'} 个任务</strong></div></div><div className="mcp-connection-actions"><button type="button" className="mcp-btn mcp-btn-quiet" onClick={onToggle}>{client.enabled ? '暂停连接' : '恢复连接'}</button><button type="button" className="mcp-btn mcp-btn-quiet" onClick={onRotate}><KeyOutlined /> 轮换 Key</button><button type="button" className="mcp-btn mcp-btn-danger" onClick={onDelete}><DeleteOutlined /> 删除</button></div></div>}
  </article>;
}

function CreateConnectionPanel({ saving, onSubmit, form, setForm, onCancel, ownerSelector, allowLimitEditing = false, readOnlyLimits }: { saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; form: FormState; setForm: (next: FormState) => void; onCancel?: () => void; ownerSelector?: ReactNode; allowLimitEditing?: boolean; readOnlyLimits?: { rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number } }) {
  return <form className="mcp-create-panel" onSubmit={onSubmit}>
    <div className="mcp-panel-heading"><div><p className="mcp-kicker">新连接</p><h2>创建一个 MCP 连接</h2><p className="mcp-muted">每个连接对应一个独立 API Key。可以为不同的 Agent 分开管理。</p></div>{onCancel && <button type="button" className="mcp-icon-btn" onClick={onCancel}>×</button>}</div>
    {ownerSelector}
    <label className="mcp-field"><span>连接名称</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：我的 Codex" required /></label>
    <div className="mcp-field"><span>权限级别</span><ScopePicker scopes={form.scopes} onChange={(scopes) => setForm({ ...form, scopes })} /></div>
    {allowLimitEditing ? <div className="mcp-limits"><label className="mcp-field"><span>每分钟调用</span><input inputMode="numeric" value={form.rateLimitPerMinute} onChange={(e) => setForm({ ...form, rateLimitPerMinute: e.target.value })} /></label><label className="mcp-field"><span>每天调用</span><input inputMode="numeric" value={form.rateLimitPerDay} onChange={(e) => setForm({ ...form, rateLimitPerDay: e.target.value })} /></label><label className="mcp-field"><span>并发采集</span><input inputMode="numeric" value={form.concurrentCollectLimit} onChange={(e) => setForm({ ...form, concurrentCollectLimit: e.target.value })} /></label></div> : <div className="mcp-plan-limits"><div className="mcp-plan-limits-head"><SafetyOutlined /><span><strong>平台基础配额</strong><small>调用配额由平台统一管理，用户不能自行提高。</small></span></div><div className="mcp-plan-limit-grid"><div><strong>{readOnlyLimits?.rate_limit_per_minute ?? 20}</strong><span>次 / 分钟</span></div><div><strong>{readOnlyLimits?.rate_limit_per_day ?? 500}</strong><span>次 / 天</span></div><div><strong>{readOnlyLimits?.concurrent_collect_limit ?? 3}</strong><span>并发采集</span></div></div></div>}
    <div className="mcp-form-actions"><button type="submit" className="mcp-btn mcp-btn-primary" disabled={saving || form.scopes.length === 0}>{saving ? '创建中…' : '创建连接并生成 Key'}</button>{onCancel && <button type="button" className="mcp-btn mcp-btn-quiet" onClick={onCancel}>取消</button>}</div>
  </form>;
}

export function McpSettingsContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [clients, setClients] = useState<McpClient[]>([]);
  const [logs, setLogs] = useState<McpRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(freshForm);
  const [keyResult, setKeyResult] = useState<KeyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selfLimits, setSelfLimits] = useState({ rate_limit_per_minute: 20, rate_limit_per_day: 500, concurrent_collect_limit: 3 });

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true); setError(null);
    try { const [clientData, logData, limitData] = await Promise.all([api.getMyMcpClients(), api.getMyMcpRequestLogs(), api.getMyMcpLimits()]); setClients(clientData.clients); setLogs(logData.logs); setSelfLimits(limitData); } catch (err) { setError(err instanceof Error ? err.message : '加载 MCP 连接失败'); } finally { setLoading(false); }
  }, [isAuthenticated]);
  useEffect(() => { refresh(); }, [refresh]);

  async function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    try { const result = await api.createMyMcpClient({ name: form.name, scopes: form.scopes,  }); setKeyResult({ title: '连接已创建', clientName: result.client.name, apiKey: result.api_key, scopes: result.client.scopes }); setForm(freshForm()); setShowCreate(false); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : '创建连接失败'); } finally { setSaving(false); }
  }
  async function updateClient(client: McpClient, patch: UpdateMyMcpClientInput) { setSaving(true); setError(null); try { await api.updateMyMcpClient(client.id, patch); await refresh(); setNotice('连接设置已更新'); } catch (err) { setError(err instanceof Error ? err.message : '更新连接失败'); } finally { setSaving(false); } }
  async function rotateClient(client: McpClient) { if (!window.confirm(`确定轮换“${client.name}”的 API Key？旧 Key 会立即失效。`)) return; setSaving(true); try { const result = await api.rotateMyMcpClientKey(client.id); setKeyResult({ title: 'Key 已轮换', clientName: client.name, apiKey: result.api_key, scopes: client.scopes }); } catch (err) { setError(err instanceof Error ? err.message : '轮换 Key 失败'); } finally { setSaving(false); } }
  async function deleteClient(client: McpClient) { if (!window.confirm(`删除“${client.name}”？使用它的客户端会立即无法连接。`)) return; setSaving(true); try { await api.deleteMyMcpClient(client.id); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : '删除连接失败'); } finally { setSaving(false); } }
  const active = clients.filter((client) => client.enabled).length;

  if (isLoading) return <div className="mcp-workspace-loading">正在打开你的 MCP 工作台…</div>;
  if (!isAuthenticated) return <div className="mcp-workspace-shell"><div className="mcp-empty-state"><LockOutlined /><h2>请先登录</h2><p>登录后即可申请 MCP Key，并获得完整的客户端配置引导。</p></div></div>;
  if (loading) return <div className="mcp-workspace-loading">正在加载你的 MCP 连接…</div>;
  return <div className="mcp-workspace-shell">
    <header className="mcp-workspace-header"><div><p className="mcp-kicker">我的 MCP</p><h1>把 Storing 接入你的 AI 工具</h1><p className="mcp-lead">申请一个专属 API Key，复制配置，几分钟内让你的 Agent 获得摘要和收件箱能力。</p></div><div className="mcp-header-actions"><button type="button" className="mcp-btn mcp-btn-quiet" onClick={refresh}><ReloadOutlined /> 刷新</button><button type="button" className="mcp-btn mcp-btn-primary" onClick={() => setShowCreate(true)}><PlusOutlined /> 新建连接</button></div></header>
    {error && <div className="mcp-inline-alert is-error">{error}</div>}{notice && <div className="mcp-inline-alert is-ok">{notice}</div>}
    <section className="mcp-onboarding" aria-label="MCP 接入步骤"><div className="mcp-step is-done"><span className="mcp-step-icon"><KeyOutlined /></span><div className="mcp-step-copy"><strong>创建连接</strong><small>申请专属 API Key</small></div></div><div className={`mcp-step${clients.length ? ' is-done' : ''}`}><span className="mcp-step-icon"><CopyOutlined /></span><div className="mcp-step-copy"><strong>复制配置</strong><small>添加远程 MCP URL</small></div></div><div className={`mcp-step${logs.length ? ' is-done' : ''}`}><span className="mcp-step-icon"><ThunderboltOutlined /></span><div className="mcp-step-copy"><strong>开始使用</strong><small>让 Agent 总结或收藏</small></div></div></section>
    <nav className="mcp-workspace-tabs" aria-label="MCP 工作台导航"><button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>我的连接 <b>{clients.length}</b></button><button type="button" className={tab === 'guide' ? 'is-active' : ''} onClick={() => setTab('guide')}>接入指南</button><button type="button" className={tab === 'logs' ? 'is-active' : ''} onClick={() => setTab('logs')}>调用记录 <b>{logs.length}</b></button></nav>
    {tab === 'overview' && <div className="mcp-overview-layout"><main>{clients.length === 0 ? <div className="mcp-empty-state"><div className="mcp-empty-icon"><KeyOutlined /></div><h2>还没有 MCP 连接</h2><p>创建第一个连接，系统会为你生成独立 API Key，并提供可复制的客户端配置。</p><button type="button" className="mcp-btn mcp-btn-primary" onClick={() => setShowCreate(true)}><PlusOutlined /> 创建我的第一个连接</button></div> : <><div className="mcp-section-title"><div><h2>你的连接</h2><p>{active} 个运行中 · 每个连接可以对应一个不同的 Agent</p></div></div><div className="mcp-connection-list">{clients.map((client) => <ClientCard key={client.id} client={client} onToggle={() => updateClient(client, { enabled: !client.enabled })} onRotate={() => rotateClient(client)} onDelete={() => deleteClient(client)} />)}</div></>}</main><aside className="mcp-side-note"><div className="mcp-note-icon"><SettingOutlined /></div><h3>推荐使用方式</h3><p>外部 SaaS 优先使用 Streamable HTTP 远程连接；只有本地桌面客户端不支持远程 URL 时，才使用 stdio 兼容模式。</p><button type="button" className="mcp-text-link" onClick={() => setTab('guide')}>查看接入指南 <ArrowRightOutlined /></button></aside></div>}
    {tab === 'guide' && <GuidePanel />}
    {tab === 'logs' && <LogsPanel logs={logs} />}
    {showCreate && <div className="mcp-modal-overlay"><CreateConnectionPanel saving={saving} form={form} setForm={setForm} onSubmit={createConnection} onCancel={() => setShowCreate(false)} readOnlyLimits={selfLimits} /></div>}
    {keyResult && <ApiKeyReveal result={keyResult} onClose={() => setKeyResult(null)} />}
    <footer className="mcp-workspace-footer">当前登录：{user?.username} · <span>你的连接只会访问你自己的数据空间</span></footer>
  </div>;
}

function GuidePanel() {
  const [mode, setMode] = useState<'remote' | 'stdio'>('remote');
  const [copied, setCopied] = useState<string | null>(null);
  const endpoint = remoteMcpUrl();
  const remoteConfig = configSnippet('sk-storing-••••••••••••••••');
  const stdioConfig = JSON.stringify({
    mcpServers: {
      storing: {
        command: 'node',
        args: ['<storing-repo>/apps/mcp/dist/index.js'],
        env: {
          STORING_API_BASE: 'https://your-storing-domain.example/api/v1',
          STORING_MCP_API_KEY: 'sk-storing-••••••••••••••••',
        },
      },
    },
  }, null, 2);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return <div className="mcp-guide-layout">
    <section className="mcp-guide-main">
      <div className="mcp-section-title"><div><p className="mcp-kicker">远程接入</p><h2>把 Storing 连接到 SaaS 或 Agent</h2><p>外部 SaaS 默认使用 Streamable HTTP；stdio 仅作为本地客户端兼容方案。</p></div></div>
      <div className="mcp-transport-switch" role="tablist" aria-label="MCP transport">
        <button type="button" className={mode === 'remote' ? 'is-active' : ''} onClick={() => setMode('remote')}><span>推荐</span><strong>Streamable HTTP</strong><small>远程 SaaS / 云端 Agent</small></button>
        <button type="button" className={mode === 'stdio' ? 'is-active' : ''} onClick={() => setMode('stdio')}><strong>stdio</strong><small>本地 Codex / Claude Desktop</small></button>
      </div>

      {mode === 'remote' ? <>
        <div className="mcp-guide-callout"><SafetyOutlined /><div><strong>远程方式无需安装 Storing MCP 程序</strong><p>SaaS 客户端直接通过 HTTPS 访问你的 MCP URL，并在 Authorization Header 中携带刚申请的 API Key。</p></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">01</span><div><h3>创建专属连接和 API Key</h3><p>在“我的连接”点击“新建连接”。如果只需要摘要，保留默认的 summary:create 和 job:read:self；需要入库时再开启 collect:create 和 inbox:write。</p></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">02</span><div><h3>填写远程 MCP 地址</h3><p>将下面的 Streamable HTTP endpoint 填入 SaaS 的 Remote MCP URL。生产部署时，这个地址应由 HTTPS 反向代理暴露。</p><div className="mcp-endpoint-card"><code>{endpoint}</code><button type="button" onClick={() => copy(endpoint, 'endpoint')}><CopyOutlined /> {copied === 'endpoint' ? '已复制' : '复制地址'}</button></div></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">03</span><div><h3>配置 Bearer API Key</h3><p>支持自定义 Header 的客户端可直接复制以下配置。API Key 只在创建或轮换时展示一次。</p><div className="mcp-code-toolbar"><span>Streamable HTTP JSON</span><button type="button" onClick={() => copy(remoteConfig, 'remote')}><CopyOutlined /> {copied === 'remote' ? '已复制' : '复制配置'}</button></div><pre>{remoteConfig}</pre></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">04</span><div><h3>连接后调用工具</h3><div className="mcp-tool-list"><div><strong>summarize_url</strong><span>提交公开 URL，返回异步任务 job_id。</span></div><div><strong>get_collect_status</strong><span>用 job_id 获取标题、摘要、分类和标签。</span></div><div><strong>collect_url</strong><span>拥有入库权限时，将文章保存到你的收件箱。</span></div></div></div></div>
      </> : <>
        <div className="mcp-guide-callout is-secondary"><SettingOutlined /><div><strong>仅在客户端不支持 Remote MCP URL 时使用</strong><p>stdio 需要在用户电脑安装 Node.js、下载或构建 Storing MCP，并由客户端启动本地进程。</p></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">01</span><div><h3>构建本地 MCP 程序</h3><pre>{`cd apps/mcp\npnpm install\npnpm build`}</pre></div></div>
        <div className="mcp-guide-card"><span className="mcp-guide-number">02</span><div><h3>配置本地 command 和环境变量</h3><div className="mcp-code-toolbar"><span>stdio JSON</span><button type="button" onClick={() => copy(stdioConfig, 'stdio')}><CopyOutlined /> {copied === 'stdio' ? '已复制' : '复制配置'}</button></div><pre>{stdioConfig}</pre></div></div>
      </>}
    </section>
    <aside className="mcp-guide-aside">
      <div className="mcp-side-note"><div className="mcp-note-icon"><SafetyOutlined /></div><h3>安全提示</h3><p>API Key 等同于你的 MCP 调用密码。不要提交到 Git，不要发给其他人；怀疑泄露时立即轮换。</p></div>
      <div className="mcp-side-note"><div className="mcp-note-icon"><UserOutlined /></div><h3>数据归属</h3><p>远程调用仍然绑定当前用户空间。其他用户无法看到你的收件箱、收藏状态和调用记录。</p></div>
      <div className="mcp-side-note"><div className="mcp-note-icon"><ThunderboltOutlined /></div><h3>客户端要求</h3><p>当前远程认证使用 Bearer API Key。SaaS 客户端需要支持 Streamable HTTP 和自定义 Authorization Header。</p></div>
    </aside>
  </div>;
}

function LogsPanel({ logs }: { logs: McpRequestLog[] }) {
  return <section className="mcp-logs-panel"><div className="mcp-section-title"><div><p className="mcp-kicker">最近活动</p><h2>调用记录</h2><p>这里只展示你自己的 MCP client 请求。</p></div></div><div className="mcp-log-table"><div className="mcp-log-header"><span>状态</span><span>工具</span><span>结果</span><span>耗时</span><span>时间</span></div>{logs.map((log) => <div className="mcp-log-item" key={log.id}><span className={`mcp-status-pill mcp-log-cell-status is-${log.status === 'success' ? 'on' : 'off'}`}>{statusText(log.status)}</span><strong className="mcp-log-cell-tool">{log.tool_name}</strong><span className="mcp-log-cell-result">{log.error_code ?? '完成'}</span><span className="mcp-log-cell-duration">{log.duration_ms ?? '—'} ms</span><time className="mcp-log-cell-time">{dateText(log.created_at)}</time></div>)}{logs.length === 0 && <div className="mcp-table-empty">还没有调用记录。创建连接并完成第一次调用后，记录会显示在这里。</div>}</div></section>;
}

export function McpAdminContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('clients');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [clients, setClients] = useState<McpClient[]>([]);
  const [logs, setLogs] = useState<McpRequestLog[]>([]);
  const [platformLimits, setPlatformLimits] = useState({ rate_limit_per_minute: 20, rate_limit_per_day: 500, concurrent_collect_limit: 3, updated_at: null as string | null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyResult, setKeyResult] = useState<KeyResult | null>(null);
  const [adminForm, setAdminForm] = useState<FormState & { ownerUserId: string }>({ ...freshForm(), ownerUserId: '' });

  const refresh = useCallback(async () => { if (!isAuthenticated || user?.role !== 'admin') return; setLoading(true); try { const [userData, clientData, logData, defaultData] = await Promise.all([api.getAdminUsers(), api.getMcpClients(), api.getMcpRequestLogs(), api.getMcpPlatformLimits()]); setUsers(userData.users); setClients(clientData.clients); setLogs(logData.logs); setPlatformLimits(defaultData); setAdminForm((current) => ({ ...current, ownerUserId: current.ownerUserId || String(userData.users.find((item) => item.status === 'active')?.id ?? '') })); } catch (err) { setError(err instanceof Error ? err.message : '加载管理数据失败'); } finally { setLoading(false); } }, [isAuthenticated, user?.role]);
  useEffect(() => { refresh(); }, [refresh]);
  async function createAdminClient(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { const result = await api.createMcpClient({ name: adminForm.name, owner_user_id: Number(adminForm.ownerUserId), scopes: adminForm.scopes, rate_limit_per_minute: numOrNull(adminForm.rateLimitPerMinute), rate_limit_per_day: numOrNull(adminForm.rateLimitPerDay), concurrent_collect_limit: numOrNull(adminForm.concurrentCollectLimit),  }); setKeyResult({ title: '管理员已创建连接', clientName: result.client.name, apiKey: result.api_key, scopes: result.client.scopes }); setShowCreate(false); setAdminForm({ ...freshForm(), ownerUserId: adminForm.ownerUserId }); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : '创建连接失败'); } finally { setSaving(false); } }
  async function updateAdmin(client: McpClient, patch: UpdateMcpClientInput) { setSaving(true); try { await api.updateMcpClient(client.id, patch); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : '更新失败'); } finally { setSaving(false); } }
  async function rotateAdmin(client: McpClient) { if (!window.confirm(`轮换 ${client.name} 的 Key？`)) return; setSaving(true); try { const result = await api.rotateMcpClientKey(client.id); setKeyResult({ title: 'Key 已轮换', clientName: client.name, apiKey: result.api_key, scopes: client.scopes }); } catch (err) { setError(err instanceof Error ? err.message : '轮换失败'); } finally { setSaving(false); } }
  async function deleteAdmin(client: McpClient) { if (!window.confirm(`删除 ${client.name}？`)) return; setSaving(true); try { await api.deleteMcpClient(client.id); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : '删除失败'); } finally { setSaving(false); } }
  if (isLoading) return <div className="mcp-workspace-loading">正在打开 MCP 运营控制台…</div>;
  if (!isAuthenticated || user?.role !== 'admin') return <div className="mcp-workspace-shell"><div className="mcp-empty-state"><LockOutlined /><h2>需要管理员权限</h2><p>普通用户请前往“我的 MCP”申请自己的 API Key。</p><Link href="/settings/mcp" className="mcp-btn mcp-btn-primary">前往我的 MCP</Link></div></div>;
  if (loading) return <div className="mcp-workspace-loading">正在加载运营数据…</div>;
  return <div className="mcp-admin-shell"><header className="mcp-admin-header"><div><p className="mcp-kicker">运营控制台</p><h1>MCP 管理</h1><p>管理 MCP 连接生命周期、默认配额和调用安全策略。</p></div><div className="mcp-header-actions"><Link href="/admin/users" className="mcp-btn mcp-btn-quiet">用户管理</Link><Link href="/settings/mcp" className="mcp-btn mcp-btn-quiet">查看我的 MCP</Link><button type="button" className="mcp-btn mcp-btn-primary" onClick={() => setShowCreate(true)}><PlusOutlined /> 为用户创建连接</button></div></header>{error && <div className="mcp-inline-alert is-error">{error}</div>}<div className="mcp-admin-metrics"><div><span>连接总数</span><strong>{clients.length}</strong><small>{clients.filter((item) => item.enabled).length} 个运行中</small></div><div><span>可用 Owner</span><strong>{users.filter((item) => item.status === 'active').length}</strong><small>来自系统用户管理</small></div><div><span>最近调用</span><strong>{logs.length}</strong><small>当前记录窗口</small></div></div><nav className="mcp-admin-tabs"><button className={tab === 'clients' ? 'is-active' : ''} onClick={() => setTab('clients')} type="button"><KeyOutlined /> 连接</button><button className={tab === 'defaults' ? 'is-active' : ''} onClick={() => setTab('defaults')} type="button"><SettingOutlined /> 默认配额</button><button className={tab === 'logs' ? 'is-active' : ''} onClick={() => setTab('logs')} type="button"><SafetyOutlined /> 审计日志</button></nav>{tab === 'clients' && <section className="mcp-admin-section"><div className="mcp-section-title"><div><h2>全部 MCP 连接</h2><p>管理员可以暂停、轮换或吊销任意用户的连接。</p></div></div><div className="mcp-connection-list">{clients.map((client) => <ClientCard key={client.id} client={client} onToggle={() => updateAdmin(client, { enabled: !client.enabled })} onRotate={() => rotateAdmin(client)} onDelete={() => deleteAdmin(client)} />)}{!clients.length && <div className="mcp-table-empty">还没有连接。</div>}</div></section>}{tab === 'defaults' && <AdminDefaultLimits limits={platformLimits} onSaved={refresh} />}{tab === 'logs' && <LogsPanel logs={logs} />}{showCreate && <div className="mcp-modal-overlay"><CreateConnectionPanel saving={saving} form={adminForm} setForm={(next) => setAdminForm({ ...next, ownerUserId: adminForm.ownerUserId })} onSubmit={createAdminClient} onCancel={() => setShowCreate(false)} allowLimitEditing ownerSelector={<label className="mcp-field"><span>Owner 用户</span><select value={adminForm.ownerUserId} onChange={(e) => setAdminForm({ ...adminForm, ownerUserId: e.target.value })}>{users.filter((item) => item.status === 'active').map((item) => <option value={item.id} key={item.id}>{item.username} · {item.role}</option>)}</select></label>} /></div>}{keyResult && <ApiKeyReveal result={keyResult} onClose={() => setKeyResult(null)} />}</div>;
}

function AdminDefaultLimits({ limits, onSaved }: { limits: { rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number; updated_at: string | null }; onSaved: () => void }) {
  const [form, setForm] = useState({
    rateLimitPerMinute: String(limits.rate_limit_per_minute),
    rateLimitPerDay: String(limits.rate_limit_per_day),
    concurrentCollectLimit: String(limits.concurrent_collect_limit),
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      rateLimitPerMinute: String(limits.rate_limit_per_minute),
      rateLimitPerDay: String(limits.rate_limit_per_day),
      concurrentCollectLimit: String(limits.concurrent_collect_limit),
    });
  }, [limits]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rateLimitPerMinute = Number(form.rateLimitPerMinute);
    const rateLimitPerDay = Number(form.rateLimitPerDay);
    const concurrentCollectLimit = Number(form.concurrentCollectLimit);
    if (![rateLimitPerMinute, rateLimitPerDay, concurrentCollectLimit].every((value) => Number.isInteger(value) && value > 0)) {
      setError('三个配额都必须是大于 0 的整数');
      return;
    }

    setSaving(true); setError(null); setNotice(null);
    try {
      await api.updateMcpPlatformLimits({
        rate_limit_per_minute: rateLimitPerMinute,
        rate_limit_per_day: rateLimitPerDay,
        concurrent_collect_limit: concurrentCollectLimit,
      });
      setNotice('平台默认配额已保存，之后新建的普通用户 MCP 连接会立即使用此配置。');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存默认配额失败');
    } finally {
      setSaving(false);
    }
  }

  return <section className="mcp-admin-defaults">
    <div className="mcp-section-title"><div><p className="mcp-kicker">平台策略</p><h2>普通用户默认配额</h2><p>仅影响之后由普通用户自助创建的 MCP client；已有 client 保留创建时的配额，避免运行中突变。</p></div></div>
    <form className="mcp-default-limit-form" onSubmit={submit}>
      <div className="mcp-default-limit-card"><span>每分钟调用</span><input inputMode="numeric" value={form.rateLimitPerMinute} onChange={(event) => setForm({ ...form, rateLimitPerMinute: event.target.value })} /><small>次 / 分钟</small></div>
      <div className="mcp-default-limit-card"><span>每天调用</span><input inputMode="numeric" value={form.rateLimitPerDay} onChange={(event) => setForm({ ...form, rateLimitPerDay: event.target.value })} /><small>次 / 天</small></div>
      <div className="mcp-default-limit-card"><span>并发采集</span><input inputMode="numeric" value={form.concurrentCollectLimit} onChange={(event) => setForm({ ...form, concurrentCollectLimit: event.target.value })} /><small>个任务</small></div>
      <div className="mcp-default-limit-actions"><button type="submit" className="mcp-btn mcp-btn-primary" disabled={saving}>{saving ? '保存中…' : '保存平台默认配额'}</button><p>管理员仍可在单个 client 层面设置例外配额。</p></div>
    </form>
    {notice && <div className="mcp-inline-alert is-ok">{notice}</div>}
    {error && <div className="mcp-inline-alert is-error">{error}</div>}
  </section>;
}
