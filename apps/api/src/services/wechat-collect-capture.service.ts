import { JSDOM } from 'jsdom';
import {
  buildHtmlFromRawContent,
  extractWechatCoverImage,
  fetchCapturedArticleContent,
  fetchWechatJson,
  hasUsefulContent,
} from './reader.service.js';
import type { HtmlVariant } from './singlefile.service.js';

export type WechatCapturePageMeta = {
  title: string | null;
  source: string | null;
};

export type WechatCollectCapture = {
  title: string;
  source: string;
  coverImage: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  content: Record<string, unknown>;
};

export type WechatCaptureDependencies = {
  fetchJson: (url: string) => Promise<any>;
  fetchPageMeta: (url: string) => Promise<WechatCapturePageMeta | null>;
  fetchContent: (
    article: {
      originalUrl: string | null;
      content: unknown;
      contentMarkdown: string | null;
      contentHtml: string | null;
    },
    format: 'markdown' | 'html',
    htmlVariant?: HtmlVariant,
  ) => Promise<string | null>;
};

function extractTitle(doc: Document, fallbackUrl: string) {
  const values = [
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    doc.querySelector('meta[name="og:title"]')?.getAttribute('content'),
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
    doc.querySelector('meta[property="twitter:title"]')?.getAttribute('content'),
    doc.querySelector('meta[itemprop="headline"]')?.getAttribute('content'),
    doc.querySelector('meta[itemprop="name"]')?.getAttribute('content'),
    doc.querySelector('meta[name="title"]')?.getAttribute('content'),
    doc.querySelector('title')?.textContent,
    doc.querySelector('article h1')?.textContent,
    doc.querySelector('main h1')?.textContent,
    doc.querySelector('h1')?.textContent,
    doc.querySelector('article h2')?.textContent,
    doc.querySelector('main h2')?.textContent,
    doc.querySelector('h2')?.textContent,
  ];

  for (const value of values) {
    const title = value?.replace(/\s+/g, ' ').trim();
    if (title) return title.slice(0, 180);
  }
  return fallbackUrl;
}

function extractSource(url: string, doc?: Document) {
  const siteName = doc?.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim();
  if (siteName) return siteName.slice(0, 80);
  return new URL(url).hostname.replace(/^www\./, '').slice(0, 80);
}

export async function fetchWechatPageMeta(url: string): Promise<WechatCapturePageMeta | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const title = extractTitle(doc, url);
    const source =
      doc.querySelector('#js_name')?.textContent?.replace(/\s+/g, ' ').trim()
      || doc.querySelector('meta[property="og:article:author"]')?.getAttribute('content')?.trim()
      || doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim()
      || '微信公众号';

    return {
      title: title === url ? null : title,
      source: source.slice(0, 80),
    };
  } catch {
    return null;
  }
}

const BLOCKED_TITLE_PATTERNS = [
  /访问验证/i,
  /安全验证/i,
  /人机验证/i,
  /环境异常/i,
  /内容已被删除/i,
  /该内容已被发布者删除/i,
  /此内容因违规无法查看/i,
  /链接已过期/i,
  /链接已失效/i,
  /页面不存在/i,
  /内容不存在/i,
  /页面暂时无法显示/i,
  /服务暂时不可用/i,
  /系统繁忙/i,
  /请稍后重新打开/i,
];

const BLOCKED_CONTENT_PATTERNS = [
  /当前访问环境异常/i,
  /请完成(?:访问|安全|人机)验证/i,
  /请输入验证码/i,
  /完成验证码验证/i,
  /slide to verify/i,
  /refreshing too often/i,
  /操作过于频繁/i,
  /访问过于频繁/i,
  /该内容已被发布者删除/i,
  /此内容因违规无法查看/i,
  /链接已过期/i,
  /链接已失效/i,
  /页面不存在/i,
  /内容不存在/i,
  /页面暂时无法显示/i,
  /服务暂时不可用/i,
  /系统繁忙/i,
  /请稍后重新打开/i,
];

