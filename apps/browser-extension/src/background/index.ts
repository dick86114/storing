import { ExtensionApiClient, ExtensionApiError, ExtensionAuthError } from '../lib/api-client';
import type { ExtensionMessage, ExtensionMessageResult } from '../lib/messages';
import { clearConnectionSettings, getConnectionSettings, sessionStore, setConnectionSettings } from '../lib/storage';

async function state() {
  return { settings: await getConnectionSettings(), session: await sessionStore.get() };
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionMessageResult> {
  const client = new ExtensionApiClient(sessionStore);

  switch (message.type) {
    case 'get-state':
      return { ok: true, state: await state() };
    case 'test-connection':
      await client.testConnection(message.apiBase);
      return { ok: true };
    case 'login':
      await client.login(message.apiBase, message.username, message.password, message.device);
      await setConnectionSettings(message.settings);
      return { ok: true, state: await state() };
    case 'logout': {
      const session = await sessionStore.get();
      await client.logout();
      await clearConnectionSettings();
      return { ok: true, releasedApiBase: session?.apiBase };
    }
    case 'collect': {
      const job = await client.collect(message.url);
      return { ok: true, job };
    }
    case 'get-session': {
      const result = await client.getSession();
      return { ok: true, user: result.user };
    }
    case 'open-inbox': {
      const settings = await getConnectionSettings();
      if (!settings) throw new ExtensionAuthError('请先连接乾坤戒服务器');
      await chrome.tabs.create({ url: settings.serverUrl });
      return { ok: true };
    }
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      sendResponse({
        ok: false,
        error: {
          message: errorMessage,
          code: error instanceof ExtensionAuthError ? 'AUTHENTICATION_REQUIRED' : error instanceof ExtensionApiError ? 'REQUEST_FAILED' : undefined,
        },
      } satisfies ExtensionMessageResult);
    });
  return true;
});
