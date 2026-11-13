import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  attachDeepAnalysisSummaries,
  ensureDeepAnalysisSchema,
  getDeepAnalysisSummary,
} from '../src/services/deep-analysis.service.ts';

const schemaSource = readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(
  new URL('../src/services/deep-analysis.service.ts', import.meta.url),
  'utf8',
);
const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('深度报告模型包含报告、审计、指纹、版本和当前标记', () => {
  assert.match(schemaSource, /export const articleDeepAnalyses = pgTable\('article_deep_analyses'/);
  assert.match(schemaSource, /reportJson: jsonb\('report_json'\)/);
  assert.match(schemaSource, /reportMarkdown: text\('report_markdown'\)/);
  assert.match(schemaSource, /contentHash: text\('content_hash'\)\.notNull\(\)/);
  assert.match(schemaSource, /isCurrent: boolean\('is_current'\)\.notNull\(\)\.default\(false\)/);
  assert.match(schemaSource, /version: integer\('version'\)\.notNull\(\)\.default\(1\)/);
  assert.match(schemaSource, /modelSnapshot: text\('model_snapshot'\)\.notNull\(\)/);
  assert.match(schemaSource, /promptTokens: integer\('prompt_tokens'\)/);
  assert.match(schemaSource, /completionTokens: integer\('completion_tokens'\)/);
  assert.match(schemaSource, /totalTokens: integer\('total_tokens'\)/);
  assert.match(schemaSource, /contentTruncated: boolean\('content_truncated'\)\.notNull\(\)\.default\(false\)/);
  assert.match(schemaSource, /attempts: integer\('attempts'\)\.notNull\(\)\.default\(0\)/);
});

test('深度报告活动任务与列表状态查询有唯一索引', () => {
  assert.match(schemaSource, /article_deep_analyses_user_article_active_idx/);
  assert.match(schemaSource, /status IN \('queued', 'running'\)/);
  assert.match(schemaSource, /article_deep_analyses_user_status_idx/);
});

test('同一报告状态不写入普通文章摘要状态', () => {
  assert.doesNotMatch(serviceSource, /aiStatus/);
  assert.doesNotMatch(serviceSource, /articleMetadata/);
  assert.match(serviceSource, /export type DeepAnalysisStatus/);
});

test('启动时初始化深度报告模型', () => {
  assert.match(indexSource, /ensureDeepAnalysisSchema/);
});

test('批量查询会去重文章 ID', async () => {
  await ensureDeepAnalysisSchema();
  const result = await attachDeepAnalysisSummaries(11, [1, 1, 2]);
  assert.equal(result.size, 2);
  assert.deepEqual([...result.keys()].sort((a, b) => a - b), [1, 2]);
  assert.equal(result.get(1)?.status, 'not_generated');
});

test('单篇文章无报告返回 not_generated', async () => {
  await ensureDeepAnalysisSchema();
  const summary = await getDeepAnalysisSummary(11, 999999);
  assert.equal(summary.hasDeepAnalysis, false);
  assert.equal(summary.status, 'not_generated');
  assert.equal(summary.version, null);
  assert.equal(summary.stale, false);
  assert.equal(summary.errorCode, null);
});
