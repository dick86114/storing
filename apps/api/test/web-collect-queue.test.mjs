import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const collectService = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');
const apiIndex = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('web collections are queued and processed with a bounded worker', () => {
  assert.match(collectService, /const WEB_COLLECT_CONCURRENCY = Math\.max\(1, Number\(process\.env\.WEB_COLLECT_CONCURRENCY \|\| 1\)\);/);
  assert.match(collectService, /export function scheduleWebCollectJobs\(\)/);
  assert.match(collectService, /eq\(collectJobs\.requestSource, 'web'\)/);
  assert.match(collectService, /eq\(collectJobs\.status, 'pending'\)/);
  assert.match(collectService, /await processCollectJob\(job\.id\);/);
  assert.match(collectService, /if \(requestSource === 'web'\) \{\s*scheduleWebCollectJobs\(\);[\s\S]*?return job;/);
});

test('API startup resumes interrupted Web and MCP collection jobs instead of leaving them running forever', () => {
  assert.match(collectService, /export async function resumePendingCollectJobs\(\)/);
  assert.match(apiIndex, /await resumePendingCollectJobs\(\)/);
});

test('API startup resumes interrupted MCP collection jobs and schedules them again', () => {
  assert.match(collectService, /export async function resumePendingCollectJobs\(\)/);
  assert.match(collectService, /inArray\(collectJobs\.requestSource, \['web', 'mcp'\]\)/);
  assert.match(collectService, /export function scheduleMcpCollectJobs\(\)/);
  assert.match(collectService, /if \(requestSource === 'web'\) \{\s*scheduleWebCollectJobs\(\);\s*\} else if \(requestSource === 'mcp'\) \{\s*scheduleMcpCollectJobs\(\);/);
  assert.match(apiIndex, /await resumePendingCollectJobs\(\)/);
});
