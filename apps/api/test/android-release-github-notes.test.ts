import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGitHubReleaseNotes, extractGitHubReleaseTag } from '../src/services/android-release.service.ts';

test('从 Android APK 下载地址提取 GitHub Release tag 并读取 Markdown body', async () => {
  const apkUrl = 'https://github.com/dick86114/storing/releases/download/v0.9.0/Qiankunjie-v0.9.0-universal-release.apk';
  assert.equal(extractGitHubReleaseTag(apkUrl), 'v0.9.0');
  const notes = await loadGitHubReleaseNotes(apkUrl, async (url) => {
    assert.equal(url, 'https://api.github.com/repos/dick86114/storing/releases/tags/v0.9.0');
    return new Response(JSON.stringify({ body: '## 本次更新\n\n- 支持 **进度条**' }), { status: 200 });
  });
  assert.equal(notes, '## 本次更新\n\n- 支持 **进度条**');
});

test('Android 更新日志请求会使用客户端 GitHub 令牌', async () => {
  const apkUrl = 'https://github.com/dick86114/storing/releases/download/v0.9.0/Qiankunjie-v0.9.0-universal-release.apk';
  const notes = await loadGitHubReleaseNotes(apkUrl, async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer github_pat_test');
    assert.equal(headers.get('Accept'), 'application/vnd.github+json');
    return new Response(JSON.stringify({ body: '## 已认证' }), { status: 200 });
  }, 'github_pat_test');
  assert.equal(notes, '## 已认证');
});
