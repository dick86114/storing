import type { ExtensionMessage, ExtensionMessageResult } from './messages';

export async function sendExtensionMessage(message: ExtensionMessage): Promise<ExtensionMessageResult> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionMessageResult>;
}
