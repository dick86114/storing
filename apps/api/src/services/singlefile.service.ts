import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { JSDOM } from 'jsdom';

const execFileAsync = promisify(execFile);

export type HtmlVariant = 'desktop' | 'mobile';
export type CollectCaptureStrategy =
  | 'wechat_reader'
  | 'singlefile_sidecar'
  | 'singlefile_command'
  | 'singlefile_docker'
  | 'singlefile_npx';
export type CaptureValidationResult =
  | { ok: true; textLength: number }
  | { ok: false; reason: string; textLength: number };

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getSingleFileCommand() {
  return process.env.SINGLEFILE_COMMAND || 'single-file';
}

function getSingleFileServiceUrl() {
  const value = process.env.SINGLEFILE_SERVICE_URL?.trim();
  return value ? value.replace(/\/+$/, '') : null;
}

export function getInitialSingleFileStrategy(): CollectCaptureStrategy {
  return getSingleFileServiceUrl() ? 'singlefile_sidecar' : 'singlefile_command';
}

export function getSingleFileCandidateStrategies(): CollectCaptureStrategy[] {
  const strategies: CollectCaptureStrategy[] = [];
  if (getSingleFileServiceUrl()) strategies.push('singlefile_sidecar');
  if (process.env.SINGLEFILE_COMMAND || commandExists(getSingleFileCommand())) {
    strategies.push('singlefile_command');
  }
  if (commandExists('docker')) {
    strategies.push('singlefile_docker');
  }
  if (commandExists('npx')) {
    strategies.push('singlefile_npx');
  }
  return strategies;
}

