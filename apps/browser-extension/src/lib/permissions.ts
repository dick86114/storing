export function hostPermissionFor(apiBase: string) {
  const url = new URL(apiBase);
  return `${url.protocol}//${url.host}/*`;
}

export async function requestServerPermission(apiBase: string) {
  return chrome.permissions.request({ origins: [hostPermissionFor(apiBase)] });
}

export async function removeServerPermission(apiBase: string) {
  return chrome.permissions.remove({ origins: [hostPermissionFor(apiBase)] });
}
