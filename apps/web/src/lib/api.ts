const BASE = '/api/v1';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
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

  getCategories: () => fetchJSON<any>(`/categories`),
};