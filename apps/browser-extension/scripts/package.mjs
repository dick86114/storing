import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(appRoot, 'package.json'), 'utf8'));
const outputDirectory = resolve(appRoot, '../../releases/browser-extension');
const outputFile = resolve(outputDirectory, `storing-browser-extension-v${packageJson.version}.zip`);

mkdirSync(outputDirectory, { recursive: true });
execFileSync('zip', ['-q', '-r', outputFile, '.'], { cwd: resolve(appRoot, 'dist'), stdio: 'inherit' });
console.log(`Created ${outputFile}`);
