import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../src/routes/ai.ts', import.meta.url), 'utf8');
const settingsService = readFileSync(new URL('../src/services/user-ai-settings.service.ts', import.meta.url), 'utf8');
const aiGeneration = readFileSync(new URL('../src/services/ai-generation.service.ts', import.meta.url), 'utf8');
const mcpRouteSource = readFileSync(new URL('../src/routes/mcp.ts', import.meta.url), 'utf8');
const collectService = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');

const getRoute = () => routeSource.match(/aiRoutes\.get\('\/ai\/admin\/users\/:userId\/settings'[\s\S]*?\n\}\);/)?.[0] ?? '';
const putRoute = () => routeSource.match(/aiRoutes\.put\('\/ai\/admin\/users\/:userId\/settings'[\s\S]*?\n\}\);/)?.[0] ?? '';
const testRoute = () => routeSource.match(/aiRoutes\.post\('\/ai\/admin\/users\/:userId\/settings\/test'[\s\S]*?\n\}\);/)?.[0] ?? '';
const discoverRoute = () => routeSource.match(/aiRoutes\.post\('\/ai\/admin\/users\/:userId\/models\/discover'[\s\S]*?\n\}\);/)?.[0] ?? '';

test('管理员代配置路由仅管理员可用并覆盖读取、保存和测试', () => {
  for (const route of [getRoute(), putRoute(), testRoute()]) {
    assert.ok(route, '管理员 AI 配置路由应存在');
    assert.match(route, /requireAdmin/);
  }
});

test('管理员配置响应只返回摘要且不暴露明文 Key 或密文', () => {
  const route = `${getRoute()}\n${putRoute()}\n${testRoute()}`;

  assert.match(route, /getUserAiSettingsSummary\(userId\)/);
  assert.match(route, /saveUserAiSettings\(userId/);
  assert.match(route, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.doesNotMatch(route, /apiKeyCiphertext|decryptSecret|settings\.apiKey\b/);
});

test('管理员保存时校验目标用户、审计操作且审计不记录 Key', () => {
  const route = putRoute();
  const auditDetail = route.match(/detail: \{[\s\S]*?\n\s{6}\}/)?.[0] ?? '';

  assert.match(route, /findAdminAiTargetUser\(userId\)/);
  assert.match(route, /USER_NOT_FOUND/);
  assert.match(route, /writeAdminAudit\(/);
  assert.match(route, /action: 'admin_user_ai_settings_updated'/);
  assert.match(route, /provider: parsed\.data\.provider/);
  assert.match(route, /model: parsed\.data\.model/);
  assert.match(route, /autoTriggerOnArchive: parsed\.data\.autoTriggerOnArchive/);
  assert.match(auditDetail, /apiKeyUpdated: Boolean\(parsed\.data\.apiKey\?\.trim\(\)\)/);
  assert.doesNotMatch(auditDetail, /apiKey:\s*(parsed|input|body)/);
});

test('管理员配置测试校验目标用户并支持未保存的新 Key', () => {
  const route = testRoute();

  assert.match(route, /findAdminAiTargetUser\(userId\)/);
  assert.match(route, /USER_NOT_FOUND/);
  assert.match(route, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(route, /assertUserAiProvider\(/);
  assert.match(route, /assertSafeAiBaseUrl\(/);
});

test('目标用户模型发现仅管理员可用且优先使用用户配置', () => {
  const route = discoverRoute();

  assert.match(route, /requireAdmin/);
  assert.match(route, /findAdminAiTargetUser\(userId\)/);
  assert.match(route, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(route, /listAiModels\(config\)/);
});

test('Key 留空时继续复用用户现有密文', () => {
  const saveFunction = settingsService.slice(
    settingsService.indexOf('export async function saveUserAiSettings'),
    settingsService.indexOf('export async function deleteUserAiSettings'),
  );

  assert.match(saveFunction, /apiKey \? await encryptSecret\(apiKey\) : current\?\.apiKeyCiphertext/);
  assert.match(saveFunction, /apiKeyLast4: apiKey \? apiKey\.slice\(-4\) : current\?\.apiKeyLast4/);
});

test('MCP 显式摘要使用 owner 配置且不创建文章 AI 任务', () => {
  const summarizeRoute = mcpRouteSource.match(/mcpRoutes\.post\('\/mcp\/summarize'[\s\S]*?\n\}\);/)?.[0] ?? '';
  const collectRoute = mcpRouteSource.match(/mcpRoutes\.post\('\/mcp\/collect'[\s\S]*?\n\}\);/)?.[0] ?? '';

  assert.match(summarizeRoute, /resolveUserAiRuntimeConfig\(client\.ownerUserId\)/);
  assert.match(summarizeRoute, /AI_NOT_CONFIGURED/);
  assert.match(summarizeRoute, /userId: client\.ownerUserId/);
  assert.doesNotMatch(summarizeRoute, /enqueueAiGeneration|queueArchiveAiIfNeeded/);
  assert.doesNotMatch(collectRoute, /resolveUserAiRuntimeConfig|enqueueAiGeneration|queueArchiveAiIfNeeded/);
});

test('MCP 摘要结果只写任务 resultJson，不改文章 AI 元数据', () => {
  const summaryOnly = collectService.slice(
    collectService.indexOf('async function finishArticleSideEffects'),
    collectService.indexOf('async function processWechatJob'),
  );

  assert.match(summaryOnly, /buildArticleSummaryResult\(articleId, options\.userId\)/);
  assert.match(summaryOnly, /resultJson:/);
  assert.doesNotMatch(summaryOnly, /articleMetadata|aiStatus|aiSummary/);
});

test('等待接口返回既有任务结构不变', () => {
  const statusRoute = mcpRouteSource.match(/mcpRoutes\.get\('\/mcp\/jobs\/:id'[\s\S]*?\n\}\);/)?.[0] ?? '';

  assert.match(statusRoute, /wait_seconds/);
  assert.match(statusRoute, /serializeMcpJob\(job\)/);
});

test('AI 生成完成时 MCP 摘要任务不写文章元数据', () => {
  assert.match(aiGeneration, /export function shouldWriteArticleAiMetadata\(triggerType: AiGenerationTrigger\)/);
  assert.match(aiGeneration, /return triggerType !== 'mcp_summary'/);
  assert.match(aiGeneration, /if \(shouldWriteArticleAiMetadata\(job\.triggerType as AiGenerationTrigger\)\)/);
});
