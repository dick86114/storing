import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8');

const scenarios = [
  'login',
  'library',
  'empty',
  'loading',
  'offline',
  'reader',
  'collect',
  'tasks',
  'settings',
  'update',
];

test('macOS UI Lab 固定全部核心验收场景', () => {
  const scenarioSource = read('apps/macos/QiankunjieMac/UILab/UILabScenario.swift');
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');
  const testSource = read('apps/macos/QiankunjieMacTests/UILabTests.swift');

  for (const scenario of scenarios) {
    assert.match(scenarioSource, new RegExp(`case ${scenario}\\b`));
  }
  assert.match(scenarioSource, /SWIFT_STRICT_CONCURRENCY|Sendable/);
  assert.match(fixtureSource, /static let article/);
  assert.match(fixtureSource, /id: 1001/);
  assert.match(fixtureSource, /static let user/);
  assert.match(fixtureSource, /id: 9001/);
  assert.match(testSource, /uiLabCoversEveryCoreScenario/);
});

test('macOS UI Lab 只在 Debug 路由且不触碰生产数据边界', () => {
  const appSource = read('apps/macos/QiankunjieMac/App/QiankunjieApp.swift');
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');

  assert.match(appSource, /#if DEBUG/);
  assert.match(appSource, /UILabScenario\.fromCommandLine/);
  assert.doesNotMatch(fixtureSource, /KeychainSessionStore|LibraryCache\(|UserDefaults\.standard|APIClient\(/);
});

test('macOS UI Lab 脚本和文档覆盖十个截图场景', () => {
  const script = read('apps/macos/scripts/macos-ui-lab.sh');
  const guide = read('docs/MacOS-UI-Lab.md');

  assert.match(script, /^set -euo pipefail$/m);
  assert.match(script, /--ui-lab/);
  assert.match(script, /-configuration Debug/);
  assert.match(script, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(script, /artifacts\/macos-ui-lab/);

  for (const scenario of scenarios) {
    assert.match(script, new RegExp(`"${scenario}"`));
    assert.match(guide, new RegExp(`\\\`${scenario}\\\``));
  }

  assert.match(guide, /不.*真实账号/);
  assert.match(guide, /Keychain/);
  assert.match(guide, /SwiftData/);
  assert.match(guide, /截图路径/);
});
