import type { CollectJob, ExtensionDevice, ExtensionSession, ExtensionUser } from './api-client';
import type { ConnectionSettings } from './storage';

export type ExtensionState = {
  settings: ConnectionSettings | null;
  session: ExtensionSession | null;
};

export type ExtensionMessage =
  | { type: 'get-state' }
  | { type: 'test-connection'; apiBase: string }
  | { type: 'login'; settings: ConnectionSettings; apiBase: string; username: string; password: string; device: ExtensionDevice }
  | { type: 'logout' }
  | { type: 'collect'; url: string }
  | { type: 'get-session' }
  | { type: 'open-inbox' };

export type ExtensionMessageResult =
  | { ok: true; state?: ExtensionState; job?: CollectJob; user?: ExtensionUser; releasedApiBase?: string }
  | { ok: false; error: { message: string; code?: 'AUTHENTICATION_REQUIRED' | 'REQUEST_FAILED' } };
