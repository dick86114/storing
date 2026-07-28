import { describe, expect, it } from 'vitest';
import { ExtensionAuthError, ExtensionApiClient, type ExtensionSession, type SessionStore } from './api-client';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function createStore(session: ExtensionSession): SessionStore & { current: ExtensionSession | null } {
  return {
    current: session,
    async get() { return this.current; },
    async set(next) { this.current = next; },
    async clear() { this.current = null; },
  };
}

describe('ExtensionApiClient', () => {
  it('calls a worker-native fetch with the global worker receiver', async () => {
    const store = createStore({
      apiBase: 'https://storing.example.com/api/v1',
      accessToken: 'access',
      refreshToken: 'refresh',
      device: { deviceId: 'ccaf5543-f11a-4c53-89b0-20ef0cfddd72', deviceName: 'Chrome 扩展', appVersion: '0.1.0' },
      user: { id: 1, username: 'reader' },
    });
    let receiver: unknown;
    const workerNativeFetch = function (this: unknown) {
      receiver = this;
      return Promise.resolve(response({ status: 'ok' }));
    } as typeof fetch;

    const client = new ExtensionApiClient(store, workerNativeFetch);
    await client.testConnection('https://storing.example.com/api/v1');

    expect(receiver).toBe(globalThis);
  });

  it('refreshes one expired access token then submits the same collection once', async () => {
    const store = createStore({
      apiBase: 'https://storing.example.com/api/v1',
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      device: { deviceId: 'ccaf5543-f11a-4c53-89b0-20ef0cfddd72', deviceName: 'Chrome 扩展', appVersion: '0.1.0' },
      user: { id: 1, username: 'reader' },
    });
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, authorization: new Headers(init?.headers).get('Authorization') });
      if (url.endsWith('/extension/auth/refresh')) {
        return response({ access_token: 'new-access', refresh_token: 'new-refresh', user: { id: 1, username: 'reader' } });
      }
      if (requests.filter((request) => request.url.endsWith('/extension/collect')).length === 1) return response({ error: { code: 'INVALID_TOKEN' } }, 401);
      return response({ job: { id: 44, status: 'pending', stage: 'queued' } }, 202);
    };

    const client = new ExtensionApiClient(store, fetchMock);
    const result = await client.collect('https://example.com/article');

    expect(result.id).toBe(44);
    expect(requests.map((request) => request.url.replace('https://storing.example.com/api/v1', ''))).toEqual([
      '/extension/collect',
      '/extension/auth/refresh',
      '/extension/collect',
    ]);
    expect(requests[0].authorization).toBe('Bearer old-access');
    expect(requests[2].authorization).toBe('Bearer new-access');
    expect(store.current?.refreshToken).toBe('new-refresh');
  });

  it('clears the session when the retried request is still unauthorized', async () => {
    const store = createStore({
      apiBase: 'https://storing.example.com/api/v1',
      accessToken: 'old-access',
      refreshToken: 'refresh-token',
      device: { deviceId: 'ccaf5543-f11a-4c53-89b0-20ef0cfddd72', deviceName: 'Chrome 扩展', appVersion: '0.1.0' },
      user: { id: 1, username: 'reader' },
    });
    let collectCalls = 0;
    const fetchMock: typeof fetch = async (input) => {
      if (String(input).endsWith('/extension/auth/refresh')) {
        return response({ access_token: 'new-access', refresh_token: 'new-refresh', user: { id: 1, username: 'reader' } });
      }
      collectCalls += 1;
      return response({ error: { code: 'INVALID_TOKEN' } }, 401);
    };

    const client = new ExtensionApiClient(store, fetchMock);

    await expect(client.collect('https://example.com/article')).rejects.toBeInstanceOf(ExtensionAuthError);
    expect(collectCalls).toBe(2);
    expect(store.current).toBeNull();
  });
});
