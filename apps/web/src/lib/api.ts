const BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 10000;
export type ArticleHtmlVariant = 'desktop' | 'mobile';

export type AdminBootstrapStatus = {
  configured_username: string;
  account_exists: boolean;
  account_role: 'admin' | 'user' | 'service' | null;
  account_status: 'active' | 'disabled' | null;
  configured_password_matches: boolean;
  updated_at: string | null;
};

export type AdminUser = {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'service';
  status: 'active' | 'disabled';
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
  mcp_client_count: number;
  active_mcp_client_count: number;
  mcp_request_count: number;
  last_mcp_used_at: string | null;
  inbox_count: number;
  archive_count: number;
  favorite_count: number;
};

export type AdminUserActivity = {
  user: { id: number; username: string; role: 'admin' | 'user' | 'service'; status: 'active' | 'disabled'; last_login_at: string | null };
  clients: Array<{ id: number; name: string; enabled: boolean; scopes: string[]; created_at: string | null; last_used_at: string | null }>;
  logs_total: number;
  limit: number;
  offset: number;
  logs: Array<{ id: number; client_id: number | null; client_name: string | null; tool_name: string; status: string; error_code: string | null; duration_ms: number | null; transport: string; client_agent: string | null; request_method: string | null; request_path: string | null; created_at: string | null }>;
};

export type McpClient = {
  id: number;
  name: string;
  owner_user_id: number;
  owner_username: string | null;
  scopes: string[];
  enabled: boolean;
  rate_limit_per_minute: number | null;
  rate_limit_per_day: number | null;
  concurrent_collect_limit: number | null;
  default_save_to_inbox: boolean;
  created_at: string | null;
  updated_at: string | null;
  last_used_at: string | null;
};

export type McpRequestLog = {
  id: number;
  client_id: number | null;
  user_id: number | null;
  tool_name: string;
  url: string | null;
  normalized_url: string | null;
  status: 'success' | 'error' | 'rate_limited' | string;
  error_code: string | null;
  duration_ms: number | null;
  created_at: string | null;
};

export type CreateMyMcpClientInput = {
  name: string;
  scopes: string[];
  enabled?: boolean;
  default_save_to_inbox?: boolean;
};

export type CreateMcpClientInput = {
  name: string;
  owner_user_id: number;
  scopes: string[];
  enabled?: boolean;
  rate_limit_per_minute?: number | null;
  rate_limit_per_day?: number | null;
  concurrent_collect_limit?: number | null;
  default_save_to_inbox?: boolean;
};

export type UpdateMcpClientInput = Partial<Omit<CreateMcpClientInput, 'name' | 'owner_user_id'>>;
export type UpdateMyMcpClientInput = Pick<UpdateMcpClientInput, 'enabled' | 'scopes' | 'default_save_to_inbox'>;

export type CreateAdminUserInput = {
  username: string;
  password: string;
  role: 'admin' | 'user' | 'service';
  status: 'active' | 'disabled';
};

export type UpdateAdminUserInput = Partial<Pick<CreateAdminUserInput, 'role' | 'status' | 'password'>> & { username?: string };


type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

