export type AndroidReleaseManifest = {
  versionCode: number;
  versionName: string;
  minimumSupportedVersionCode: number;
  mandatory: boolean;
  releaseNotes: string[];
  apkUrl: string;
  sha256: string;
  publishedAt: string;
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
  };
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
