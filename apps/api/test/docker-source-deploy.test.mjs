import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const compose = readFileSync(new URL('../../../docker-compose.yml', import.meta.url), 'utf8');
const deployScript = readFileSync(new URL('../../../deploy-docker.sh', import.meta.url), 'utf8');

test('production compose can build the API image from the checked-out source', () => {
  assert.match(compose, /storing:\n(?:.|\n)*?build:\n\s+context: \./);
});

test('deployment rebuilds and recreates services instead of trusting a stale latest tag', () => {
  assert.match(deployScript, /docker-compose build --pull storing singlefile/);
  assert.match(deployScript, /docker-compose up -d --force-recreate --remove-orphans/);
});