async function fetchJSON<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const controller = new AbortController();
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${BASE}${path}`, {
    ...fetchInit,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchInit.headers,
    },
  }).finally(() => window.clearTimeout(timeout));

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 401 或 403 时清除 token
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
    }
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // 认证相关
  login: (username: string, password: string) =>
    fetchJSON<{ token: string; user: { id: number; username: string; role?: string; status?: string } }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  verifyToken: () =>
    fetchJSON<{ valid: boolean; user?: { id: number; username: string; role?: string; status?: string } }>('/verify'),

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJSON<{ message: string }>('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  getAdminUsers: () =>
    fetchJSON<{ users: AdminUser[] }>('/admin/users'),

  getAdminBootstrapStatus: () =>
    fetchJSON<AdminBootstrapStatus>('/admin/bootstrap-status'),

  resetConfiguredAdminPassword: (confirmUsername: string) =>
    fetchJSON<{ message: string; configured_username: string; account_created: boolean }>('/admin/bootstrap/reset-password', {
      method: 'POST',
      body: JSON.stringify({ confirm_username: confirmUsername }),
    }),

  createAdminUser: (input: CreateAdminUserInput) =>
    fetchJSON<{ user: AdminUser }>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),

  updateAdminUser: (id: number, input: UpdateAdminUserInput) =>
    fetchJSON<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  getAdminUserActivity: (id: number, limit = 20, offset = 0) =>
    fetchJSON<AdminUserActivity>(`/admin/users/${id}/activity?limit=${limit}&offset=${offset}`),

  getMyMcpLimits: () =>
    fetchJSON<{ rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number; managed_by: 'platform' }>('/mcp/me/limits'),

  getMyMcpClients: () =>
    fetchJSON<{ clients: McpClient[] }>('/mcp/me/clients'),

  createMyMcpClient: (input: CreateMyMcpClientInput) =>
    fetchJSON<{ client: McpClient; api_key: string }>('/mcp/me/clients', { method: 'POST', body: JSON.stringify(input) }),

  updateMyMcpClient: (id: number, input: UpdateMyMcpClientInput) =>
    fetchJSON<{ client: McpClient }>(`/mcp/me/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  rotateMyMcpClientKey: (id: number) =>
    fetchJSON<{ client: { id: number; name: string; updatedAt?: string }; api_key: string }>(`/mcp/me/clients/${id}/rotate-key`, { method: 'POST' }),

  deleteMyMcpClient: (id: number) =>
    fetchJSON<{ client: { id: number; name: string }; revoked: true }>(`/mcp/me/clients/${id}`, { method: 'DELETE' }),

  getMyMcpRequestLogs: (limit = 50, offset = 0) =>
    fetchJSON<{ logs: McpRequestLog[] }>(`/mcp/me/request-logs?limit=${limit}&offset=${offset}`),

  getMcpPlatformLimits: () =>
    fetchJSON<{ rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number; updated_at: string | null }>('/admin/mcp/default-limits'),

  updateMcpPlatformLimits: (input: { rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number }) =>
    fetchJSON<{ rate_limit_per_minute: number; rate_limit_per_day: number; concurrent_collect_limit: number; updated_at: string | null }>('/admin/mcp/default-limits', { method: 'PATCH', body: JSON.stringify(input) }),

  getMcpClients: () =>
    fetchJSON<{ clients: McpClient[] }>('/admin/mcp/clients'),

  createMcpClient: (input: CreateMcpClientInput) =>
    fetchJSON<{ client: McpClient; api_key: string }>('/admin/mcp/clients', { method: 'POST', body: JSON.stringify(input) }),

  updateMcpClient: (id: number, input: UpdateMcpClientInput) =>
    fetchJSON<{ client: McpClient }>(`/admin/mcp/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  rotateMcpClientKey: (id: number) =>
    fetchJSON<{ client: { id: number; name: string; updatedAt?: string; updated_at?: string }; api_key: string }>(`/admin/mcp/clients/${id}/rotate-key`, { method: 'POST' }),

  deleteMcpClient: (id: number) =>
    fetchJSON<{ client: { id: number; name: string }; revoked: true }>(`/admin/mcp/clients/${id}`, { method: 'DELETE' }),

  getMcpRequestLogs: (clientId?: number, limit = 50, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (clientId) params.set('client_id', String(clientId));
    return fetchJSON<{ logs: McpRequestLog[] }>(`/admin/mcp/request-logs?${params.toString()}`);
  },

  // 文章相关
  getArticles: (view: string, page = 1, category?: string, perPage = 8, sort?: string, order?: 'asc' | 'desc', scope?: 'mine') => {
    const params = new URLSearchParams({ view, page: String(page), perPage: String(perPage) });
    if (category && category !== 'all') params.set('category', category);
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    if (scope) params.set('scope', scope);
    return fetchJSON<any>(`/articles?${params}`);
  },

  getArticle: (id: number, format: 'markdown' | 'html' = 'markdown', htmlVariant: ArticleHtmlVariant = 'desktop') => {
    const params = new URLSearchParams({ format });
    if (format === 'html') params.set('htmlVariant', htmlVariant);
    return fetchJSON<any>(`/articles/${id}?${params.toString()}`, { timeoutMs: 45000 });
  },

  getArticleMeta: (id: number) =>
    fetchJSON<any>(`/articles/${id}/meta`),

  getArticlePosition: (id: number, view: string, category?: string, perPage = 18) => {
    const params = new URLSearchParams({ view, perPage: String(perPage) });
    if (category && category !== 'all') params.set('category', category);
    return fetchJSON<any>(`/articles/${id}/position?${params}`);
  },

  toggleFavorite: (id: number) =>
    fetchJSON<any>(`/articles/${id}/favorite`, { method: 'POST' }),

  archive: (id: number) =>
    fetchJSON<any>(`/articles/${id}/archive`, { method: 'POST' }),

  unarchive: (id: number) =>
    fetchJSON<any>(`/articles/${id}/unarchive`, { method: 'POST' }),

  publish: (id: number) =>
    fetchJSON<{ article: any; publicUrl: string }>(`/articles/${id}/publish`, { method: 'POST', timeoutMs: 120000 }),

  unpublish: (id: number) =>
    fetchJSON<{ article: any; publicUrl: null }>(`/articles/${id}/unpublish`, { method: 'POST' }),

  getPublicPublication: (publicId: string) =>
    fetchJSON<{ article: any }>(`/publications/${encodeURIComponent(publicId)}`),

  refetchArticle: (id: number) =>
    fetchJSON<any>(`/articles/${id}/refetch`, { method: 'POST', timeoutMs: 120000 }),

  regenerateArticleAI: (id: number) =>
    fetchJSON<any>(`/articles/${id}/regenerate-ai`, { method: 'POST', timeoutMs: 120000 }),

  deleteArticle: (id: number) =>
    fetchJSON<any>(`/articles/${id}`, { method: 'DELETE' }),

  permanentlyDeleteArticle: (id: number) =>
    fetchJSON<any>(`/articles/${id}/permanent`, { method: 'DELETE' }),

  search: (q: string, page = 1) => {
    const params = new URLSearchParams({ q, page: String(page), perPage: '20' });
    return fetchJSON<any>(`/search?${params}`);
  },

  getSources: (sort?: string, order?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    const query = params.toString();
    return fetchJSON<any>(`/sources${query ? `?${query}` : ''}`);
  },

  getCounts: () =>
    fetchJSON<{ inbox: number; favorites: number; archive: number; published: number; wiki?: number }>('/counts'),

  createCollectJob: (url: string) =>
    fetchJSON<any>('/collect', { method: 'POST', body: JSON.stringify({ url }), timeoutMs: 30000 }),

  getCollectJobs: (limit = 12, offset = 0) =>
    fetchJSON<any>(`/collect/jobs?limit=${limit}&offset=${offset}`, { timeoutMs: 30000 }),

  getCollectJob: (id: number) =>
    fetchJSON<any>(`/collect/jobs/${id}`, { timeoutMs: 30000 }),

  retryCollectJob: (id: number) =>
    fetchJSON<any>(`/collect/jobs/${id}/retry`, { method: 'POST', timeoutMs: 30000 }),

  deleteCollectJob: (id: number) =>
    fetchJSON<any>(`/collect/jobs/${id}`, { method: 'DELETE', timeoutMs: 30000 }),

  clearFinishedCollectJobs: () =>
    fetchJSON<any>('/collect/jobs', { method: 'DELETE', timeoutMs: 30000 }),

  getWikiHome: (type = 'all') => {
    const params = new URLSearchParams();
    if (type && type !== 'all') params.set('type', type);
    const query = params.toString();
    return fetchJSON<any>(`/wiki${query ? `?${query}` : ''}`, { timeoutMs: 30000 });
  },

  getWikiStatus: () =>
    fetchJSON<any>('/wiki/status'),

  getWikiIndex: () =>
    fetchJSON<any>('/wiki/index', { timeoutMs: 30000 }),

  getWikiLog: (limit = 50) =>
    fetchJSON<any>(`/wiki/log?limit=${limit}`, { timeoutMs: 30000 }),

  getWikiGraph: () =>
    fetchJSON<any>('/wiki/graph', { timeoutMs: 30000 }),

  getWikiLint: (status = 'open', limit = 50) =>
    fetchJSON<any>(`/wiki/lint?status=${encodeURIComponent(status)}&limit=${limit}`, { timeoutMs: 30000 }),

  getWikiJobs: (status = 'pending', limit = 30) =>
    fetchJSON<any>(`/wiki/jobs?status=${encodeURIComponent(status)}&limit=${limit}`),

  getWikiAnswers: (limit = 20) =>
    fetchJSON<any>(`/wiki/answers?limit=${limit}`, { timeoutMs: 30000 }),

  searchWiki: (q: string, limit = 20) =>
    fetchJSON<any>(`/wiki/search?q=${encodeURIComponent(q)}&limit=${limit}`, { timeoutMs: 30000 }),

  getWikiPage: (slug: string) =>
    fetchJSON<any>(`/wiki/pages/${encodeURIComponent(slug)}`, { timeoutMs: 30000 }),

  updateWiki: (limit = 8) =>
    fetchJSON<any>(`/wiki/update?limit=${limit}`, { method: 'POST', timeoutMs: 120000 }),

  processWikiJobs: (limit = 8) =>
    fetchJSON<any>(`/wiki/process?limit=${limit}`, { method: 'POST', timeoutMs: 120000 }),

  retryFailedWikiJobs: (limit = 8) =>
    fetchJSON<any>(`/wiki/retry-failed?limit=${limit}`, { method: 'POST', timeoutMs: 120000 }),

  rebuildAllWiki: (limit = 4) =>
    fetchJSON<any>(`/wiki/rebuild-all?limit=${limit}`, { method: 'POST', timeoutMs: 120000 }),

  lintWiki: () =>
    fetchJSON<any>('/wiki/lint', { method: 'POST', timeoutMs: 120000 }),

  exportWikiMarkdown: () =>
    fetchJSON<any>('/wiki/export-markdown', { method: 'POST', timeoutMs: 120000 }),

  exportWikiPageMarkdown: (slug: string) =>
    fetchJSON<any>(`/wiki/pages/${encodeURIComponent(slug)}/export-markdown`, { method: 'POST', timeoutMs: 120000 }),

  reconcileWikiClaims: () =>
    fetchJSON<any>('/wiki/claims/reconcile', { method: 'POST', timeoutMs: 120000 }),

  askWiki: (question: string, history?: Array<{ question: string; answer: string }>) =>
    fetchJSON<any>('/wiki/ask', { method: 'POST', body: JSON.stringify({ question, history }), timeoutMs: 120000 }),

  fileWikiAnswer: (id: number) =>
    fetchJSON<any>(`/wiki/answers/${id}/file`, { method: 'POST', timeoutMs: 120000 }),

  deleteWikiAnswer: (id: number) =>
    fetchJSON<any>(`/wiki/answers/${id}`, { method: 'DELETE', timeoutMs: 30000 }),

  reindexWikiArticle: (id: number) =>
    fetchJSON<any>(`/wiki/articles/${id}/reindex`, { method: 'POST', timeoutMs: 120000 }),

  getWikiArticleStatus: (id: number) =>
    fetchJSON<any>(`/wiki/articles/${id}/status`),

  rebuildWikiPage: (id: number) =>
    fetchJSON<any>(`/wiki/pages/${id}/rebuild`, { method: 'POST', timeoutMs: 120000 }),
};
