import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../../packages/shared/src/types.ts', import.meta.url), 'utf8');

test('共享列表类型包含跨端深度报告状态', () => {
  assert.match(source, /export interface ArticleDeepAnalysisSummary/);
  assert.match(source, /status: 'not_generated' \| 'queued' \| 'running' \| 'succeeded' \| 'failed'/);
  assert.match(source, /deepAnalysis\?: ArticleDeepAnalysisSummary \| null/);
});