function commandExists(command: string) {
  if (!command || command.includes(' ')) return false;
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getSingleFileUserAgent(variant: HtmlVariant) {
  return variant === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
}

function getBrowserExecutablePath() {
  const configured = process.env.SINGLEFILE_BROWSER_EXECUTABLE_PATH?.trim();
  if (configured) return configured;

  const candidates = [
    '/usr/local/bin/playwright-chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function getSingleFileArgs(variant: HtmlVariant) {
  const args = [
    `--user-agent=${getSingleFileUserAgent(variant)}`,
    '--browser-arg=--disable-blink-features=AutomationControlled',
    '--browser-arg=--no-sandbox',
    '--browser-arg=--disable-dev-shm-usage',
  ];
  const browserExecutablePath = getBrowserExecutablePath();
  if (browserExecutablePath) {
    args.push(`--browser-executable-path=${browserExecutablePath}`);
  }

  if (variant === 'mobile') {
    args.push('--browser-arg=--window-size=430,932');
  }

  return args;
}

async function runSingleFileWithService(url: string, timeoutMs: number, variant: HtmlVariant) {
  const serviceUrl = getSingleFileServiceUrl();
  if (!serviceUrl) throw new Error('未配置 SingleFile 服务地址');

  const res = await fetch(`${serviceUrl}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      userAgent: getSingleFileUserAgent(variant),
      viewport: variant === 'mobile' ? { width: 430, height: 932, isMobile: true } : { width: 1440, height: 960, isMobile: false },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new Error(body?.error || `SingleFile 服务返回异常：${res.status}`);
  }

  const html = typeof body?.html === 'string' ? body.html : '';
  if (!html.trim()) throw new Error('SingleFile 服务没有返回 HTML 内容');
  return html;
}

async function runSingleFileWithDocker(url: string, timeoutMs: number, maxBuffer: number, variant: HtmlVariant) {
  const image = process.env.SINGLEFILE_DOCKER_IMAGE || 'capsulecode/singlefile';
  const args = ['run', '--rm', image, ...getSingleFileArgs(variant), url];
  const { stdout } = await execFileAsync('docker', args, { timeout: timeoutMs, maxBuffer });
  return stdout;
}

async function runSingleFileWithNpx(url: string, timeoutMs: number, variant: HtmlVariant) {
  const dir = await mkdtemp(join(tmpdir(), 'storing-singlefile-'));
  const outputPath = join(dir, 'page.html');

  try {
    await execFileAsync(
      'npx',
      [
        '-y',
        'single-file-cli',
        url,
        outputPath,
        ...getSingleFileArgs(variant),
        '--browser-load-max-time=60000',
        '--browser-capture-max-time=60000',
      ],
      { timeout: Math.max(timeoutMs, 180000), maxBuffer: 4 * 1024 * 1024 }
    );
    return await readFile(outputPath, 'utf8');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runSingleFileWithLocalCommand(
  url: string,
  timeoutMs: number,
  maxBuffer: number,
  variant: HtmlVariant
) {
  const command = getSingleFileCommand();
  const extraArgs = getSingleFileArgs(variant);

  if (command.includes(' ')) {
    const argsSuffix = extraArgs.map(shellQuote).join(' ');
    const { stdout } = await execFileAsync('/bin/sh', ['-lc', `${command} ${argsSuffix} ${shellQuote(url)}`], {
      timeout: timeoutMs,
      maxBuffer,
    });
    return stdout;
  }

  const { stdout } = await execFileAsync(command, [...extraArgs, url], { timeout: timeoutMs, maxBuffer });
  return stdout;
}

export async function runSingleFileWithStrategy(
  url: string,
  variant: HtmlVariant,
  strategy: CollectCaptureStrategy
): Promise<{ html: string; strategy: CollectCaptureStrategy }> {
  const timeoutMs = Number(process.env.SINGLEFILE_TIMEOUT_MS || 180000);
  const maxBuffer = Number(process.env.SINGLEFILE_MAX_BUFFER || 80 * 1024 * 1024);

  if (strategy === 'singlefile_sidecar') {
    return { html: await runSingleFileWithService(url, timeoutMs, variant), strategy };
  }

  if (strategy === 'singlefile_docker') {
    return { html: await runSingleFileWithDocker(url, timeoutMs, maxBuffer, variant), strategy };
  }

  if (strategy === 'singlefile_npx') {
    return { html: await runSingleFileWithNpx(url, timeoutMs, variant), strategy };
  }

  return { html: await runSingleFileWithLocalCommand(url, timeoutMs, maxBuffer, variant), strategy: 'singlefile_command' };
}

export async function runSingleFile(url: string, variant: HtmlVariant): Promise<{ html: string; strategy: CollectCaptureStrategy }> {
  const command = getSingleFileCommand();
  const timeoutMs = Number(process.env.SINGLEFILE_TIMEOUT_MS || 180000);
  const maxBuffer = Number(process.env.SINGLEFILE_MAX_BUFFER || 80 * 1024 * 1024);
  const serviceUrl = getSingleFileServiceUrl();

  const runLocalCommand = async () => {
    return { html: await runSingleFileWithLocalCommand(url, timeoutMs, maxBuffer, variant), strategy: 'singlefile_command' as const };
  };

  const runLocalFallback = async () => {
    try {
      return await runLocalCommand();
    } catch (e) {
      const error = e as NodeJS.ErrnoException;
      if (command === 'single-file' && error.code === 'ENOENT') {
        try {
          return { html: await runSingleFileWithDocker(url, timeoutMs, maxBuffer, variant), strategy: 'singlefile_docker' as const };
        } catch {
          return { html: await runSingleFileWithNpx(url, timeoutMs, variant), strategy: 'singlefile_npx' as const };
        }
      }
      throw e;
    }
  };

  if (serviceUrl) {
    try {
      return { html: await runSingleFileWithService(url, timeoutMs, variant), strategy: 'singlefile_sidecar' as const };
    } catch (serviceError) {
      if (process.env.SINGLEFILE_SERVICE_FALLBACK_LOCAL === 'false') throw serviceError;
      const serviceMessage = serviceError instanceof Error ? serviceError.message : String(serviceError);
      console.warn(`SingleFile service failed, fallback to local command: ${serviceMessage}`);
      try {
        return await runLocalFallback();
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`SingleFile 服务失败：${serviceMessage}；本地兜底也失败：${fallbackMessage}`);
      }
    }
  }

  return runLocalFallback();
}

function extractTitle(doc: Document, fallbackUrl: string) {
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent ||
    doc.querySelector('h1')?.textContent ||
    fallbackUrl;
  return title.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function extractSource(url: string, doc?: Document) {
  const siteName = doc?.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim();
  if (siteName) return siteName.slice(0, 80);
  return new URL(url).hostname.replace(/^www\./, '').slice(0, 80);
}

function absolutizeUrl(value: string, baseUrl: string) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return value;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function extractMetaImage(doc: Document, baseUrl: string) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];

  for (const selector of selectors) {
    const value = doc.querySelector(selector)?.getAttribute('content')?.trim();
    if (value) return absolutizeUrl(value, baseUrl);
  }

  const firstArticleImage =
    doc.querySelector<HTMLImageElement>('article img[src], article img[data-src]') ||
    doc.querySelector<HTMLImageElement>('main img[src], main img[data-src]') ||
    doc.querySelector<HTMLImageElement>('img[src], img[data-src]');

  if (!firstArticleImage) return null;

  for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'src']) {
    const value = firstArticleImage.getAttribute(attr)?.trim();
    if (value) return absolutizeUrl(value, baseUrl);
  }

  return null;
}

function getImageCandidate(image: HTMLImageElement, baseUrl: string) {
  for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'src']) {
    const value = image.getAttribute(attr)?.trim();
    if (!value) continue;
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('data:') || value.startsWith('blob:')) continue;
    return absolutizeUrl(value, baseUrl);
  }
  return null;
}

export async function uploadImagesInCapturedDocument(
  html: string,
  baseUrl: string,
  uploader: (url: string) => Promise<string | null>
) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));

  await Promise.all(
    images.map(async (image) => {
      const originalUrl = getImageCandidate(image, baseUrl);
      if (!originalUrl) return;

      const uploadedUrl = await uploader(originalUrl);
      if (!uploadedUrl) return;

      image.setAttribute('src', uploadedUrl);
      image.setAttribute('referrerpolicy', 'no-referrer');
      image.removeAttribute('srcset');
      image.removeAttribute('data-src');
      image.removeAttribute('data-original');
      image.removeAttribute('data-lazy-src');
      image.removeAttribute('data-url');
    })
  );

  return dom.serialize();
}

export function prepareCapturedDocument(rawHtml: string, baseUrl: string) {
  const dom = new JSDOM(rawHtml);
  const doc = dom.window.document;
  const title = extractTitle(doc, baseUrl);
  const source = extractSource(baseUrl, doc);
  const coverImage = extractMetaImage(doc, baseUrl);

  doc.querySelectorAll('script,noscript').forEach((node) => node.remove());
  doc.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    link.setAttribute('href', absolutizeUrl(href, baseUrl));
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  doc.querySelectorAll('img[src],img[data-src]').forEach((image) => {
    for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-url']) {
      const value = image.getAttribute(attr);
      if (value) image.setAttribute(attr, absolutizeUrl(value, baseUrl));
    }
  });

  doc.documentElement.setAttribute('data-storing-capture', 'singlefile');
  doc.documentElement.setAttribute('data-capture-source', baseUrl);
  doc.body?.setAttribute('data-storing-capture-body', 'true');
  doc.body?.classList.add('manual-capture-page');

  return { title, source, coverImage, html: dom.serialize() };
}

export function extractTextFromHtml(html: string) {
  const dom = new JSDOM(html);
  const text = dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return text.slice(0, 60000);
}

export function isSingleFileCaptureHtml(html?: string | null) {
  if (!html) return false;
  return html.includes('data-storing-capture="singlefile"') || html.includes("data-storing-capture='singlefile'");
}

const BLOCKED_TITLE_PATTERNS = [
  /verification\s*code/i,
  /captcha/i,
  /访问验证/i,
  /安全验证/i,
  /人机验证/i,
  /refreshing too often/i,
];

const BLOCKED_TEXT_PATTERNS = [
  /verification\s*code/i,
  /captcha/i,
  /refreshing too often/i,
  /slide to verify/i,
  /please enable javascript/i,
  /访问验证/i,
  /安全验证/i,
  /人机验证/i,
  /频繁访问/i,
  /操作过于频繁/i,
];

export function validateCapturedHtml(html: string, fallbackUrl: string): CaptureValidationResult {
  if (!html.trim()) {
    return { ok: false, reason: 'SingleFile 没有返回 HTML 内容', textLength: 0 };
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = extractTitle(doc, fallbackUrl);
  const text = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const textLength = text.replace(/\s+/g, '').length;
  const bodyHtml = doc.body?.innerHTML || '';

  if (title === fallbackUrl && textLength < 120) {
    return { ok: false, reason: '抓取结果缺少有效正文', textLength };
  }

  if (BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return { ok: false, reason: `抓取结果命中了验证页：${title}`, textLength };
  }

  if (BLOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { ok: false, reason: '抓取结果是验证页或风控拦截页', textLength };
  }

  if (/t-captcha|tcaptcha|x-waf-captcha|probe\.js|captcha-referer/i.test(bodyHtml)) {
    return { ok: false, reason: '抓取结果包含验证码/风控脚本', textLength };
  }

  if (textLength < 120) {
    return { ok: false, reason: '抓取结果正文过短，疑似壳页或异常页', textLength };
  }

  return { ok: true, textLength };
}
