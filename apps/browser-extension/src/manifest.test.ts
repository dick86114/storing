import { describe, expect, it } from 'vitest';
import manifest from '../manifest.config';

describe('extension manifest', () => {
  it('uses Manifest V3 with the minimum capture permissions and fixed branding assets', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'storage']));
    expect(manifest.optional_host_permissions).toEqual(expect.arrayContaining(['http://*/*', 'https://*/*']));
    expect(manifest.action?.default_popup).toBe('src/popup/index.html');
    expect(manifest.options_ui?.page).toBe('src/options/index.html');
    expect(manifest.background?.service_worker).toBe('src/background/index.ts');
    expect(manifest.key).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(manifest.icons?.['128']).toBe('icons/logo-128.png');
  });
});
