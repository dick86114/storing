import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 5;
const REDIRECT_TIMEOUT_MS = 10_000;

function unbracket(hostname: string) {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isPrivateIpv4(host: string) {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second, third] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateIpv6(host: string) {
  const normalized = unbracket(host);
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('2001:db8:')
  );
}

export function isPublicIp(address: string) {
  const normalized = unbracket(address);
  const version = isIP(normalized);
  if (version === 4) return !isPrivateIpv4(normalized);
  if (version === 6) return !isPrivateIpv6(normalized);
  return false;
}

export function normalizeOutboundUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed || /\s/.test(trimmed)) throw new Error('请输入有效的公开网页链接');
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('请输入有效的公开网页链接');
  }
  url.hash = '';
  return url;
}

export async function assertSafeOutboundUrl(rawUrl: string | URL) {
  const url = rawUrl instanceof URL ? new URL(rawUrl.toString()) : normalizeOutboundUrl(rawUrl);
  const hostname = unbracket(url.hostname);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || !hostname.includes('.')) {
    throw new Error('链接不能指向本机或内部网络');
  }

  const directIp = isIP(hostname);
  if (directIp) {
    if (!isPublicIp(hostname)) throw new Error('链接不能指向本机或内部网络');
    return url.toString();
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error('链接不能指向本机或内部网络');
  }
  return url.toString();
}

export async function resolveSafeCaptureUrl(rawUrl: string) {
  let candidate = await assertSafeOutboundUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertSafeOutboundUrl(candidate);
    const response = await fetch(candidate, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
      headers: { Range: 'bytes=0-0', 'User-Agent': 'Storing outbound URL validator' },
    }).catch((error) => {
      throw new Error(`无法安全验证链接：${error instanceof Error ? error.message : '请求失败'}`);
    });
    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && Boolean(location);
    await response.body?.cancel().catch(() => undefined);
    if (!isRedirect) return candidate;
    if (redirects === MAX_REDIRECTS) throw new Error('链接重定向次数过多');
    candidate = new URL(location!, candidate).toString();
  }

  throw new Error('链接重定向次数过多');
}
