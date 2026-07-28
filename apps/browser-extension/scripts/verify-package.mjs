import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(appRoot, 'dist');
const packageJson = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'));
const archive = resolve(appRoot, '../../releases/browser-extension', `storing-browser-extension-v${packageJson.version}.zip`);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return [relative(distRoot, fullPath)];
  }).sort();
}

const distFiles = listFiles(distRoot);
const archiveFiles = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
  .split('\n')
  .filter((entry) => entry && !entry.endsWith('/'))
  .sort();

assert.deepEqual(archiveFiles, distFiles, 'release ZIP must exactly mirror the current dist directory');
assert.ok(statSync(archive).size > 0, 'release ZIP must not be empty');
console.log(`Verified ${archive} with ${archiveFiles.length} files`);
