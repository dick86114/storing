import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeCapturedHtml } from '../src/services/singlefile.service.ts';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getLoginRateLimitKey,
  recordLoginFailure,
  resetLoginRateLimitsForTest,
} from '../src/services/login-rate-limit.service.ts';

test('sanitizeCapturedHtml removes executable markup and unsafe URLs while retaining article content', () => {
  const sanitized = sanitizeCapturedHtml(`
    <article><h1>Safe title</h1><img src="x" onerror="alert(1)">
      <a href="javascript:alert(1)" onclick="alert(1)">unsafe</a>
      <script>alert(1)</script><iframe src="https://evil.example"></iframe>
      <a href="https://example.com" target="_blank">safe link</a>
    </article>
  `);

  assert.match(sanitized, /Safe title/);
  assert.doesNotMatch(sanitized, /<script|<iframe|onerror=|onclick=|javascript:/i);
  assert.match(sanitized, /rel="noopener noreferrer"/);
});

test('login limiter blocks the sixth failed attempt for the same trusted client and account', () => {
  resetLoginRateLimitsForTest();
  const key = getLoginRateLimitKey({ username: 'Admin', forwardedFor: '203.0.113.11', trustProxy: true });
  for (let i = 0; i < 5; i += 1) recordLoginFailure(key, 1_000);

  const result = checkLoginRateLimit(key, 1_001);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.ok(result.retryAfterSeconds > 0);

  clearLoginFailures(key);
  assert.deepEqual(checkLoginRateLimit(key, 1_001), { allowed: true });
});

test('login limiter ignores attacker-controlled forwarding headers unless proxy trust is enabled', () => {
  const key = getLoginRateLimitKey({ username: 'Admin', forwardedFor: '203.0.113.11', trustProxy: false });
  assert.equal(key, 'direct:admin');
});
