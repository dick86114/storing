import test from 'node:test';
import assert from 'node:assert/strict';
import { releasesRoutes } from '../src/routes/releases.ts';

test('Android 更新路由把无效 GitHub 令牌映射为可识别的 424 错误', async () => {
  const originalFetch = globalThis.fetch;
  const originalManifestURL = process.env.ANDROID_RELEASE_MANIFEST_URL;
  process.env.ANDROID_RELEASE_MANIFEST_URL =
    'https://github.com/dick86114/storing/releases/download/android-latest/latest.json';
  globalThis.fetch = async (input, init) => {
    assert.equal(
      String(input),
      'https://api.github.com/repos/dick86114/storing/releases/tags/android-latest',
    );
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer ghp_expired');
    return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
  };

  try {
    const response = await releasesRoutes.request(
      'http://localhost/mobile/releases/latest?versionCode=1',
      { headers: { 'X-GitHub-Token': 'ghp_expired' } },
    );

    assert.equal(response.status, 424);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'GITHUB_TOKEN_INVALID',
        message: 'GitHub 令牌无效或已过期，请更新后重试',
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalManifestURL === undefined) {
      delete process.env.ANDROID_RELEASE_MANIFEST_URL;
    } else {
      process.env.ANDROID_RELEASE_MANIFEST_URL = originalManifestURL;
    }
  }
});
