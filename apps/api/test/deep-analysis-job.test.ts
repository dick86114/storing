import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { shouldRetryDeepAnalysisError } from '../src/services/deep-analysis.service.ts';

const serviceSource = readFileSync(
  new URL('../src/services/deep-analysis.service.ts', import.meta.url),
  'utf8',
);
const routeSource = readFileSync(
  new URL('../src/routes/deep-analysis.ts', import.meta.url),
  'utf8',
);

test('深度任务复用活动任务且每用户串行执行', () => {
  assert.match(serviceSource, /sql`\$\{articleDeepAnalyses\.status\} IN \('queued', 'running'\)`/);
  assert.match(serviceSource, /if \(activeJob\)/);
  assert.match(serviceSource, /return \{ jobId: activeJob\.id, status: activeJob\.status as DeepAnalysisStatus \}/);
  assert.match(serviceSource, /startWorkers\(\)/);
  assert.match(serviceSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(serviceSource, /running\.user_id = article_deep_analyses\.user_id/);
  assert.match(serviceSource, /running\.status = 'running'/);
});

test('认证和模型错误不重试，限流与网络错误重试', () => {
  for (const code of ['AI_UNAUTHORIZED', 'AI_FORBIDDEN', 'AI_PAYMENT_REQUIRED', 'AI_MODEL_NOT_FOUND']) {
    assert.equal(shouldRetryDeepAnalysisError(new Error(`${code}: 不重试`)), false, code);
  }
  for (const code of ['AI_RATE_LIMITED', 'AI_PROVIDER_UNAVAILABLE', 'AI_NETWORK_FAILED', 'AI_TIMEOUT']) {
    assert.equal(shouldRetryDeepAnalysisError(new Error(`${code}: 重试`)), true, code);
  }
});

test('深度任务最多尝试三次且失败保留当前报告', () => {
  assert.match(serviceSource, /DEEP_ANALYSIS_MAX_ATTEMPTS = 3/);
  assert.match(serviceSource, /attempts < DEEP_ANALYSIS_MAX_ATTEMPTS/);
  assert.match(serviceSource, /status: 'failed'/);
  assert.doesNotMatch(serviceSource, /reportJson: null,[\s\S]*status: 'failed'/);
});

test('新报告成功后原子切换当前版本', () => {
  assert.match(serviceSource, /db\.transaction\(/);
  assert.match(serviceSource, /isCurrent: true/);
  assert.match(serviceSource, /isCurrent: false/);
});

test('深度任务执行不访问普通文章元数据表', () => {
  assert.doesNotMatch(serviceSource, /articleMetadata/);
  assert.doesNotMatch(serviceSource, /aiStatus/);
});

test('任务队列函数签名满足跨端服务契约', () => {
  assert.match(serviceSource, /export async function enqueueDeepAnalysis\(\s*userId: number,\s*articleId: number,/);
  assert.match(serviceSource, /export async function runDeepAnalysisWorkers\(\): Promise<void>/);
  assert.match(serviceSource, /export async function resumeDeepAnalysisJobs\(\): Promise<void>/);
  assert.match(serviceSource, /export async function retryDeepAnalysisJob\(userId: number, jobId: number\): Promise<void>/);
});

test('AI 加密密钥异常时返回可操作的重新保存提示', () => {
  assert.match(routeSource, /USER_AI_ENCRYPTION_KEY_MISSING/);
  assert.match(routeSource, /USER_AI_SECRET_DECRYPT_FAILED/);
  assert.match(routeSource, /请到设置页重新保存模型 API Key/);
  assert.match(routeSource, /aiSecretInvalid \? 409 : 422/);
});
