import http from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const port = Number(process.env.PORT || 3000);
const command = process.env.SINGLEFILE_COMMAND || 'single-file';
const browserExecutablePath = process.env.SINGLEFILE_BROWSER_EXECUTABLE_PATH || '';
const timeoutMs = Number(process.env.SINGLEFILE_TIMEOUT_MS || 180000);
const maxBuffer = Number(process.env.SINGLEFILE_MAX_BUFFER || 80 * 1024 * 1024);

function writeJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('请求 JSON 格式不正确'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) throw new Error('缺少 url');
  const url = new URL(rawUrl.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持 http/https 链接');
  return url.toString();
}

const desktopUserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getSingleFileArgs(url, outputPath, options = {}) {
  const viewport = options.viewport || {};
  const args = [
    url,
    outputPath,
    `--user-agent=${options.userAgent || desktopUserAgent}`,
    '--browser-arg=--disable-blink-features=AutomationControlled',
    '--browser-arg=--no-sandbox',
    '--browser-arg=--disable-dev-shm-usage',
    '--browser-load-max-time=60000',
    '--browser-capture-max-time=60000',
  ];
  if (browserExecutablePath) {
    args.push(`--browser-executable-path=${browserExecutablePath}`);
  }
  if (Number.isFinite(viewport.width) && Number.isFinite(viewport.height)) {
    args.push(`--browser-arg=--window-size=${viewport.width},${viewport.height}`);
  }
  return args;
}

async function capturePage(rawUrl, options = {}) {
  const url = normalizeUrl(rawUrl);
  const dir = await mkdtemp(join(tmpdir(), 'storing-singlefile-'));
  const outputPath = join(dir, 'page.html');

  try {
    const { stdout } = await execFileAsync(command, getSingleFileArgs(url, outputPath, options), {
      timeout: timeoutMs,
      maxBuffer,
      env: process.env,
    });
    const html = await readFile(outputPath, 'utf8').catch(() => stdout || '');
    if (!html.trim()) throw new Error('SingleFile 没有返回 HTML 内容');
    return html;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/capture') {
    writeJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const body = await readJson(req);
    const html = await capturePage(body.url, {
      userAgent: typeof body.userAgent === 'string' ? body.userAgent : undefined,
      viewport: body.viewport && typeof body.viewport === 'object' ? body.viewport : undefined,
    });
    writeJson(res, 200, { html });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'SingleFile 抓取失败';
    writeJson(res, 500, { error: message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`SingleFile capture service listening on ${port}`);
});
