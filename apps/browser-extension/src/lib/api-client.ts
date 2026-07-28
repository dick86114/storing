export type ExtensionDevice = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export type ExtensionUser = {
  id: number;
  username: string;
  role?: string;
  status?: string;
};

export type ExtensionSession = {
  apiBase: string;
  accessToken: string;
  refreshToken: string;
  device: ExtensionDevice;
  user: ExtensionUser;
};

export type SessionStore = {
  get(): Promise<ExtensionSession | null>;
  set(session: ExtensionSession): Promise<void>;
  clear(): Promise<void>;
};

type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: ExtensionUser;
};

export type CollectJob = {
  id: number;
  status: string;
  stage: string;
  title?: string | null;
  articleId?: number | null;
};

export class ExtensionApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ExtensionApiError';
  }
}

export class ExtensionAuthError extends ExtensionApiError {
  constructor(message = '登录已失效，请重新连接乾坤戒') {
    super(message, 401);
    this.name = 'ExtensionAuthError';
  }
}

function endpoint(apiBase: string, path: string) {
  return `${apiBase.replace(/\/$/, '')}${path}`;
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message || `请求失败（${response.status}）`;
}

export class ExtensionApiClient {
  constructor(private readonly store: SessionStore, private readonly fetchImpl: typeof fetch = fetch) {}

  async testConnection(apiBase: string) {
    const response = await this.fetchImpl(endpoint(apiBase, '/health'));
    if (!response.ok) throw new ExtensionApiError(await errorMessage(response), response.status);
  }

  async login(apiBase: string, username: string, password: string, device: ExtensionDevice) {
    const response = await this.fetchImpl(endpoint(apiBase, '/extension/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, device }),
    });
    if (!response.ok) throw new ExtensionApiError(await errorMessage(response), response.status);
    const auth = await response.json() as AuthResponse;
    const session: ExtensionSession = { apiBase, accessToken: auth.access_token, refreshToken: auth.refresh_token, device, user: auth.user };
    await this.store.set(session);
    return session;
  }

  async getSession() {
    return this.request<{ user: ExtensionUser }>('/extension/auth/session');
  }

  async logout() {
    const session = await this.store.get();
    try {
      if (session) {
        await this.fetchImpl(endpoint(session.apiBase, '/extension/auth/logout'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
      }
    } finally {
      await this.store.clear();
    }
  }

  async collect(url: string) {
    const response = await this.request<{ job: CollectJob }>('/extension/collect', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return response.job;
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const session = await this.store.get();
    if (!session) throw new ExtensionAuthError();

    const response = await this.fetchImpl(endpoint(session.apiBase, path), {
      ...init,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (response.status === 401 && retry) {
      const refreshed = await this.refresh(session);
      if (!refreshed) {
        await this.store.clear();
        throw new ExtensionAuthError();
      }
      return this.request(path, init, false);
    }
    if (response.status === 401) {
      await this.store.clear();
      throw new ExtensionAuthError();
    }
    if (!response.ok) throw new ExtensionApiError(await errorMessage(response), response.status);
    return response.json() as Promise<T>;
  }

  private async refresh(session: ExtensionSession) {
    const response = await this.fetchImpl(endpoint(session.apiBase, '/extension/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken, device: session.device }),
    });
    if (!response.ok) return false;

    const auth = await response.json() as AuthResponse;
    await this.store.set({
      ...session,
      accessToken: auth.access_token,
      refreshToken: auth.refresh_token,
      user: auth.user,
    });
    return true;
  }
}
