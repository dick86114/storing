import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReleaseAccessError, loadRemoteAndroidReleaseManifest } from '../src/services/android-release.service.ts';

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

test('使用 GitHub 令牌读取 Release 清单，但绝不把令牌带到公开资产下载', async () => {
  const manifest = {
    versionCode: 9,
    versionName: '0.9.0',
    minimumSupportedVersionCode: 8,
    mandatory: false,
    releaseNotes: ['GitHub Release'],
    apkUrl: 'https://github.com/dick86114/storing/releases/download/android-v0.9.0/qiankunjie-v0.9.0.apk',
    sha256: 'b'.repeat(64),
    publishedAt: '2026-10-28T00:00:00.000Z',
  };
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const release = await loadRemoteAndroidReleaseManifest(
    'https://github.com/dick86114/storing/releases/download/android-latest/latest.json',
    async (url, init) => {
      requests.push({
        url,
        authorization: new Headers(init?.headers).get('Authorization'),
      });
      if (url === 'https://api.github.com/repos/dick86114/storing/releases/tags/android-latest') {
        return new Response(JSON.stringify({
          assets: [{
            name: 'latest.json',
            browser_download_url: 'https://github.com/dick86114/storing/releases/download/android-latest/latest.json',
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify(manifest), { status: 200 });
    },
    'ghp_test_token',
  );

  assert.equal(release.versionCode, 9);
  assert.deepEqual(requests, [
    {
      url: 'https://api.github.com/repos/dick86114/storing/releases/tags/android-latest',
      authorization: 'Bearer ghp_test_token',
    },
    {
      url: 'https://github.com/dick86114/storing/releases/download/android-latest/latest.json',
      authorization: null,
    },
  ]);
});

test('GitHub 令牌失效时返回可识别的凭据错误', async () => {
  await assert.rejects(
    () => loadRemoteAndroidReleaseManifest(
      'https://github.com/dick86114/storing/releases/download/android-latest/latest.json',
      async () => new Response('{}', { status: 401 }),
      'ghp_expired',
    ),
    (error) => error instanceof GitHubReleaseAccessError && error.kind === 'token',
  );
});
