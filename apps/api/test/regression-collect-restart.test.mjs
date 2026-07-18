import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('collect persistence can keep MCP inbox saves unarchived while preserving web archive flow', () => {
  const collect = readApi('src/services/collect.service.ts');
  assert.match(collect, /const markArchived = options\.markArchived \?\? true;/);
  assert.match(collect, /isArchived: markArchived,/);
  assert.match(collect, /archivedAt: markArchived \? now : null,/);
  assert.match(collect, /markArchived: options\.sourceType !== 'mcp'/);
});

test('restart script launches detached API and Web processes instead of fragile nohup pnpm dev backgrounds', () => {
  const script = readWorkspace('restart.sh');
  assert.match(script, /start_new_session=True/);
  assert.match(script, /subprocess\.Popen/);
  assert.doesNotMatch(script, /nohup pnpm dev/);
});
