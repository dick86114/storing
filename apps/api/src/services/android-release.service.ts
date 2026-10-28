export type AndroidReleaseManifest = {
  versionCode: number;
  versionName: string;
  minimumSupportedVersionCode: number;
  mandatory: boolean;
  releaseNotes: string[];
  apkUrl: string;
  sha256: string;
  publishedAt: string;
  releaseTag?: string;
};

export type GitHubReleaseAccessKind = 'token' | 'rate-limit';

export class GitHubReleaseAccessError extends Error {
  constructor(
    public readonly kind: GitHubReleaseAccessKind,
    public readonly status: number,
  ) {
    super(kind === 'rate-limit' ? 'GitHub API 请求额度已用尽' : 'GitHub 令牌无效或权限不足');
    this.name = 'GitHubReleaseAccessError';
  }
}

export function normalizeGitHubToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  if (!token) return undefined;
  if (token.length > 512 || /\s/.test(token)) {
    throw new Error('GitHub 令牌格式无效');
  }
  return token;
}

export function parseAndroidReleaseManifest(value: unknown): AndroidReleaseManifest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const versionCode = candidate.versionCode;
  const versionName = candidate.versionName;
  const minimumSupportedVersionCode = candidate.minimumSupportedVersionCode;
  const mandatory = candidate.mandatory;
  const releaseNotes = candidate.releaseNotes;
  const apkUrl = candidate.apkUrl;
  const sha256 = candidate.sha256;
  const publishedAt = candidate.publishedAt;
  if (!Number.isInteger(versionCode) || (versionCode as number) < 1) return null;
  if (typeof versionName !== 'string' || !versionName.trim()) return null;
  if (!Number.isInteger(minimumSupportedVersionCode) || (minimumSupportedVersionCode as number) < 1) return null;
  if (typeof mandatory !== 'boolean') return null;
  if (!Array.isArray(releaseNotes) || releaseNotes.some((note) => typeof note !== 'string')) return null;
  if (typeof apkUrl !== 'string' || !apkUrl.startsWith('https://')) return null;
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) return null;
  if (typeof publishedAt !== 'string' || Number.isNaN(Date.parse(publishedAt))) return null;
  return {
    versionCode: versionCode as number,
    versionName: versionName.trim(),
    minimumSupportedVersionCode: minimumSupportedVersionCode as number,
    mandatory,
    releaseNotes,
    apkUrl,
    sha256: sha256.toLowerCase(),
    publishedAt,
    ...(typeof candidate.releaseTag === 'string' ? { releaseTag: candidate.releaseTag } : {}),
  };
}

export function extractGitHubReleaseTag(apkUrl: string): string | null {
  try {
    const url = new URL(apkUrl);
    if (url.hostname !== 'github.com') return null;
    const match = url.pathname.match(/\/releases\/download\/([^/]+)\//);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function loadGitHubReleaseNotes(
  apkUrl: string,
  fetchRelease: AndroidReleaseManifestFetch = (url, init) => fetch(url, init),
  gitHubToken?: string,
): Promise<string | null> {
  const tag = extractGitHubReleaseTag(apkUrl);
  if (!tag) return null;
  const repository = process.env.GITHUB_REPOSITORY?.trim() || 'dick86114/storing';
  const endpoint = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  const response = await fetchRelease(endpoint, { headers: githubAPIHeaders(gitHubToken) });
  assertGitHubAPIResponse(response);
  if (!response.ok) throw new Error(`GitHub Release 日志请求失败：HTTP ${response.status}`);
  const payload = await response.json() as { body?: unknown };
  return typeof payload.body === 'string' ? payload.body : null;
}

export type AndroidReleaseManifestFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Loads the public GitHub Release asset used by Android clients without exposing a GitHub token. */
export async function loadRemoteAndroidReleaseManifest(
  manifestUrl: string,
  fetchManifest: AndroidReleaseManifestFetch = (url, init) => fetch(url, init),
  gitHubToken?: string,
): Promise<AndroidReleaseManifest> {
  const endpoint = new URL(manifestUrl);
  if (endpoint.protocol !== 'https:') throw new Error('Android 更新清单必须使用 HTTPS');

  if (gitHubToken) {
    const location = resolveGitHubManifestLocation(endpoint);
    if (location) {
      return loadGitHubReleaseManifest(location, fetchManifest, gitHubToken);
    }
  }

  const response = await fetchManifest(endpoint.toString());
  if (!response.ok) throw new Error(`Android 更新清单请求失败：HTTP ${response.status}`);
  const release = parseAndroidReleaseManifest(await response.json());
  if (!release) throw new Error('Android 更新清单无效');
  return release;
}

type GitHubManifestLocation = {
  apiURL: string;
  assetName: string;
};

function resolveGitHubManifestLocation(endpoint: URL): GitHubManifestLocation | null {
  if (endpoint.hostname !== 'github.com') return null;
  const segments = endpoint.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length < 6 || segments[2] !== 'releases') return null;

  const [owner, repository] = segments;
  const apiBase = `https://api.github.com/repos/${owner}/${repository}/releases`;
  if (segments[3] === 'download') {
    const tag = segments[4];
    const assetName = segments.slice(5).join('/');
    return {
      apiURL: `${apiBase}/tags/${encodeURIComponent(tag)}`,
      assetName,
    };
  }
  if (segments[3] === 'latest' && segments[4] === 'download') {
    return {
      apiURL: `${apiBase}/latest`,
      assetName: segments.slice(5).join('/'),
    };
  }
  return null;
}

async function loadGitHubReleaseManifest(
  location: GitHubManifestLocation,
  fetchManifest: AndroidReleaseManifestFetch,
  gitHubToken: string,
): Promise<AndroidReleaseManifest> {
  const releaseResponse = await fetchManifest(location.apiURL, {
    headers: githubAPIHeaders(gitHubToken),
  });
  assertGitHubAPIResponse(releaseResponse);
  if (!releaseResponse.ok) {
    throw new Error(`GitHub Release 清单请求失败：HTTP ${releaseResponse.status}`);
  }

  const payload = await releaseResponse.json() as {
    assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
  };
  const asset = payload.assets?.find((candidate) => candidate.name === location.assetName);
  if (!asset || typeof asset.browser_download_url !== 'string' || !asset.browser_download_url.startsWith('https://')) {
    throw new Error('GitHub Release 中未找到 Android 更新清单');
  }

  // 公开 Release 资产下载不携带令牌，避免凭据被转发到其他下载主机。
  const manifestResponse = await fetchManifest(asset.browser_download_url);
  if (!manifestResponse.ok) {
    throw new Error(`Android 更新清单请求失败：HTTP ${manifestResponse.status}`);
  }
  const release = parseAndroidReleaseManifest(await manifestResponse.json());
  if (!release) throw new Error('Android 更新清单无效');
  return release;
}

function githubAPIHeaders(gitHubToken?: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'storing-android-updater',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(gitHubToken ? { Authorization: `Bearer ${gitHubToken}` } : {}),
  };
}

function assertGitHubAPIResponse(response: Response): void {
  if (response.ok) return;
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (response.status === 429 || (response.status === 403 && (remaining === '0' || response.headers.has('retry-after')))) {
    throw new GitHubReleaseAccessError('rate-limit', response.status);
  }
  if (response.status === 401 || response.status === 403) {
    throw new GitHubReleaseAccessError('token', response.status);
  }
}
