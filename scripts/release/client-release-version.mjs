#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;

function fail(message) {
  throw new Error(message);
}

function parsePositiveInteger(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!/^[1-9][0-9]*$/.test(normalized)) {
    fail(`${fieldName} 必须是正整数。`);
  }
  return Number(normalized);
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`无法读取 ${label}：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseReleaseTag(tag) {
  const normalized = String(tag ?? '').trim();
  if (!RELEASE_TAG_PATTERN.test(normalized)) {
    const suggestion = normalized.startsWith('v') ? 'v2.1.0' : `v${normalized || '2.1.0'}`;
    fail(`Release 标签 "${normalized}" 不合法；请使用 "${suggestion}"，例如 "v2.1.0"。`);
  }
  return { tag: normalized, version: normalized.slice(1) };
}

export function parseStableAndroidManifest(candidate) {
  let manifest;
  try {
    manifest = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
  } catch {
    fail('上一稳定 Android 更新清单不是有效 JSON。');
  }
  if (!manifest || typeof manifest !== 'object') fail('上一稳定 Android 更新清单内容为空。');
  const versionName = typeof manifest.versionName === 'string' ? manifest.versionName.trim() : '';
  if (!versionName) fail('上一稳定 Android 更新清单缺少 versionName。');
  return {
    versionName,
    versionCode: parsePositiveInteger(manifest.versionCode, '上一稳定 Android 更新清单的 versionCode'),
    minimumSupportedVersionCode: parsePositiveInteger(
      manifest.minimumSupportedVersionCode,
      '上一稳定 Android 更新清单的 minimumSupportedVersionCode',
    ),
  };
}

export function resolveAndroidRelease({
  buildAndroid,
  releaseVersion,
  versionCodeInput = '',
  minimumSupportedVersionCodeInput = '',
  stableManifest,
}) {
  if (!buildAndroid) return {};
  const versionName = String(releaseVersion ?? '').trim();
  if (!versionName) fail('无法从 Release 标签推导 Android versionName。');

  const hasStableManifest = stableManifest !== undefined && stableManifest !== null;
  const previous = hasStableManifest ? parseStableAndroidManifest(stableManifest) : undefined;
  const versionCodeProvided = String(versionCodeInput ?? '').trim() !== '';
  const minimumProvided = String(minimumSupportedVersionCodeInput ?? '').trim() !== '';

  if (!previous && (!versionCodeProvided || !minimumProvided)) {
    fail('未找到可用的上一稳定 Android 更新清单；请手动填写 Android versionCode 和最低可继续使用 versionCode。');
  }

  const suggested = previous
    ? {
      versionCode: previous.versionCode + 1,
      minimumSupportedVersionCode: previous.minimumSupportedVersionCode,
    }
    : undefined;
  const versionCode = versionCodeProvided
    ? parsePositiveInteger(versionCodeInput, 'Android versionCode')
    : suggested.versionCode;
  const minimumSupportedVersionCode = minimumProvided
    ? parsePositiveInteger(minimumSupportedVersionCodeInput, 'Android 最低可继续使用 versionCode')
    : suggested.minimumSupportedVersionCode;

  if (previous && versionCode <= previous.versionCode) {
    fail(`Android versionCode "${versionCode}" 必须大于上一稳定版本 "${previous.versionCode}"；至少应填写 "${previous.versionCode + 1}"。`);
  }
  if (previous && minimumSupportedVersionCode < previous.minimumSupportedVersionCode) {
    fail(`Android 最低可继续使用 versionCode "${minimumSupportedVersionCode}" 不能小于上一最低兼容值 "${previous.minimumSupportedVersionCode}"。`);
  }
  if (minimumSupportedVersionCode > versionCode) {
    fail(`Android 最低可继续使用 versionCode "${minimumSupportedVersionCode}" 不能大于本次 versionCode "${versionCode}"。`);
  }

  return {
    versionName,
    versionCode,
    minimumSupportedVersionCode,
    ...(previous ? { previous, suggested } : {}),
  };
}

export function assertExtensionVersion({ packagePath, expectedVersion }) {
  const packageJson = readJsonFile(packagePath, '浏览器插件 package.json');
  const version = typeof packageJson.version === 'string' ? packageJson.version.trim() : '';
  if (!version) fail('浏览器插件 package.json 缺少 version。');
  if (version !== expectedVersion) {
    fail(`浏览器插件版本当前为 "${version}"，但 Release 要求 "${expectedVersion}"；请先运行 Prepare client release version 并合并 PR。`);
  }
  return { version };
}

export function setExtensionVersion({ packagePath, version }) {
  const packageJson = readJsonFile(packagePath, '浏览器插件 package.json');
  const previousVersion = typeof packageJson.version === 'string' ? packageJson.version.trim() : '';
  if (!previousVersion) fail('浏览器插件 package.json 缺少 version。');
  const changed = previousVersion !== version;
  if (changed) {
    packageJson.version = version;
    writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
  return { changed, previousVersion, version };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail(`无效命令行参数：${key ?? ''}`);
    values[key.slice(2)] = value;
  }
  return { command, values };
}

function requireArgument(values, name) {
  const value = values[name];
  if (value === undefined) fail(`缺少 --${name} 参数。`);
  return value;
}

function runCli() {
  const { command, values } = parseArguments(process.argv.slice(2));
  if (command === 'resolve') {
    const { tag, version } = parseReleaseTag(requireArgument(values, 'release-tag'));
    const buildAndroid = requireArgument(values, 'build-android') === 'true';
    const stableManifestPath = values['stable-manifest'];
    const stableManifest = stableManifestPath
      ? parseStableAndroidManifest(readFileSync(stableManifestPath, 'utf8'))
      : undefined;
    const android = resolveAndroidRelease({
      buildAndroid,
      releaseVersion: version,
      versionCodeInput: values['android-version-code'] ?? '',
      minimumSupportedVersionCodeInput: values['minimum-supported-version-code'] ?? '',
      stableManifest,
    });
    process.stdout.write(`${JSON.stringify({ releaseTag: tag, releaseVersion: version, android })}\n`);
    return;
  }
  if (command === 'assert-extension-version') {
    const result = assertExtensionVersion({
      packagePath: requireArgument(values, 'package-path'),
      expectedVersion: requireArgument(values, 'expected-version'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'set-extension-version') {
    const { version } = parseReleaseTag(requireArgument(values, 'release-tag'));
    const result = setExtensionVersion({ packagePath: requireArgument(values, 'package-path'), version });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  fail(`未知命令：${command ?? ''}`);
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
