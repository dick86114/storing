import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const api = read('../src/lib/api.ts');
const content = read('../src/components/content/AiSettingsContent.tsx');
const desktopNav = read('../src/components/layout/DesktopTopNav.tsx');
const mobileNav = read('../src/components/layout/MobileTopNav.tsx');
const card = read('../src/components/article/WechatArticleCard.tsx');
const detail = read('../src/components/article/WechatDetailPanel.tsx');
const aiStatus = read('../src/lib/aiStatus.ts');
const aiSettingsType = api.slice(
  api.indexOf('export type UserAiSettings = {'),
  api.indexOf('export type ArticleAiStatusFields ='),
);

test('AI 设置 API client 覆盖配置、发现、测试和任务', () => {
  for (const method of [
    'getAiSettings:',
    'saveAiSettings:',
    'deleteAiSettings:',
    'discoverAiModels:',
    'testAiSettings:',
    'getAiJobs:',
    'retryAiJob:',
  ]) {
    assert.match(api, new RegExp(method.replace(':', '\\s*:')));
  }
  assert.match(aiSettingsType, /apiKeyConfigured: boolean/);
  assert.match(aiSettingsType, /apiKeyLast4: string \| null/);
  assert.doesNotMatch(aiSettingsType, /apiKeyCiphertext|apiKey:/);
});

test('AI 设置页包含全部配置项、模型发现、测试、删除和任务汇总', () => {
  for (const label of [
    '模型提供商',
    'Base URL',
    'API Key',
    '获取模型',
    '自动触发',
    '保存配置',
    '测试生成',
    '删除配置',
    '最近任务',
  ]) {
    assert.match(content, new RegExp(label));
  }
  assert.match(content, /autoTriggerOnArchive: false/);
  assert.match(content, /apiKeyConfigured/);
  assert.match(content, /apiKeyLast4/);
  assert.match(content, /window\.confirm/);
  assert.match(content, /api\.discoverAiModels\(/);
  assert.match(content, /api\.retryAiJob\(/);
  assert.match(content, /setApiKey\(''\)/);
  assert.match(content, /服务账号/);
});

test('桌面与移动导航都提供 AI 设置入口', () => {
  assert.match(desktopNav, /AI 模型/);
  assert.match(mobileNav, /AI 模型/);
});

test('文章卡片和详情展示七种 AI 状态、失败原因、模型和用量', () => {
  for (const status of [
    'not_generated',
    'disabled',
    'not_configured',
    'queued',
    'running',
    'succeeded',
    'failed',
  ]) {
    assert.match(aiStatus, new RegExp(status));
  }
  assert.match(card, /aiStatusText\(article\.aiStatus\)/);
  assert.doesNotMatch(detail, /detail-panel-ai-status/);
  assert.match(detail, /aiErrorCode/);
  assert.match(detail, /aiErrorMessage/);
  assert.match(detail, /aiModel/);
  assert.match(detail, /aiTotalTokens/);
  assert.match(detail, /handleRegenerateAI\(\)/);
});
