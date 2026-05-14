const BASE = '/api/v1';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
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
  getArticles: (view: string, page = 1, category?: string, perPage = 8) => {
    const params = new URLSearchParams({ view, page: String(page), perPage: String(perPage) });
    if (category && category !== 'all') params.set('category', category);
    return fetchJSON<any>(`/articles?${params}`);
  },

  getArticle: (id: number) => fetchJSON<any>(`/articles/${id}`),

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
};