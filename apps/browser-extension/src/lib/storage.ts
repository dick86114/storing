import type { ExtensionSession, SessionStore } from './api-client';

export type ConnectionSettings = {
  serverUrl: string;
  apiOverride?: string;
};

const SESSION_KEY = 'extensionSession';
const SETTINGS_KEY = 'connectionSettings';

export const sessionStore: SessionStore = {
  async get() {
    const values = await chrome.storage.local.get(SESSION_KEY);
    return (values[SESSION_KEY] as ExtensionSession | undefined) ?? null;
  },
  async set(session) {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  },
  async clear() {
    await chrome.storage.local.remove(SESSION_KEY);
  },
};

export async function getConnectionSettings() {
  const values = await chrome.storage.local.get(SETTINGS_KEY);
  return (values[SETTINGS_KEY] as ConnectionSettings | undefined) ?? null;
}

export async function setConnectionSettings(settings: ConnectionSettings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function clearConnectionSettings() {
  await chrome.storage.local.remove(SETTINGS_KEY);
}

const DEVICE_KEY = 'extensionDevice';

export async function getOrCreateExtensionDevice() {
  const values = await chrome.storage.local.get(DEVICE_KEY);
  const existing = values[DEVICE_KEY] as { deviceId?: string; deviceName?: string; appVersion?: string } | undefined;
  const appVersion = chrome.runtime.getManifest().version;
  if (existing?.deviceId) {
    return {
      deviceId: existing.deviceId,
      deviceName: 'Chrome / Edge 浏览器插件',
      appVersion,
    };
  }

  const device = {
    deviceId: crypto.randomUUID(),
    deviceName: 'Chrome / Edge 浏览器插件',
    appVersion,
  };
  await chrome.storage.local.set({ [DEVICE_KEY]: device });
  return device;
}
