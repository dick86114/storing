import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('collection validates resolved outbound targets before capture rather than only the input URL string', () => {
  const collect = readApi('src/services/collect.service.ts');
  const singleFile = readApi('src/services/singlefile.service.ts');

  assert.match(collect, /assertSafeOutboundUrl\(normalizedUrl\)/);
  assert.match(singleFile, /resolveSafeCaptureUrl\(url\)/);
  assert.match(singleFile, /assertSafeOutboundUrl\(safeUrl\)/);
});

test('image uploads enforce the same outbound URL policy before downloading article-controlled image URLs', () => {
  const reader = readApi('src/services/reader.service.ts');
  assert.match(reader, /assertSafeOutboundUrl\(imageUrl\)/);
});

test('production deployment keeps API and MCP ports on loopback while preserving the web entrypoint', () => {
  const compose = readWorkspace('docker-compose.yml');
  assert.match(compose, /"127\.0\.0\.1:1052:1052"/);
  assert.match(compose, /"127\.0\.0\.1:1053:1053"/);
});

test('Next production config emits baseline browser security headers and hides framework fingerprinting', () => {
  const config = readWorkspace('apps/web/next.config.ts');
  assert.match(config, /poweredByHeader:\s*false/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /Referrer-Policy/);
});
