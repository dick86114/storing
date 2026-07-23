import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRemoteAndroidReleaseManifest } from '../src/services/android-release.service.ts';

test('loads and validates a GitHub-hosted Android release manifest over HTTPS', async () => {
  const release = await loadRemoteAndroidReleaseManifest(
    'https://github.com/dick86114/storing/releases/latest/download/latest.json',
    async (url) => {
      assert.equal(url, 'https://github.com/dick86114/storing/releases/latest/download/latest.json');
      return new Response(JSON.stringify({
        versionCode: 8,
        versionName: '0.8.0',
        minimumSupportedVersionCode: 7,
        mandatory: false,
        releaseNotes: ['GitHub Release'],
        apkUrl: 'https://github.com/dick86114/storing/releases/download/android-v0.8.0/qiankunjie-v0.8.0.apk',
        sha256: 'a'.repeat(64),
        publishedAt: '2026-07-23T00:00:00.000Z',
      }), { status: 200 });
    },
  );

  assert.equal(release?.versionCode, 8);
  assert.equal(release?.versionName, '0.8.0');
});

test('rejects a non-HTTPS manifest endpoint before making a network request', async () => {
  await assert.rejects(
    () => loadRemoteAndroidReleaseManifest('http://github.com/latest.json', async () => new Response('{}')),
    /HTTPS/,
  );
});
