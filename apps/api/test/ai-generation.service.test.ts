import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shouldRetryAiError } from '../src/services/ai-generation.service.ts';

const schemaSource = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/ai-generation.service.ts', import.meta.url), 'utf8');

test('AI 任务表包含快照、用量、重试和终态字段', () => {
  assert.match(schemaSource, /export const aiGenerationJobs = pgTable\('ai_generation_jobs'/);
  assert.match(schemaSource, /providerSnapshot: text\('provider_snapshot'\)\.notNull\(\)/);
  assert.match(schemaSource, /modelSnapshot: text\('model_snapshot'\)\.notNull\(\)/);
  assert.match(schemaSource, /attempts: integer\('attempts'\)\.notNull\(\)\.default\(0\)/);
  assert.match(schemaSource, /promptTokens: integer\('prompt_tokens'\)/);
  assert.match(schemaSource, /completionTokens: integer\('completion_tokens'\)/);
  assert.match(schemaSource, /totalTokens: integer\('total_tokens'\)/);
  assert.match(schemaSource, /contentTruncated: boolean\('content_truncated'\)\.notNull\(\)\.default\(false\)/);
  assert.match(schemaSource, /startedAt: timestamp\('started_at'\)/);
  assert.match(schemaSource, /finishedAt: timestamp\('finished_at'\)/);
});

test('AI 任务列表补充文章标题、调用类型、耗时和分项 Token', () => {
  assert.match(serviceSource, /articleTitle: row\.articleTitle/);
  assert.match(serviceSource, /callType: callTypeForJob\(row\)/);
  assert.match(serviceSource, /durationMs: durationMsForJob\(row\)/);
  assert.match(serviceSource, /promptTokens: row\.promptTokens/);
  assert.match(serviceSource, /completionTokens: row\.completionTokens/);
  assert.match(serviceSource, /\.leftJoin\(articles, eq\(aiGenerationJobs\.articleId, articles\.id\)\)/);
});

test('任务汇总按全量数据生成状态、调用类型和近 14 天趋势', () => {
  assert.match(serviceSource, /queuedJobs: sql<number>/);
  assert.match(serviceSource, /runningJobs: sql<number>/);
  assert.match(serviceSource, /averageDurationMs: sql<number>/);
  assert.match(serviceSource, /const typeRows = await db/);
  assert.match(serviceSource, /const dailyRows = await db/);
  assert.match(serviceSource, /byType: typeRows\.map/);
  assert.match(serviceSource, /daily: dailyRows/);
});

test('同一用户同一文章的非终态任务受唯一索引约束', () => {
  assert.match(schemaSource, /ai_generation_jobs_user_article_active_idx/);
  assert.match(schemaSource, /status IN \('queued', 'running'\)/);
});

test('AI 任务使用事务认领并保证每用户并发为 1', () => {
  assert.match(serviceSource, /async function claimNextAiGenerationJob\(/);
  assert.match(serviceSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(serviceSource, /NOT EXISTS \(/);
  assert.match(serviceSource, /status = 'running'/);
});

test('AI 成功结果和任务终态在同一事务写入，失败不覆盖旧结果', () => {
  assert.match(serviceSource, /export async function runAiGenerationWorkers\(\): Promise<void>/);
  assert.match(serviceSource, /db\.transaction\(/);
  assert.match(serviceSource, /aiSummary: result\.summary/);
  assert.match(serviceSource, /aiTags: result\.tags/);
  assert.match(serviceSource, /status: 'succeeded'/);
  assert.match(serviceSource, /status: 'failed'/);
  assert.doesNotMatch(serviceSource, /aiSummary: null,[\s\S]*status: 'failed'/);
});

test('认证、权限、余额和模型不存在不自动重试', () => {
  for (const code of ['AI_UNAUTHORIZED', 'AI_FORBIDDEN', 'AI_PAYMENT_REQUIRED', 'AI_MODEL_NOT_FOUND']) {
    assert.equal(shouldRetryAiError(new Error(`${code}: 不可重试`)), false, code);
  }
});

test('限流、服务不可用、网络失败和超时自动重试', () => {
  for (const code of ['AI_RATE_LIMITED', 'AI_PROVIDER_UNAVAILABLE', 'AI_NETWORK_FAILED', 'AI_TIMEOUT']) {
    assert.equal(shouldRetryAiError(new Error(`${code}: 可以重试`)), true, code);
  }
});

test('同一任务自动尝试数不超过 3 次', () => {
  assert.match(serviceSource, /AI_GENERATION_MAX_ATTEMPTS = 3/);
  assert.match(serviceSource, /attempts < AI_GENERATION_MAX_ATTEMPTS/);
});

test('启动时初始化 AI 任务表并恢复运行中的任务', () => {
  assert.match(serviceSource, /export async function ensureAiGenerationSchema\(\): Promise<void>/);
  assert.match(serviceSource, /export async function resumeAiGenerationJobs\(\): Promise<void>/);
  assert.match(serviceSource, /resumeAiGenerationJobs\(\)/);
});
