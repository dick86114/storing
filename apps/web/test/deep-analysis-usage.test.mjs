import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8');
const page = read('src/components/article/DeepAnalysisReportPage.tsx');
const report = read('src/lib/deepAnalysisReport.ts');
const css = read('src/app/globals.css');

test('报告页底部展示耗时、Token、调用工具和模型信息', () => {
  assert.match(page, /deep-report-usage/);
  assert.match(page, /formatUsageDuration/);
  assert.match(page, /报告生成耗时/);
  assert.match(page, /调用工具/);
  assert.match(page, /输入\/输出 Token/);
  assert.match(page, /总消耗/);
  assert.match(page, /providerSnapshot/);
  assert.match(page, /durationMs/);
  assert.match(report, /durationMs\?: number \| null/);
  assert.match(report, /providerSnapshot\?: string \| null/);
  assert.match(report, /attempts\?: number \| null/);
  assert.match(css, /\.deep-report-usage/);
});
