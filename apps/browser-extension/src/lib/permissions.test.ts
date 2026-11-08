import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestServerPermission } from './permissions';

const apiBase = 'https://storing.example.com/api/v1';
const origin = 'https://storing.example.com/*';

describe('requestServerPermission', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { lastError: undefined },
      permissions: {
        contains: vi.fn(),
        request: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('在 Promise 不回调时通过实际权限状态恢复流程', async () => {
    vi.useFakeTimers();
    vi.mocked(chrome.permissions.contains).mockImplementation((_details, callback) => {
      callback(true);
    });
    vi.mocked(chrome.permissions.request).mockImplementation(() => undefined);

    const promise = requestServerPermission(apiBase);
    await vi.advanceTimersByTimeAsync(80);

    await expect(promise).resolves.toBe(true);
  });
});
