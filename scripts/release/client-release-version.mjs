#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;
export const STABLE_VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function fail(message) { throw new Error(message); }

function readPackage(packagePath) {
  try { return JSON.parse(readFileSync(packagePath, 'utf8')); }
  catch (error) { fail(`无法读取浏览器插件 package.json：${error instanceof Error ? error.message : String(error)}`); }
}

export function parseReleaseTag(tag) {
  const value = String(tag ?? '').trim();
  if (!RELEASE_TAG_PATTERN.test(value)) fail(`Release 标签 "${value}" 不合法；请使用例如 "v2.1.0" 的格式。`);
  return { tag: value, version: value.slice(1) };
}

export function bumpPatchVersion(version) {
  const value = String(version ?? '').trim();
  const match = STABLE_VERSION_PATTERN.exec(value);
  if (!match) fail(`浏览器插件版本 "${value}" 不是可自动递增的稳定 X.Y.Z 版本；预发布版本请先人工处理。`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function assertExtensionVersion({ packagePath, expectedVersion }) {
  const value = String(readPackage(packagePath).version ?? '').trim();
  if (!value) fail('浏览器插件 package.json 缺少 version。');
  if (value !== expectedVersion) fail(`浏览器插件版本当前为 "${value}"，但预期为 "${expectedVersion}"。`);
  return { version: value };
}

export function setExtensionVersion({ packagePath, version }) {
  const packageJson = readPackage(packagePath);
  const previousVersion = String(packageJson.version ?? '').trim();
  if (!previousVersion) fail('浏览器插件 package.json 缺少 version。');
  const changed = previousVersion !== version;
  if (changed) {
    packageJson.version = version;
    writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
  return { changed, previousVersion, version };
}

function parseArgs(args) {
  const [command, ...rest] = args;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!rest[index]?.startsWith('--') || rest[index + 1] === undefined) fail(`无效命令行参数：${rest[index] ?? ''}`);
    values[rest[index].slice(2)] = rest[index + 1];
  }
  return { command, values };
}

function requireArg(values, name) {
  if (values[name] === undefined) fail(`缺少 --${name} 参数。`);
  return values[name];
}

function runCli() {
  const { command, values } = parseArgs(process.argv.slice(2));
  if (command === 'bump-extension-version') {
    const packagePath = requireArg(values, 'package-path');
    const nextVersion = bumpPatchVersion(readPackage(packagePath).version);
    process.stdout.write(`${JSON.stringify(setExtensionVersion({ packagePath, version: nextVersion }))}\n`);
    return;
  }
  if (command === 'bump-patch-version') {
    process.stdout.write(`${bumpPatchVersion(requireArg(values, 'version'))}\n`);
    return;
  }
  if (command === 'set-extension-version') {
    process.stdout.write(`${JSON.stringify(setExtensionVersion({ packagePath: requireArg(values, 'package-path'), version: requireArg(values, 'version') }))}\n`);
    return;
  }
  if (command === 'assert-extension-version') {
    process.stdout.write(`${JSON.stringify(assertExtensionVersion({ packagePath: requireArg(values, 'package-path'), expectedVersion: requireArg(values, 'expected-version') }))}\n`);
    return;
  }
  if (command === 'parse-release-tag') {
    process.stdout.write(`${JSON.stringify(parseReleaseTag(requireArg(values, 'release-tag')))}\n`);
    return;
  }
  fail(`未知命令：${command ?? ''}`);
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try { runCli(); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
