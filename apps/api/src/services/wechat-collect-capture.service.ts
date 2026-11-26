import { JSDOM } from 'jsdom';
import {
  buildHtmlFromRawContent,
  extractWechatCoverImage,
  fetchCapturedArticleContent,
  fetchWechatJson,
  hasUsefulContent,
} from './reader.service.js';
import type { HtmlVariant } from './singlefile.service.js';
import { describeCaptureError, WECHAT_CAPTURE_FAILURE_PREFIX, type CaptureTrace } from './collect-capture-diagnostics.js';

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
  fetchJson: (url: string, trace?: CaptureTrace) => Promise<any>;
  fetchPageMeta: (url: string, trace?: CaptureTrace) => Promise<WechatCapturePageMeta | null>;
  fetchContent: (
    article: {
      originalUrl: string | null;
      content: unknown;
      contentMarkdown: string | null;
      contentHtml: string | null;
    },
    format: 'markdown' | 'html',
    htmlVariant?: HtmlVariant,
    trace?: CaptureTrace,
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

export async function fetchWechatPageMeta(url: string, trace?: CaptureTrace): Promise<WechatCapturePageMeta | null> {
  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      trace?.('微信页面元数据', startedAt, `HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const title = extractTitle(doc, url);
    const source =
      doc.querySelector('#js_name')?.textContent?.replace(/\s+/g, ' ').trim()
      || doc.querySelector('meta[property="og:article:author"]')?.getAttribute('content')?.trim()
      || doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim()
      || '微信公众号';

    trace?.('微信页面元数据', startedAt, `HTTP ${res.status}；${title === url ? '未提取到页面标题' : titleRejection(title) ?? '已提取到页面标题'}`);
    return {
      title: title === url ? null : title,
      source: source.slice(0, 80),
    };
  } catch (error) {
    trace?.('微信页面元数据', startedAt, describeCaptureError(error));
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

const UNAVAILABLE_PAGE_SUBJECT = '(?:文章|内容|页面|链接|公众号)';
const UNAVAILABLE_PAGE_ACTION = '(?:删除|移除|下线|屏蔽|封禁)';
const UNAVAILABLE_PAGE_ACTOR = '(?:微信公众平台|微信平台|平台|发布者|作者|管理员|系统|腾讯|运营)';
const UNAVAILABLE_PAGE_STATUS = [
  `(?:被${UNAVAILABLE_PAGE_ACTOR}?|由${UNAVAILABLE_PAGE_ACTOR}|遭)${UNAVAILABLE_PAGE_ACTION}`,
  '无法(?:查看|阅读|访问)|不可(?:查看|阅读)|不存在|失效|过期|访问受限|不可用|停止访问',
].join('|');
const UNAVAILABLE_PAGE_REASON = '(?:因(?:违规|(?:用户)?投诉)|涉嫌违规|被多人投诉)';
const UNAVAILABLE_PAGE_NOTICE = new RegExp(
  '(?:^|[\\r\\n。！？]) *(?:#{1,6} +)?[*_]*'
  + `(?:(?:该|此|本|这篇|这条|这个)? *${UNAVAILABLE_PAGE_SUBJECT} *`
  + `(?:${UNAVAILABLE_PAGE_REASON} *[，,]? *)?(?:目前|当前|暂时|暂)? *`
  + `(?:已(?:经)? *${UNAVAILABLE_PAGE_ACTION}|(?:已(?:经)? *)?(?:${UNAVAILABLE_PAGE_STATUS}))`
  + `(?:(?:或|或者)(?:已被)?${UNAVAILABLE_PAGE_ACTION})?`
  + `|无法(?:查看|阅读|访问) *(?:该|此|本|这篇|这条|这个) *${UNAVAILABLE_PAGE_SUBJECT})`
  + '(?:了)?[*_]*(?= *(?:[\\r\\n，。！？；：,.!?;:…|—·-]|$))',
);

function looksLikeUnavailablePage(text: string) {
  // 在标题、句首或独立行识别页面状态，避免误判正文中转述的提示。
  return UNAVAILABLE_PAGE_NOTICE.test(text.replace(/[^\S\r\n]+/g, ' ').trim());
}

const VERIFICATION_NOTICE = /访问验证|安全验证|人机验证|环境异常|验证码|slide to verify|refreshing too often|操作过于频繁|访问过于频繁/i;

function titleRejection(title: string): string | null {
  if (!BLOCKED_TITLE_PATTERNS.some((pattern) => pattern.test(title)) && !looksLikeUnavailablePage(title)) return null;
  return VERIFICATION_NOTICE.test(title) ? '页面要求访问验证' : '页面提示内容不可用';
}

function contentRejection(text: string, structuredText = text): string | null {
  if (!BLOCKED_CONTENT_PATTERNS.some((pattern) => pattern.test(text)) && !looksLikeUnavailablePage(structuredText)) return null;
  return VERIFICATION_NOTICE.test(text) ? '页面要求访问验证' : '页面提示内容不可用';
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

function capturedHtmlRejection(
  html: string | null,
  options: { allowImageOnly?: boolean } = {},
): string | null {
  if (!html?.trim()) return '未取得 HTML';
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const title = extractTitle(doc, '');
  const bodyText = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  const articleBody = doc.querySelector('#js_content');
  const articleText = (articleBody?.textContent || '').replace(/\s+/g, ' ').trim();
  const articleImages = articleBody?.querySelectorAll('img').length || 0;
  const trustedStructure = articleBody
    || doc.querySelector('#js_article, #activity-name, meta[property="og:type"][content="article"]');

  const blocked = titleRejection(title) ?? contentRejection(bodyText, doc.body ? markdownForNode(doc.body) : '');
  if (blocked) return blocked;
  if (!trustedStructure && !options.allowImageOnly) return '缺少微信正文结构（正文容器或文章标记）';
  const hasEnoughContent = articleText.length >= 80 || bodyText.length >= 80
    || (options.allowImageOnly && Boolean(articleImages || doc.querySelector('img')));
  if (!hasEnoughContent) return `正文不足（页面提取 ${bodyText.length} 字符，最低要求 80 字符）`;
  return hasUsefulContent(html, 'html') ? null : 'HTML 未通过通用正文校验';
}

function capturedMarkdownRejection(markdown: string | null): string | null {
  if (!markdown?.trim()) return '未取得 Markdown';
  const blocked = contentRejection(markdown);
  if (blocked) return blocked;
  const textOnly = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .trim();
  if (textOnly.length < 80) return `正文不足（提取 ${textOnly.length} 字符，最低要求 80 字符）`;
  return hasUsefulContent(markdown, 'markdown') ? null : 'Markdown 未通过通用正文校验';
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
  const details: string[] = [];
  const trace: CaptureTrace = (step, startedAt, outcome) => {
    details.push(`${step}（${Math.round(performance.now() - startedAt)} ms）：${outcome}`);
  };
  async function attempt<T>(step: string, fetchValue: () => Promise<T>, rejection: (value: T) => string | null) {
    const startedAt = performance.now();
    const previousCount = details.length;
    try {
      const value = await fetchValue();
      const reason = rejection(value);
      if (reason && (value != null || details.length === previousCount)) trace(step, startedAt, reason);
      return { value, accepted: reason === null };
    } catch (error) {
      if (details.length === previousCount) trace(step, startedAt, describeCaptureError(error));
      return { value: null, accepted: false };
    }
  }
  const failure = (summary: string) => new Error([WECHAT_CAPTURE_FAILURE_PREFIX + summary, ...details].join('\n'));

  const { value: wechatJson } = await attempt('微信结构化数据', () => dependencies.fetchJson(normalizedUrl, trace),
    (value) => value?.content_noencode || value?.picture_page_info_list?.length ? null : '未取得结构化正文或图片');
  let title = normalizedUrl;
  let source = '微信公众号';
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

    const { value: structuredHtml, accepted } = await attempt('微信结构化正文校验',
      () => buildHtmlFromRawContent(content),
      (value) => capturedHtmlRejection(value, { allowImageOnly: true }));
    if (structuredHtml && accepted) {
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
    const { value: pageMeta } = await attempt('微信页面元数据', () => dependencies.fetchPageMeta(normalizedUrl, trace),
      (value) => value?.title ? null : '未提取到页面标题');
    if (pageMeta?.title) title = pageMeta.title;
    if (pageMeta?.source) source = pageMeta.source;
  }
  const rejectedTitle = titleRejection(title);
  if (rejectedTitle) {
    details.push(`微信页面标题：${rejectedTitle}`);
    throw failure('页面要求访问验证或内容不可用');
  }

  const article = {
    originalUrl: normalizedUrl,
    content,
    contentMarkdown: null,
    contentHtml: null,
  };
  // HTML 通常已包含正文和图片；成功后再从内存派生 Markdown，
  // 避免第二路远程抓取和重复图片上传，也避免等待更慢的回退链。
  const { value: contentHtml, accepted: htmlAccepted } = await attempt('HTML 正文抓取',
    () => dependencies.fetchContent(article, 'html', 'desktop', trace),
    (value) => capturedHtmlRejection(value));
  if (contentHtml && htmlAccepted) {
    return {
      title,
      source,
      coverImage,
      contentHtml,
      contentMarkdown: convertCapturedHtmlToMarkdown(contentHtml) || null,
      content,
    };
  }

  const { value: contentMarkdown, accepted: markdownAccepted } = await attempt('Markdown 正文抓取',
    () => dependencies.fetchContent(article, 'markdown', 'desktop', trace),
    (value) => capturedMarkdownRejection(value));
  if (!contentMarkdown || !markdownAccepted) {
    throw failure('所有可用抓取方式均未返回有效正文');
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
