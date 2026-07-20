import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const singleFileService = readFileSync(new URL('../src/services/singlefile.service.ts', import.meta.url), 'utf8');

function getRunSingleFileImplementation() {
  const match = singleFileService.match(/export async function runSingleFile\([\s\S]*?\n}\n\nfunction extractTitle/);
  assert.ok(match, 'runSingleFile implementation should be present');
  return match[0];
}

test('SingleFile continues to the next strategy when a capture is a verification or shell page', () => {
  const implementation = getRunSingleFileImplementation();

  assert.match(implementation, /for \(const strategy of getSingleFileCandidateStrategies\(\)\)/);
  assert.match(implementation, /const validation = validateCapturedHtml\(result\.html, url\);/);
  assert.match(implementation, /if \(!validation\.ok\) \{[\s\S]*continue;/);
  assert.match(implementation, /return result;/);
});
