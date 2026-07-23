import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndroidReleaseManifest } from '../src/services/android-release.service.ts';

test('accepts a complete Android release manifest and rejects malformed release data', () => {
  assert.deepEqual(
    parseAndroidReleaseManifest({
      versionCode: 7,
      versionName: '0.7.0',
      minimumSupportedVersionCode: 6,
      mandatory: false,
      releaseNotes: ['日用版本'],
      apkUrl: 'https://storing.idickies.com/downloads/android/qiankunjie-0.7.0.apk',
      sha256: 'a'.repeat(64),
      publishedAt: '2026-07-23T00:00:00.000Z',
    }),
    {
      versionCode: 7,
      versionName: '0.7.0',
      minimumSupportedVersionCode: 6,
      mandatory: false,
      releaseNotes: ['日用版本'],
      apkUrl: 'https://storing.idickies.com/downloads/android/qiankunjie-0.7.0.apk',
      sha256: 'a'.repeat(64),
      publishedAt: '2026-07-23T00:00:00.000Z',
    },
  );
  assert.equal(parseAndroidReleaseManifest({ versionCode: 0 }), null);
  assert.equal(parseAndroidReleaseManifest({ versionCode: 8, apkUrl: 'http://insecure.example/app.apk' }), null);
});
