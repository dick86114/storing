type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type LoginAttempt = {
  failures: number;
  resetAt: number;
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const attempts = new Map<string, LoginAttempt>();

function evictExpired(now: number) {
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
}

export function getLoginRateLimitKey(input: { username: string; forwardedFor?: string | null; trustProxy?: boolean }) {
  const username = input.username.trim().toLowerCase();
  const forwardedFor = input.trustProxy ? input.forwardedFor?.split(',')[0]?.trim() : null;
  const client = forwardedFor || 'direct';
  return `${client}:${username}`;
}

export function checkLoginRateLimit(key: string, now = Date.now()): LoginRateLimitResult {
  evictExpired(now);
  const attempt = attempts.get(key);
  if (!attempt || attempt.failures < MAX_LOGIN_FAILURES) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)) };
}

export function recordLoginFailure(key: string, now = Date.now()) {
  evictExpired(now);
  const current = attempts.get(key);
  const attempt = current && current.resetAt > now
    ? current
    : { failures: 0, resetAt: now + LOGIN_WINDOW_MS };
  attempt.failures += 1;
  attempts.set(key, attempt);
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

export function resetLoginRateLimitsForTest() {
  attempts.clear();
}
