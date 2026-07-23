import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import { parseAndroidReleaseManifest } from '../services/android-release.service.js';

const defaultManifestPath = '/app/releases/android/latest.json';

export const releasesRoutes = new Hono();

/** Public, read-only metadata for the self-hosted Android updater. */
releasesRoutes.get('/mobile/releases/latest', async (c) => {
  const currentVersionCode = Number.parseInt(c.req.query('versionCode') || '', 10);
  if (!Number.isInteger(currentVersionCode) || currentVersionCode < 1) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'versionCode 必须为正整数' } }, 400);
  }
  try {
    const raw = await readFile(process.env.ANDROID_RELEASE_MANIFEST_PATH?.trim() || defaultManifestPath, 'utf8');
    const release = parseAndroidReleaseManifest(JSON.parse(raw));
    if (!release) {
      console.error('Android release manifest is malformed');
      return c.json({ error: { code: 'RELEASE_MANIFEST_INVALID', message: 'Android 更新清单无效' } }, 503);
    }
    if (release.versionCode <= currentVersionCode) return c.body(null, 204);
    c.header('Cache-Control', 'no-store');
    return c.json(release);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return c.body(null, 204);
    console.error('Unable to read Android release manifest:', error);
    return c.json({ error: { code: 'RELEASE_MANIFEST_UNAVAILABLE', message: 'Android 更新清单暂不可用' } }, 503);
  }
});
