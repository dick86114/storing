const API_PATH = '/api/v1';

function normalizeUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label}不能为空`);

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label}不是有效地址`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label}必须使用 HTTP 或 HTTPS`);
  }
  return url;
}

export function resolveApiBase(serverUrl: string, apiOverride?: string) {
  const source = apiOverride?.trim() || serverUrl;
  const url = normalizeUrl(source, apiOverride?.trim() ? 'API 地址' : '服务器地址');
  const path = url.pathname.replace(/\/+$/, '');

  if (apiOverride?.trim()) {
    return `${url.origin}${path || '/'}`.replace(/\/$/, '');
  }

  return `${url.origin}${path === '/' ? '' : path}${API_PATH}`.replace(/\/$/, '');
}

export function requiresInsecureHttpConfirmation(apiBase: string) {
  const url = normalizeUrl(apiBase, 'API 地址');
  return url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]';
}

export function isCollectablePage(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
