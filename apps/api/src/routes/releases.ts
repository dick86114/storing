import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { loadRemoteAndroidReleaseManifest, parseAndroidReleaseManifest, type AndroidReleaseManifest } from '../services/android-release.service.js';

const defaultManifestPath = '/app/releases/android/latest.json';

export const releasesRoutes = new Hono();

async function loadLocalAndroidReleaseManifest(path: string): Promise<AndroidReleaseManifest | null> {
  const raw = await readFile(path, 'utf8');
  const release = parseAndroidReleaseManifest(JSON.parse(raw));
  if (!release) throw new Error('Android 更新清单无效');
  return release;
}

/**
 * Public, read-only metadata for the self-hosted Android updater.
 * A GitHub Release asset is the primary source; the mounted file is a safe manual fallback.
 */
releasesRoutes.get('/mobile/releases/latest', async (c) => {
  const currentVersionCode = Number.parseInt(c.req.query('versionCode') || '', 10);
  if (!Number.isInteger(currentVersionCode) || currentVersionCode < 1) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'versionCode 必须为正整数' } }, 400);
  }

  let release: AndroidReleaseManifest | null = null;
  let remoteError: unknown = null;
  const remoteManifestUrl = process.env.ANDROID_RELEASE_MANIFEST_URL?.trim();
  if (remoteManifestUrl) {
    try {
      release = await loadRemoteAndroidReleaseManifest(remoteManifestUrl);
    } catch (error) {
      remoteError = error;
      console.error('Unable to read GitHub Android release manifest:', error);
    }
  }

  if (!release) {
    try {
      release = await loadLocalAndroidReleaseManifest(process.env.ANDROID_RELEASE_MANIFEST_PATH?.trim() || defaultManifestPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.error('Unable to read local Android release manifest:', error);
      if (remoteError || code !== 'ENOENT') {
        return c.json({ error: { code: 'RELEASE_MANIFEST_UNAVAILABLE', message: 'Android 更新清单暂不可用' } }, 503);
      }
      return c.body(null, 204);
    }
  }

  const resolvedRelease = release;
  if (!resolvedRelease) {
    return c.json({ error: { code: 'RELEASE_MANIFEST_UNAVAILABLE', message: 'Android 更新清单暂不可用' } }, 503);
  }
  if (resolvedRelease.versionCode <= currentVersionCode) return c.body(null, 204);
  c.header('Cache-Control', 'no-store');
  return c.json(resolvedRelease);
});
