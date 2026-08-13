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
  fetchRelease: AndroidReleaseManifestFetch = (url) => fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'storing-android-updater' } }),
): Promise<string | null> {
  const tag = extractGitHubReleaseTag(apkUrl);
  if (!tag) return null;
  const repository = process.env.GITHUB_REPOSITORY?.trim() || 'dick86114/storing';
  const endpoint = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  const response = await fetchRelease(endpoint);
  if (!response.ok) throw new Error(`GitHub Release 日志请求失败：HTTP ${response.status}`);
  const payload = await response.json() as { body?: unknown };
  return typeof payload.body === 'string' ? payload.body : null;
}

export type AndroidReleaseManifestFetch = (url: string) => Promise<Response>;

/** Loads the public GitHub Release asset used by Android clients without exposing a GitHub token. */
export async function loadRemoteAndroidReleaseManifest(
  manifestUrl: string,
  fetchManifest: AndroidReleaseManifestFetch = (url) => fetch(url),
): Promise<AndroidReleaseManifest> {
  const endpoint = new URL(manifestUrl);
  if (endpoint.protocol !== 'https:') throw new Error('Android 更新清单必须使用 HTTPS');
  const response = await fetchManifest(endpoint.toString());
  if (!response.ok) throw new Error(`Android 更新清单请求失败：HTTP ${response.status}`);
  const release = parseAndroidReleaseManifest(await response.json());
  if (!release) throw new Error('Android 更新清单无效');
  return release;
}
