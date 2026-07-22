import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const collect = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');

test('collect worker atomically claims a pending job before processing it', () => {
  const processJob = collect.match(/export async function processCollectJob\(jobId: number\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(processJob, 'processCollectJob should exist');
  assert.match(processJob, /db\s*\.update\(collectJobs\)/);
  assert.match(processJob, /eq\(collectJobs\.status, 'pending'\)/);
  assert.match(processJob, /\.returning\(\)/);
});

test('a completed collect job clears stale worker errors', () => {
  const completions = collect.match(/await updateCollectJob\(jobId, \{[\s\S]{0,260}?status: 'completed',[\s\S]{0,260}?\}\);/g) ?? [];
  assert.ok(completions.length >= 4, 'all collect completion paths should be covered');
  for (const completion of completions) {
    assert.match(completion, /stage: 'completed'/);
    assert.match(completion, /error: null/);
  }
});
