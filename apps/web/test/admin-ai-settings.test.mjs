import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const api = read('../src/lib/api.ts');
const content = read('../src/components/content/UserManagementContent.tsx');

test('管理员 API client 提供读取、保存和测试用户 AI 配置', () => {
  for (const method of [
    'getAdminUserAiSettings:',
    'saveAdminUserAiSettings:',
    'discoverAdminUserAiModels:',
    'testAdminUserAiSettings:',
  ]) {
    assert.match(api, new RegExp(method.replace(':', '\\s*:')));
  }
});

test('用户管理提供 AI 配置入口和服务账号代配置提示', () => {
  for (const label of [
    'AI 配置',
    '管理员代配置 AI 模型',
    '服务账号可由管理员代配置 AI 模型。',
    '模型提供商',
    'Base URL',
    'API Key',
    '获取模型',
    '模型',
    '自动触发',
    '保存配置',
    '测试生成',
  ]) {
    assert.match(content, new RegExp(label));
  }
  assert.match(content, /openAiSettingsModal\(item\)/);
  assert.match(content, /aiSettingsUser\.role === 'service'/);
});

test('管理员代配置弹窗输入 Key 但不回显明文', () => {
  assert.match(content, /type="password"/);
  assert.match(content, /value=\{aiForm\.apiKey\}/);
  assert.match(content, /apiKeyConfigured/);
  assert.match(content, /apiKeyLast4/);
  assert.doesNotMatch(content, /<(span|p|strong|div)>\{aiForm\.apiKey\}/);
  assert.doesNotMatch(content, /<(span|p|strong|div)>\{aiSettings\.apiKey\}/);
});
