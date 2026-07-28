import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertExtensionVersion,
  parseReleaseTag,
  parseStableAndroidManifest,
  resolveAndroidRelease,
  setExtensionVersion,
} from './client-release-version.mjs';

const previous = {
  versionName: '2.0.3',
  versionCode: 203,
  minimumSupportedVersionCode: 203,
};

test('requires a v-prefixed semantic release tag', () => {
  assert.throws(() => parseReleaseTag('2.1.0'), /请使用 "v2\.1\.0"/);
  assert.throws(() => parseReleaseTag('v2.1'), /不合法/);
  assert.deepEqual(parseReleaseTag('v2.1.0-rc.1'), {
    tag: 'v2.1.0-rc.1',
    version: '2.1.0-rc.1',
  });
});

test('parses a valid stable Android manifest and rejects malformed fields', () => {
  assert.deepEqual(parseStableAndroidManifest(JSON.stringify(previous)), previous);
  assert.throws(
    () => parseStableAndroidManifest(JSON.stringify({ ...previous, versionCode: 0 })),
    /versionCode/,
  );
});

test('auto-resolves Android values from the previous stable release', () => {
  assert.deepEqual(
    resolveAndroidRelease({
      buildAndroid: true,
      releaseVersion: '2.1.0',
      versionCodeInput: '',
      minimumSupportedVersionCodeInput: '',
      stableManifest: previous,
    }),
    {
      versionName: '2.1.0',
      versionCode: 204,
      minimumSupportedVersionCode: 203,
      previous,
      suggested: { versionCode: 204, minimumSupportedVersionCode: 203 },
    },
  );
});

test('rejects Android version regressions and missing baseline inputs', () => {
  const base = {
    buildAndroid: true,
    releaseVersion: '2.1.0',
    stableManifest: previous,
  };
  assert.throws(
    () => resolveAndroidRelease({ ...base, versionCodeInput: '203', minimumSupportedVersionCodeInput: '' }),
    /至少应填写 "204"/,
  );
  assert.throws(
    () => resolveAndroidRelease({ ...base, versionCodeInput: '204', minimumSupportedVersionCodeInput: '202' }),
    /不能小于上一最低兼容值 "203"/,
  );
  assert.throws(
    () => resolveAndroidRelease({ ...base, versionCodeInput: '204', minimumSupportedVersionCodeInput: '205' }),
    /不能大于本次 versionCode "204"/,
  );
  assert.throws(
    () => resolveAndroidRelease({
      buildAndroid: true,
      releaseVersion: '2.1.0',
      versionCodeInput: '',
      minimumSupportedVersionCodeInput: '',
      stableManifest: undefined,
    }),
    /未找到可用的上一稳定 Android 更新清单/,
  );
  assert.deepEqual(
    resolveAndroidRelease({ buildAndroid: false, releaseVersion: '2.1.0' }),
    {},
  );
});

test('validates and synchronizes only an extension package version', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'client-release-version-'));
  const packagePath = join(directory, 'package.json');
  await writeFile(packagePath, '{\n  "name": "extension",\n  "version": "0.1.1",\n  "private": true\n}\n');

  assert.throws(
    () => assertExtensionVersion({ packagePath, expectedVersion: '2.1.0' }),
    /当前为 "0\.1\.1"，但 Release 要求 "2\.1\.0"/,
  );
  assert.deepEqual(setExtensionVersion({ packagePath, version: '2.1.0' }), {
    changed: true,
    previousVersion: '0.1.1',
    version: '2.1.0',
  });
  assert.deepEqual(assertExtensionVersion({ packagePath, expectedVersion: '2.1.0' }), { version: '2.1.0' });
  assert.match(await readFile(packagePath, 'utf8'), /"version": "2\.1\.0"/);
});
