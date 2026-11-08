export function hostPermissionFor(apiBase: string) {
  const url = new URL(apiBase);
  return `${url.protocol}//${url.host}/*`;
}

function waitForServerPermission(apiBase: string) {
  const origin = hostPermissionFor(apiBase);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return new Promise<boolean>((resolve, reject) => {
    const finish = (granted: boolean) => {
      globalThis.clearTimeout(timer);
      chrome.permissions.contains({ origins: [origin] }, (contains) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(Boolean(contains));
      });
    };

    timer = globalThis.setTimeout(() => finish(true), 80);
    chrome.permissions.request({ origins: [origin] }, (granted) => {
      const error = chrome.runtime.lastError;
      if (error) {
        globalThis.clearTimeout(timer);
        reject(new Error(error.message));
        return;
      }
      globalThis.clearTimeout(timer);
      finish(Boolean(granted));
    });
  });
}

export async function requestServerPermission(apiBase: string) {
  return waitForServerPermission(apiBase);
}

export async function removeServerPermission(apiBase: string) {
  return chrome.permissions.remove({ origins: [hostPermissionFor(apiBase)] });
}
