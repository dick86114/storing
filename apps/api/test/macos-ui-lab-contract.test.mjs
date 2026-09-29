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
  assert.match(testSource, /uiLabTaskFixturesCoverEveryActionState/);
  assert.match(testSource, /uiLabTaskRowsExposeOnlyAllowedActions/);
});

test('macOS UI Lab 只在 Debug 路由且不触碰生产数据边界', () => {
  const appSource = read('apps/macos/QiankunjieMac/App/QiankunjieApp.swift');
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');

  assert.match(appSource, /#if DEBUG/);
  assert.match(appSource, /UILabScenario\.fromCommandLine/);
  assert.doesNotMatch(fixtureSource, /KeychainSessionStore|(?<!Empty)LibraryCache\(|UserDefaults\.standard|APIClient\(/);
});

test('macOS UI Lab 脚本和文档覆盖十个截图场景', () => {
  const script = read('apps/macos/scripts/macos-ui-lab.sh');
  const guide = read('docs/MacOS-UI-Lab.md');

  assert.match(script, /^set -euo pipefail$/m);
  assert.match(script, /--ui-lab/);
  assert.match(script, /-configuration Debug/);
  assert.match(script, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(script, /artifacts\/macos-ui-lab/);
  assert.match(script, /open -n "\$\{app_path\}" --args --ui-lab "\$\{scenario\}"/);
  assert.doesNotMatch(script, /open -n "\$\{binary_path\}"/);

  for (const scenario of scenarios) {
    assert.match(script, new RegExp(`"${scenario}"`));
    assert.match(guide, new RegExp(`\\\`${scenario}\\\``));
  }

  assert.match(guide, /不.*真实账号/);
  assert.match(guide, /Keychain/);
  assert.match(guide, /SwiftData/);
  assert.match(guide, /截图路径/);
});

test('macOS UI Lab 任务夹具显式解码并暴露允许的任务动作', () => {
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');
  const scenarioSource = read('apps/macos/QiankunjieMac/UILab/UILabScenario.swift');
  const guide = read('docs/MacOS-UI-Lab.md');

  assert.doesNotMatch(fixtureSource, /try\?[\s\S]*\?\? \[\]/);
  assert.match(fixtureSource, /fatalError\("UI Lab 采集任务夹具解码失败/);
  assert.match(fixtureSource, /"pending"/);
  assert.match(fixtureSource, /"running"/);
  assert.match(fixtureSource, /"completed"/);
  assert.match(fixtureSource, /"failed"/);
  assert.match(scenarioSource, /struct UILabTaskActionAvailability/);
  assert.match(scenarioSource, /static func taskActionAvailability/);
  assert.doesNotMatch(scenarioSource, /List\(\s*UILabFixtures\.collectJobs/);

  const taskRow = guide
    .split('\n')
    .find((line) => line.includes('| `tasks` |'));
  assert.match(taskRow ?? '', /`pending`\/`running`\/`completed`\/`failed`/);
  assert.match(taskRow ?? '', /打开文章/);
  assert.match(taskRow ?? '', /重试/);
  assert.match(taskRow ?? '', /删除任务/);
});

test('macOS UI Lab 通过固定仓储驱动生产视图', () => {
  const scenarioSource = read('apps/macos/QiankunjieMac/UILab/UILabScenario.swift');
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');

  assert.match(scenarioSource, /UILabFixtures\.libraryModel/);
  assert.match(scenarioSource, /UILabFixtures\.collectModel/);
  assert.match(scenarioSource, /UILabFixtures\.authModel/);
  assert.match(scenarioSource, /LoginView\(/);
  assert.match(scenarioSource, /CompactArticleListView\(/);
  assert.match(scenarioSource, /CollectView\(/);
  assert.match(scenarioSource, /CollectTasksView\(/);
  assert.doesNotMatch(fixtureSource, /URLRequest|URLSession|KeychainSessionStore|UserDefaults\.standard/);
});

test('macOS UI Lab 设置和更新只使用注入套件与固定更新服务', () => {
  const scenarioSource = read('apps/macos/QiankunjieMac/UILab/UILabScenario.swift');
  const fixtureSource = read('apps/macos/QiankunjieMac/UILab/UILabFixtures.swift');

  assert.match(scenarioSource, /SettingsWindow\(/);
  assert.match(scenarioSource, /updateService: UILabFixtures\.updateService/);
  assert.match(scenarioSource, /updateDefaults: UILabFixtures\.preferences/);
  assert.doesNotMatch(scenarioSource, /SettingsView\(/);
  assert.doesNotMatch(scenarioSource, /UpdateSettingsView\(\)/);
  assert.doesNotMatch(fixtureSource, /UserDefaults\.standard|GitHubUpdateService|URLSession|KeychainSessionStore/);
});
