const BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 10000;

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
    fetchJSON<{ token: string; user: { id: number; username: string } }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  verifyToken: () =>
    fetchJSON<{ valid: boolean; user?: { id: number; username: string } }>('/verify'),

  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJSON<{ message: string }>('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // 文章相关
  getArticles: (view: string, page = 1, category?: string, perPage = 8, sort?: string, order?: 'asc' | 'desc') => {
    const params = new URLSearchParams({ view, page: String(page), perPage: String(perPage) });
    if (category && category !== 'all') params.set('category', category);
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    return fetchJSON<any>(`/articles?${params}`);
  },

  getArticle: (id: number, format: 'markdown' | 'html' = 'markdown') =>
    fetchJSON<any>(`/articles/${id}?format=${format}`, { timeoutMs: 45000 }),

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
    fetchJSON<{ inbox: number; favorites: number; archive: number; wiki?: number }>('/counts'),

  createCollectJob: (url: string) =>
    fetchJSON<any>('/collect', { method: 'POST', body: JSON.stringify({ url }), timeoutMs: 30000 }),

  getCollectJobs: (limit = 12) =>
    fetchJSON<any>(`/collect/jobs?limit=${limit}`, { timeoutMs: 30000 }),

  getCollectJob: (id: number) =>
    fetchJSON<any>(`/collect/jobs/${id}`, { timeoutMs: 30000 }),

  retryCollectJob: (id: number) =>
    fetchJSON<any>(`/collect/jobs/${id}/retry`, { method: 'POST', timeoutMs: 30000 }),

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

  reindexWikiArticle: (id: number) =>
    fetchJSON<any>(`/wiki/articles/${id}/reindex`, { method: 'POST', timeoutMs: 120000 }),

  getWikiArticleStatus: (id: number) =>
    fetchJSON<any>(`/wiki/articles/${id}/status`),

  rebuildWikiPage: (id: number) =>
    fetchJSON<any>(`/wiki/pages/${id}/rebuild`, { method: 'POST', timeoutMs: 120000 }),
};
