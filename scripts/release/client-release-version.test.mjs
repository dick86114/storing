import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertExtensionVersion, bumpPatchVersion, parseReleaseTag, setExtensionVersion } from './client-release-version.mjs';

test('validates Android release tags', () => {
  assert.deepEqual(parseReleaseTag('v2.1.0'), { tag: 'v2.1.0', version: '2.1.0' });
  assert.throws(() => parseReleaseTag('2.1.0'), /不合法/);
});

test('increments only stable browser extension patch versions', () => {
  assert.equal(bumpPatchVersion('0.1.1'), '0.1.2');
  assert.equal(bumpPatchVersion('2.1.9'), '2.1.10');
  assert.throws(() => bumpPatchVersion('2.1.0-rc.1'), /预发布版本/);
});

test('updates and asserts the browser extension package version', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'browser-release-'));
  const packagePath = join(directory, 'package.json');
  await writeFile(packagePath, '{\n  "name": "extension",\n  "version": "0.1.1"\n}\n');
  assert.deepEqual(setExtensionVersion({ packagePath, version: '0.1.2' }), { changed: true, previousVersion: '0.1.1', version: '0.1.2' });
  assert.deepEqual(assertExtensionVersion({ packagePath, expectedVersion: '0.1.2' }), { version: '0.1.2' });
  assert.match(await readFile(packagePath, 'utf8'), /"version": "0\.1\.2"/);
});

test('workflows and documentation describe split release flows', async () => {
  const [android, extension, doc] = await Promise.all([
    readFile('.github/workflows/release-android.yml', 'utf8'),
    readFile('.github/workflows/release-browser-extension.yml', 'utf8'),
    readFile('docs/Client-GitHub-Release-Automation.md', 'utf8'),
  ]);
  for (const text of ['Release Android APK', 'android_version_name:', 'android_version_code:', 'minimum_supported_version_code:']) assert.match(android, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const text of ['Release browser extension', 'bump-extension-version', 'git push origin HEAD:master', 'browser-extension-v${VERSION}']) assert.match(extension, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const text of ['Release Android APK', 'Release browser extension', '自动递增补丁版本']) assert.match(doc, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