function looksLikeUnavailablePage(text: string) {
  const probe = text.replace(/\s+/g, ' ').trim();
  if (!probe) return false;
  const subject = '(?:文章|内容|页面|链接|公众号)';
  const unavailable = '(?:已?(?:删除|移除|下线|屏蔽|封禁)|被[^。！？\\n]{0,20}(?:删除|移除|下线|屏蔽|封禁)|遭(?:删除|移除|下线)|无法(?:查看|阅读)|不可(?:查看|阅读)|不存在|已失效|已过期|违规|停止访问|无法访问|访问受限|不可用)';
  return new RegExp(`${subject}.{0,24}${unavailable}|${unavailable}.{0,24}${subject}`, 'i').test(probe);
}

function normalizeMarkdown(value: string) {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 60000);
}

function markdownForNode(node: Node): string {
  if (node.nodeType === 3) {
    return node.textContent?.replace(/\s+/g, ' ') || '';
  }
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(tag)) return '';
  const children = () => Array.from(element.childNodes).map(markdownForNode).join('');

  if (tag === 'BR') return '\n';
  if (tag === 'IMG') {
    const source = element.getAttribute('src') || element.getAttribute('data-src') || '';
    if (!source || source.startsWith('data:')) return '';
    const alt = element.getAttribute('alt') || '图片';
    return `\n\n![${alt}](${source})\n\n`;
  }
  if (tag === 'A') {
    const text = children().trim();
    const href = element.getAttribute('href') || '';
    return /^https?:/i.test(href) ? `[${text}](${href})` : text;
  }
  if (tag === 'STRONG' || tag === 'B') return `**${children().trim()}**`;
  if (tag === 'EM' || tag === 'I') return `*${children().trim()}*`;
  if (/^H[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
  if (tag === 'LI') return `\n- ${children().trim()}`;
  if (tag === 'BLOCKQUOTE') {
    return `\n\n${children().trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
  }
  if (tag === 'PRE') {
    const code = element.textContent?.replace(/\s+$/, '') || '';
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  }

  const content = children();
  if (['P', 'DIV', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION', 'UL', 'OL', 'TABLE', 'TR'].includes(tag)) {
    return `\n\n${content}\n\n`;
  }
  return content;
}

/** 从已完成图片替换的 HTML 派生 Markdown，保留正文图片和基本块结构。 */
export function convertCapturedHtmlToMarkdown(html: string): string {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  return body ? normalizeMarkdown(markdownForNode(body)) : '';
}

function isUsableCapturedHtml(
  html: string | null,
  options: { allowImageOnly?: boolean } = {},
): html is string {
  if (!html || !hasUsefulContent(html, 'html')) return false;
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = extractTitle(doc, '');
  const bodyText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  const articleBody = doc.querySelector('#js_content');
  const articleText = (articleBody?.textContent || '').replace(/\s+/g, ' ').trim();
  const articleImages = articleBody?.querySelectorAll('img').length || 0;
  const trustedStructure = Boolean(
    articleBody
    || doc.querySelector('#js_article, #activity-name, meta[property="og:type"][content="article"]'),
  );

  if (BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) return false;
  if (looksLikeUnavailablePage(title)) return false;
  if (BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(bodyText))) return false;
  if (looksLikeUnavailablePage(bodyText)) return false;
  if (!trustedStructure && !options.allowImageOnly) return false;
  if (articleText.length >= 80) return true;
  if (articleImages > 0 && options.allowImageOnly) return true;
  if (bodyText.length >= 80) return true;
  return Boolean(options.allowImageOnly && doc.querySelector('img'));
}

function isUsableCapturedMarkdown(
  markdown: string | null,
  options: { allowImageOnly?: boolean } = {},
): markdown is string {
  if (!markdown || !hasUsefulContent(markdown, 'markdown')) return false;
  if (BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(markdown))) return false;
  if (looksLikeUnavailablePage(markdown)) return false;
  const textOnly = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .trim();
  if (textOnly.length >= 80) return true;
  return options.allowImageOnly === true && /!\[[^\]]*\]\([^)]+\)/.test(markdown);
}

const defaultDependencies: WechatCaptureDependencies = {
  fetchJson: fetchWechatJson,
  fetchPageMeta: fetchWechatPageMeta,
  fetchContent: fetchCapturedArticleContent,
};

/**
 * 在内存中完成微信候选内容抓取与有效性检查。
 * 该函数不接触数据库，失败时调用方不会产生任何文章或元数据记录。
 */
export async function captureWechatArticleInMemory(
  normalizedUrl: string,
  dependencies: WechatCaptureDependencies = defaultDependencies,
): Promise<WechatCollectCapture> {
  const fallbackTitle = normalizedUrl;
  const fallbackSource = '微信公众号';
  const wechatJson = await dependencies.fetchJson(normalizedUrl).catch((error) => {
    console.error('Wechat json fetch failed:', error instanceof Error ? error.message : error);
    return null;
  });
  let title = fallbackTitle;
  let source = fallbackSource;
  let coverImage: string | null = null;
  let content: Record<string, unknown> = {
    collectMethod: 'reader',
    originalUrl: normalizedUrl,
  };

  if (wechatJson && (wechatJson.content_noencode || wechatJson.picture_page_info_list?.length)) {
    coverImage = extractWechatCoverImage(wechatJson);
    content = {
      collectMethod: 'reader',
      collectSource: wechatJson.collect_source || 'reader_json',
      originalUrl: normalizedUrl,
      content_noencode: wechatJson.content_noencode || '',
      picture_page_info_list: wechatJson.picture_page_info_list ?? [],
      ...(coverImage ? { wechatCoverImage: coverImage } : {}),
    };
    if (typeof wechatJson.title === 'string' && wechatJson.title) title = wechatJson.title;
    if (typeof wechatJson.nick_name === 'string' && wechatJson.nick_name) source = wechatJson.nick_name;

    const structuredHtml = await buildHtmlFromRawContent(content);
    if (isUsableCapturedHtml(structuredHtml, { allowImageOnly: true })) {
      return {
        title,
        source,
        coverImage,
        contentHtml: structuredHtml,
        contentMarkdown: convertCapturedHtmlToMarkdown(structuredHtml),
        content,
      };
    }
  } else {
    const pageMeta = await dependencies.fetchPageMeta(normalizedUrl);
    if (pageMeta?.title) title = pageMeta.title;
    if (pageMeta?.source) source = pageMeta.source;
  }
  if (BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    throw new Error('微信公众号正文抓取失败：页面要求访问验证或内容不可用');
  }
  if (looksLikeUnavailablePage(title)) {
    throw new Error('微信公众号正文抓取失败：页面要求访问验证或内容不可用');
  }

  const article = {
    originalUrl: normalizedUrl,
    content,
    contentMarkdown: null,
    contentHtml: null,
  };
  // HTML 通常已包含正文和图片；成功后再从内存派生 Markdown，
  // 避免第二路远程抓取和重复图片上传，也避免等待更慢的回退链。
  const contentHtml = await dependencies.fetchContent(article, 'html', 'desktop');
  if (isUsableCapturedHtml(contentHtml)) {
    return {
      title,
      source,
      coverImage,
      contentHtml,
      contentMarkdown: convertCapturedHtmlToMarkdown(contentHtml) || null,
      content,
    };
  }

  const contentMarkdown = await dependencies.fetchContent(article, 'markdown', 'desktop');
  if (!isUsableCapturedMarkdown(contentMarkdown)) {
    throw new Error('微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文');
  }

  return {
    title,
    source,
    coverImage,
    contentHtml,
    contentMarkdown,
    content,
  };
}
