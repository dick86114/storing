import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const restartScript = readFileSync(new URL('../../../restart.sh', import.meta.url), 'utf8');

test('force restart terminates stale workspace watcher processes by working directory', () => {
  assert.match(restartScript, /kill_workspace_dev_processes\(\)/);
  assert.match(restartScript, /lsof.*-d.*cwd/);
  assert.match(restartScript, /os\.path\.realpath/);
  assert.match(restartScript, /command\.startswith\('node '\)/);
  assert.match(restartScript, /kill_workspace_dev_processes/);
});
