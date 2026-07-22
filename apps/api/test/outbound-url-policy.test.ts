import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeOutboundUrl, isPublicIp, normalizeOutboundUrl } from '../src/services/outbound-url-policy.service.ts';

test('outbound policy rejects loopback, private, carrier-grade, and documentation IP ranges', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '192.168.1.1', '198.18.0.1', '203.0.113.1', '::1', 'fd00::1']) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp('8.8.8.8'), true);
});

test('outbound policy rejects non-http URLs and URLs with embedded credentials', () => {
  assert.throws(() => normalizeOutboundUrl('file:///etc/passwd'));
  assert.throws(() => normalizeOutboundUrl('https://user:password@example.com'));
});

test('outbound policy rejects direct private-address URLs before any outbound request', async () => {
  await assert.rejects(assertSafeOutboundUrl('http://127.0.0.1:1052/api/v1/health'));
});
