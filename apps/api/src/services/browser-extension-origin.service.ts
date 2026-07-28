const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}$/i;

function parseConfiguredOrigins(raw: string | undefined, fallback: string[] = []) {
  return (raw || fallback.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createAllowedCorsOrigins(input: { appOrigin?: string; browserExtensionOrigins?: string }) {
  const appOrigins = parseConfiguredOrigins(input.appOrigin, ['http://localhost:1050']);
  const browserExtensionOrigins = parseConfiguredOrigins(input.browserExtensionOrigins)
    .filter((origin) => EXTENSION_ORIGIN_PATTERN.test(origin));
  return new Set([...appOrigins, ...browserExtensionOrigins]);
}

export function resolveAllowedCorsOrigin(origin: string, allowedCorsOrigins: ReadonlySet<string>) {
  return allowedCorsOrigins.has(origin) ? origin : undefined;
}
