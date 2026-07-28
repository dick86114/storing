import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../manifest.config';

function extensionIdFromPublicKey(key: string) {
  const digest = createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16);
  const alphabet = 'abcdefghijklmnop';
  return [...digest].map((byte) => `${alphabet[byte >> 4]}${alphabet[byte & 15]}`).join('');
}

describe('fixed release identity', () => {
  it('keeps the documented extension ID derived from the manifest public key', () => {
    const expected = readFileSync(resolve(process.cwd(), 'EXTENSION_ID'), 'utf8').trim();
    expect(extensionIdFromPublicKey(manifest.key)).toBe(expected);
  });
});
