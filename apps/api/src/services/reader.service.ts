import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { JSDOM } from 'jsdom';
import {
  extractTextFromHtml,
  type HtmlVariant,
  isSingleFileCaptureHtml,
  prepareCapturedDocument,
  runSingleFile,
  uploadImagesInCapturedDocument,
  validateCapturedHtml,
} from './singlefile.service.js';

// 文章抓取服务配置（从环境变量读取）
const READER_API_BASE = process.env.READER_API_BASE || 'https://weixin.ali.idickies.com/api/public/v1/download';

// 图床服务配置（从环境变量读取）
const IMG_HOST = process.env.IMG_HOST || 'https://img.ali.idickies.com';
const IMG_API_KEY = process.env.IMG_API_KEY || '';

let ensureMobileHtmlColumnPromise: Promise<void> | null = null;

export async function ensureArticleMetadataContentHtmlMobileColumn() {
  if (!ensureMobileHtmlColumnPromise) {
    ensureMobileHtmlColumnPromise = db
      .execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS content_html_mobile TEXT`))
      .then(() => undefined)
      .catch((error) => {
        ensureMobileHtmlColumnPromise = null;
        throw error;
      });
  }

  await ensureMobileHtmlColumnPromise;
}

/** 清洗 markdown：去掉 CSS 块、封面图、重复标题、微信导航文字等噪音 */
function cleanMarkdown(md: string): string {
  let result = md
    // 去掉 CSS 规则行（包含 { } 的行，如 #js_row... { ... }）
    .replace(/^[^{}\n]*\{[^}]*\}.*$/gm, '')
    // 去掉开头的封面图
    .replace(/^\s*!\[.*?\]\(.*?\)\s*\n?/m, '')
    // 去掉微信特有的导航文字
    .replace(/^.*在小说阅读器.*$/gm, '')
    .replace(/^.*去阅读.*$/gm, '')
    // 去掉 "原创 XXX XXX [XXX](...)" 行
    .replace(/^原创\s+\S+\s+\S+\s+\[.*?\]\(.*?\).*$/gm, '')
    // 去掉多余空行（连续 3 个以上换行变成 2 个）
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 去掉开头的标题（Setext 标题 xxx\n=== 或 ATX 标题 # xxx），因为详情页已单独显示标题
  result = result
    .replace(/^.+\n={3,}\s*\n*/m, '')   // Setext: title\n===
    .replace(/^#{1,2}\s+.+\s*\n*/m, ''); // ATX: # title 或 ## title

  return result.trim();
}

/** 从 content_noencode 的 HTML 中提取正文和图片，按 <section> 分段处理 */
function extractContentFromHtml(html: string): { text: string; imageUrls: string[] } {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const sections = doc.querySelectorAll('section');
  const imageUrls: string[] = [];
  const textParts: string[] = [];

  if (sections.length > 0) {
    // 按 <section> 标签分段
    for (const section of sections) {
      // 检测是否包含图片（<img> 或带 data-src 的图片）
      const imgs = section.querySelectorAll('img');
      if (imgs.length > 0) {
        for (const img of imgs) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
          if (src && !src.startsWith('data:')) {
            imageUrls.push(src);
          }
        }
      } else {
        // 文本段落：提取纯文本，过滤掉空内容
        const text = section.textContent?.trim();
        if (text) {
          textParts.push(text);
        }
      }
    }
  } else {
    // 没有 section 标签，直接提取纯文本并按段落分割
    const body = doc.body;
    if (body) {
      // 按 p / div / br 分段
      const paragraphs = body.querySelectorAll('p, div');
      if (paragraphs.length > 0) {
        for (const p of paragraphs) {
          const text = p.textContent?.trim();
          if (text) {
            textParts.push(text);
          }
        }
      } else {
        // 兜底：取 body 纯文本
        const text = body.textContent?.trim();
        if (text) {
          textParts.push(text);
        }
      }

      // 提取所有图片
      const imgs = body.querySelectorAll('img');
      for (const img of imgs) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        if (src && !src.startsWith('data:')) {
          imageUrls.push(src);
        }
      }
    }
  }

  return {
    text: textParts.join('\n\n'),
    imageUrls,
  };
}

/** 检查 markdown 是否包含本地资源引用（如 ![[_resources/...]]） */
function hasLocalResourceRefs(md: string): boolean {
  return /!\[\[_resources\/.*?\]\]/.test(md);
}

/** 检查内容里是否还有会触发防盗链的微信图片外链 */
function hasWechatImageRefs(content: string): boolean {
  return /(mmbiz\.qpic\.cn|mmbiz\.qlogo\.cn|mmbiz\.qpic\.com|mp\.weixin\.qq\.com\/.*?(?:image|img))/i.test(content);
}

function getReadableTextLength(text: string): number {
  return text.replace(/\s+/g, '').length;
}

function hasUsefulMarkdownContent(md: string): boolean {
  const imageCount = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].filter((match) => Boolean(match[1]?.trim())).length;
  const textOnly = md
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .trim();

  return getReadableTextLength(textOnly) >= 80 || imageCount > 0;
}

function hasUsefulHtmlContent(html: string): boolean {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  doc.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());

  const bodyTextLength = getReadableTextLength(doc.body?.textContent || doc.documentElement.textContent || '');
  const imageCount = Array.from(doc.querySelectorAll('img')).filter((img) => Boolean(getImgOriginalUrl(img))).length;
  const hasEmptyWechatShareShell = Boolean(doc.querySelector('#js_article.share_content_page'))
    && getReadableTextLength(doc.querySelector('#js_base_container')?.textContent || '') === 0
    && imageCount === 0;

  return !hasEmptyWechatShareShell && (bodyTextLength >= 80 || imageCount > 0);
}

function hasUsefulContent(content: string, format: 'markdown' | 'html'): boolean {
  return format === 'html' ? hasUsefulHtmlContent(content) : hasUsefulMarkdownContent(content);
}

function normalizeRawHtmlFragment(html: string): string {
  const hasBlockTags = /<\/?(?:article|section|p|div|h[1-6]|blockquote|ul|ol|li|figure|table|pre)\b/i.test(html);
  if (hasBlockTags) return html;

  return html
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function normalizeImageUrl(url: string): string {
  const trimmed = url.trim().replace(/&amp;/g, '&');
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function cleanText(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized : null;
}

function extractTitleFromDocument(doc: Document): string | null {
  return cleanText(
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
    || doc.querySelector('title')?.textContent
    || doc.querySelector('h1')?.textContent
  );
}

function extractSourceFromDocument(doc: Document, originalUrl: string): string | null {
  const source = cleanText(
    doc.querySelector('#js_name')?.textContent
    || doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
    || doc.querySelector('meta[name="application-name"]')?.getAttribute('content')
  );
  if (source) return source.slice(0, 80);

  try {
    return new URL(originalUrl).hostname.replace(/^www\./, '').slice(0, 80) || null;
  } catch {
    return null;
  }
}

function extractAuthorFromDocument(doc: Document): string | null {
  return cleanText(
    doc.querySelector('meta[property="og:article:author"]')?.getAttribute('content')
    || doc.querySelector('meta[name="author"]')?.getAttribute('content')
    || doc.querySelector('#meta_content .rich_media_meta_text')?.textContent
  )?.slice(0, 80) || null;
}

function parsePublishTime(value: string | null | undefined): Date | null {
  const text = cleanText(value);
  if (!text) return null;

  const hasExplicitTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2}|(?:\s|^)(?:UTC|GMT))$/.test(text);
  if (hasExplicitTimezone) {
    const timestamp = Date.parse(text);
    if (!Number.isNaN(timestamp)) return new Date(timestamp);
  }

  const normalized = text
    .replace(/[/.]/g, '-')
    .replace(/年/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/[Tt]/g, ' ')
    .trim();

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const paddedMonth = month.padStart(2, '0');
  const paddedDay = day.padStart(2, '0');
  const paddedHour = hour.padStart(2, '0');
  return new Date(`${year}-${paddedMonth}-${paddedDay}T${paddedHour}:${minute}:${second}Z`);
}

function extractPublishTimeFromJsonLd(html: string): Date | null {
  const pattern = /"datePublished"\s*:\s*"([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    const parsed = parsePublishTime(match[1]);
    if (parsed) return parsed;
  }

  return null;
}

function extractPublishTimeFromText(text: string): Date | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const patterns = [
    /\b(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?\s+\d{1,2}:\d{2}(?::\d{2})?)/g,
    /\b(20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?)/g,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const parsed = parsePublishTime(match[1]);
      if (parsed) return parsed;
    }
  }

  return null;
}

function extractPublishTimeFromMarkdown(markdown: string): Date | null {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const focusedText = lines.join(' ');
  return extractPublishTimeFromText(focusedText);
}

function extractPublishTimeFromCachedHtml(html: string): Date | null {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  doc.querySelectorAll('script, style, noscript, template').forEach((node) => node.remove());
  const focusedText = (doc.body?.textContent || '').slice(0, 2000);
  return extractPublishTimeFromText(focusedText);
}

function extractPublishTimestampFromHtml(html: string): Date | null {
  const patterns = [
    /"publish_time"\s*:\s*(\d{10})/,
    /publish_time%22%3A(\d{10})/,
    /oriCreateTime\s*[=:]\s*['"]?(\d{10})/,
    /createTime\s*[=:]\s*['"]?(\d{10})/,
    /\bct\s*=\s*['"]?(\d{10})/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const timestamp = Number(match?.[1]);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return new Date(timestamp * 1000);
    }
  }

  return null;
}

function extractPublishTimeFromDocument(doc: Document): Date | null {
  const candidates = [
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content'),
    doc.querySelector('meta[property="og:article:published_time"]')?.getAttribute('content'),
    doc.querySelector('meta[name="publishdate"]')?.getAttribute('content'),
    doc.querySelector('time[datetime]')?.getAttribute('datetime'),
    doc.querySelector('#publish_time')?.textContent,
    doc.querySelector('em#publish_time')?.textContent,
  ];

  for (const candidate of candidates) {
    const parsed = parsePublishTime(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function extractWechatDisplayMetaFromMarkdown(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.includes('[') || !line.includes('javascript:void')) continue;

    const sourceMatch = line.match(/\[([^\]]+)\]\(javascript:void\\?\(0\\?\);\)/);
    const source = cleanText(sourceMatch?.[1]);
    if (!source) continue;

    const authorPart = cleanText(line.replace(sourceMatch?.[0] || '', ''));
    const author = authorPart ? authorPart.split(/\s+/)[0] : null;
    return {
      source: source.slice(0, 80),
      author: author?.slice(0, 80) || null,
    };
  }

  return { source: null, author: null };
}

async function fetchArticleDisplayMeta(originalUrl: string): Promise<{
  title: string | null;
  source: string | null;
  author: string | null;
  publishTime: Date | null;
}> {
  const res = await fetch(originalUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Display meta fetch failed: ${res.status}`);

  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  return {
    title: extractTitleFromDocument(doc),
    source: extractSourceFromDocument(doc, originalUrl),
    author: extractAuthorFromDocument(doc),
    publishTime:
      extractPublishTimeFromDocument(doc)
      || extractPublishTimeFromJsonLd(html)
      || extractPublishTimestampFromHtml(html)
      || extractPublishTimeFromText(doc.body?.textContent || ''),
  };
}

export async function repairArticleDisplayMeta(articleId: number): Promise<{
  title: string | null;
  source: string | null;
  author: string | null;
  publishTime: Date | null;
} | null> {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      publishTime: articles.publishTime,
      originalUrl: articles.originalUrl,
      content: articles.content,
      contentMarkdown: articleMetadata.contentMd,
      contentHtml: articleMetadata.contentHtml,
    })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(eq(articles.id, articleId));

  if (!article) return null;
  if (article.title && article.source && article.publishTime) {
    return {
      title: article.title,
      source: article.source,
      author: article.author,
      publishTime: article.publishTime,
    };
  }

  let fetchedMeta: Awaited<ReturnType<typeof fetchArticleDisplayMeta>> | null = null;
  if (article.originalUrl) {
    try {
      fetchedMeta = await fetchArticleDisplayMeta(article.originalUrl);
    } catch (error) {
      console.error(`Display meta fetch failed for article ${articleId}:`, (error as Error).message);
    }
  }

  const markdownMeta = article.contentMarkdown
    ? extractWechatDisplayMetaFromMarkdown(article.contentMarkdown)
    : { source: null, author: null };

  const fallbackRawSource = cleanText((article.content as any)?.source);
  const cachedPublishTime =
    (article.contentMarkdown ? extractPublishTimeFromMarkdown(article.contentMarkdown) : null)
    || (article.contentHtml ? extractPublishTimeFromCachedHtml(article.contentHtml) : null);

  const nextTitle = article.title || fetchedMeta?.title || null;
  const nextSource = article.source || fetchedMeta?.source || markdownMeta.source || fallbackRawSource || null;
  const nextAuthor = article.author || fetchedMeta?.author || markdownMeta.author || null;
  const nextPublishTime = article.publishTime || fetchedMeta?.publishTime || cachedPublishTime || null;

  if (
    nextTitle === article.title
    && nextSource === article.source
    && nextAuthor === article.author
    && nextPublishTime?.getTime?.() === article.publishTime?.getTime?.()
  ) {
    return {
      title: article.title,
      source: article.source,
      author: article.author,
      publishTime: article.publishTime,
    };
  }

  await db
    .update(articles)
    .set({
      title: nextTitle ?? undefined,
      source: nextSource ?? undefined,
      author: nextAuthor ?? undefined,
      publishTime: nextPublishTime ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, articleId));

  return {
    title: nextTitle,
    source: nextSource,
    author: nextAuthor,
    publishTime: nextPublishTime,
  };
}

function getRawContentPictureUrls(rawContent: any): string[] {
  if (!Array.isArray(rawContent?.picture_page_info_list)) return [];

  return rawContent.picture_page_info_list
    .map((pic: any) => pic?.cdn_url)
    .filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0)
    .map(normalizeImageUrl);
}

async function buildHtmlFromRawContent(rawContent: any): Promise<string | null> {
  if (!rawContent?.content_noencode) return null;

  const html = normalizeRawHtmlFragment(rawContent.content_noencode);
  const pictureUrls = getRawContentPictureUrls(rawContent);
  if (pictureUrls.length === 0) return uploadImagesInHtml(html);

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const usedPictureIndexes = new Set<number>();
  let insertedByReference = false;

  for (const link of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a.wx_img_refer_link[data-seq]'))) {
    const seq = Number(link.getAttribute('data-seq'));
    const pictureIndex = Number.isFinite(seq) ? seq - 1 : -1;
    const pictureUrl = pictureUrls[pictureIndex];
    if (!pictureUrl) continue;

    usedPictureIndexes.add(pictureIndex);
    insertedByReference = true;

    const figure = doc.createElement('figure');
    figure.className = 'wechat-inline-image';

    const img = doc.createElement('img');
    img.setAttribute('src', pictureUrl);
    img.setAttribute('alt', link.getAttribute('data-refer') || `图${seq}`);
    img.setAttribute('loading', 'lazy');
    figure.appendChild(img);

    const paragraph = link.closest('p, section, div');
    if (paragraph?.parentNode) {
      paragraph.parentNode.insertBefore(figure, paragraph.nextSibling);
    } else {
      link.parentNode?.insertBefore(figure, link.nextSibling);
    }
  }

  if (!insertedByReference) {
    for (let index = 0; index < pictureUrls.length; index += 1) {
      const figure = doc.createElement('figure');
      figure.className = 'wechat-inline-image';

      const img = doc.createElement('img');
      img.setAttribute('src', pictureUrls[index]);
      img.setAttribute('alt', `图${index + 1}`);
      img.setAttribute('loading', 'lazy');
      figure.appendChild(img);
      doc.body.appendChild(figure);
    }
  } else {
    for (let index = 0; index < pictureUrls.length; index += 1) {
      if (usedPictureIndexes.has(index)) continue;
      const figure = doc.createElement('figure');
      figure.className = 'wechat-inline-image';

      const img = doc.createElement('img');
      img.setAttribute('src', pictureUrls[index]);
      img.setAttribute('alt', `图${index + 1}`);
      img.setAttribute('loading', 'lazy');
      figure.appendChild(img);
      doc.body.appendChild(figure);
    }
  }

  return uploadImagesInHtml(doc.body?.innerHTML || html);
}

function getImgOriginalUrl(img: HTMLImageElement): string | null {
  const candidateAttrs = [
    'data-src',
    'data-original',
    'data-backsrc',
    'data-croporisrc',
    'data-actualsrc',
    'data-lazy-src',
    'data-url',
    'src',
  ];

  for (const attr of candidateAttrs) {
    const value = img.getAttribute(attr);
    if (value?.startsWith('data:image/')) {
      return value;
    }
    if (value && !value.startsWith('data:')) {
      return normalizeImageUrl(value);
    }
  }

  return null;
}

function getDataImageBlob(dataUrl: string): { blob: Blob; filename: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const [, mime, base64] = match;
  try {
    const buffer = Buffer.from(base64, 'base64');
    const extension = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return { blob: new Blob([buffer], { type: mime }), filename: `image.${extension}` };
  } catch {
    return null;
  }
}

/** 上传单张图片到图床，返回新 URL */
export async function uploadImage(imageUrl: string): Promise<string | null> {
  try {
    let blob: Blob;
    let filename = 'image.jpg';

    if (imageUrl.startsWith('data:image/')) {
      const dataImage = getDataImageBlob(imageUrl);
      if (!dataImage) return null;
      blob = dataImage.blob;
      filename = dataImage.filename;
    } else {
      // 下载图片
      const imgRes = await fetch(imageUrl, {
        headers: { 'User-Agent': 'StoringBot/1.0', 'Referer': 'https://mp.weixin.qq.com/' },
        signal: AbortSignal.timeout(15000),
      });
      if (!imgRes.ok) return null;

      const buffer = await imgRes.arrayBuffer();
      const type = imgRes.headers.get('content-type') || undefined;
      blob = new Blob([buffer], type ? { type } : undefined);
      const urlExt = imageUrl.split('?')[0]?.match(/\.(png|jpe?g|webp|gif|avif)$/i)?.[1];
      if (urlExt) filename = `image.${urlExt.toLowerCase().replace('jpeg', 'jpg')}`;
    }

    // 上传到图床
    const form = new FormData();
    form.append('file', blob, filename);

    const uploadRes = await fetch(`${IMG_HOST}/api/upload/private`, {
      method: 'POST',
      headers: { 'X-API-Key': IMG_API_KEY },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (!uploadRes.ok) return null;
    const json = await uploadRes.json() as { success?: boolean; data?: { url?: string } };
    if (!json?.success || !json.data?.url) return null;

    return `${IMG_HOST}${json.data.url}`;
  } catch (e) {
    console.error(`Image upload failed: ${imageUrl}`, (e as Error).message);
    return null;
  }
}

/** 并发限制执行器 */
async function limitConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });
    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/** 批量上传 markdown 中的图片到图床并替换 URL（限制并发） */
async function uploadImagesInMarkdown(md: string): Promise<string> {
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...md.matchAll(imagePattern)];
  if (matches.length === 0) return md;

  // 使用并发限制（最多 3 个并发）
  const tasks = matches.map((match) => {
    const [fullMatch, alt, url] = match;
    return async () => {
      // 跳过已经是图床的 URL
      if (url.startsWith(IMG_HOST)) return { original: fullMatch, replacement: fullMatch };
      const newUrl = await uploadImage(url);
      if (!newUrl) return { original: fullMatch, replacement: fullMatch };
      return { original: fullMatch, replacement: `![${alt}](${newUrl})` };
    };
  });

  const results = await limitConcurrency(tasks, 3);

  let result = md;
  for (const { original, replacement } of results) {
    if (original !== replacement) {
      result = result.replace(original, replacement);
    }
  }
  return result;
}

/** 批量上传 HTML 中的图片到图床并替换 URL（优先处理 data-src，最终赋给 src，限制并发） */
export async function uploadImagesInHtml(html: string): Promise<string> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.length === 0) return html;

  const tasks = imgs.map((img) => async () => {
    const originalUrl = getImgOriginalUrl(img);
    if (!originalUrl || originalUrl.startsWith(IMG_HOST)) return null;

    const newUrl = await uploadImage(originalUrl);
    return newUrl ? { img, newUrl } : null;
  });

  const results = await limitConcurrency(tasks, 3);

  for (const result of results) {
    if (!result) continue;
    const { img, newUrl } = result;
    img.setAttribute('src', newUrl);
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.removeAttribute('srcset');
    img.removeAttribute('data-src');
    img.removeAttribute('data-original');
    img.removeAttribute('data-backsrc');
    img.removeAttribute('data-croporisrc');
    img.removeAttribute('data-actualsrc');
    img.removeAttribute('data-lazy-src');
    img.removeAttribute('data-url');
  }

  return doc.body?.innerHTML || html;
}

/** 清洗 HTML：移除标题、作者信息等头部元素 */
function cleanHtml(html: string): string {
  // 使用 JSDOM 解析 HTML
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // 移除标题 (h1.rich_media_title 或 #activity-name)
  const titleEl = doc.querySelector('#activity-name, .rich_media_title');
  if (titleEl) titleEl.remove();

  // 移除作者信息 (#meta_content 或 .rich_media_meta_list)
  const metaEl = doc.querySelector('#meta_content, .rich_media_meta_list');
  if (metaEl) metaEl.remove();

  // 移除其他常见的微信头部元素
  const selectorsToRemove = [
    '#js_a11y_op_title_modify',  // 标题修改提示
    '#js_profile_card',          // 作者卡片
    '.rich_media_tool',          // 工具栏
    '#js_content_toolbar',       // 内容工具栏
    '#js_bottom_area',           // 底部区域
  ];
  
  for (const selector of selectorsToRemove) {
    const el = doc.querySelector(selector);
    if (el) el.remove();
  }

  // 返回 body 的 innerHTML
  return doc.body?.innerHTML || html;
}

/**
 * 从 Reader API 抓取文章内容（含图片上传）
 * @param url 原始文章 URL
 * @param format 格式：markdown 或 html
 */
async function fetchContent(url: string, format: 'markdown' | 'html' = 'markdown'): Promise<string> {
  const apiUrl = `${READER_API_BASE}?url=${encodeURIComponent(url)}&format=${format}`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'StoringBot/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Reader API error: ${res.status}`);
  const raw = await res.text();
  
  if (format === 'html') {
    // HTML 格式：清洗、上传图片并替换 URL
    const cleaned = cleanHtml(raw);
    return uploadImagesInHtml(cleaned);
  } else {
    // Markdown 格式：清洗并上传图片
    const cleaned = cleanMarkdown(raw);
    return uploadImagesInMarkdown(cleaned);
  }
}

function isSingleFileCollectedArticle(article: {
  content: unknown;
  contentHtml?: string | null;
}) {
  const rawContent = article.content as any;
  return rawContent?.collectMethod === 'singlefile' || isSingleFileCaptureHtml(article.contentHtml);
}

async function fetchSingleFileCaptureContent(originalUrl: string, variant: HtmlVariant) {
  const { html } = await runSingleFile(originalUrl, variant);
  const validation = validateCapturedHtml(html, originalUrl);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const prepared = prepareCapturedDocument(html, originalUrl);
  return uploadImagesInCapturedDocument(prepared.html, originalUrl, uploadImage);
}

async function fetchSingleFileMarkdownContent(originalUrl: string) {
  const html = await fetchSingleFileCaptureContent(originalUrl, 'desktop');
  return html ? extractTextFromHtml(html) : null;
}

async function fetchArticleContentFromSources(
  articleId: number,
  format: 'markdown' | 'html',
  htmlVariant: HtmlVariant = 'desktop'
): Promise<string | null> {
  const [article] = await db
    .select({
      originalUrl: articles.originalUrl,
      content: articles.content,
      contentMarkdown: articles.contentMarkdown,
      contentHtml: articles.contentHtml,
    })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  let content: string | null = null;

  if (format === 'html' && article.originalUrl && isSingleFileCollectedArticle(article)) {
    try {
      const captured = await fetchSingleFileCaptureContent(article.originalUrl, htmlVariant);
      if (captured && hasUsefulContent(captured, format)) {
        content = captured;
      }
    } catch (e) {
      console.error(`SingleFile ${htmlVariant} capture failed for article ${articleId}:`, (e as Error).message);
    }
  }

  if (format === 'markdown' && article.originalUrl && isSingleFileCollectedArticle(article)) {
    try {
      const captured = await fetchSingleFileMarkdownContent(article.originalUrl);
      if (captured && hasUsefulContent(captured, format)) {
        content = captured;
      }
    } catch (e) {
      console.error(`SingleFile markdown capture failed for article ${articleId}:`, (e as Error).message);
    }
  }

  if (!content && article.originalUrl) {
    try {
      const fetched = await fetchContent(article.originalUrl, format);
      if (fetched && hasUsefulContent(fetched, format)) {
        if (format === 'markdown' && !hasLocalResourceRefs(fetched)) {
          content = fetched;
        } else if (format === 'html') {
          content = fetched;
        }
      }
    } catch (e) {
      console.error(`Reader API fetch failed for article ${articleId}:`, (e as Error).message);
    }
  }

  if (!content && article.content) {
    const rawContent = article.content as any;

    if (format === 'html') {
      if (rawContent.content_noencode) {
        const htmlContent = await buildHtmlFromRawContent(rawContent);
        if (htmlContent && hasUsefulContent(htmlContent, format)) {
          content = htmlContent;
        }
      }
    } else {
      const parts: string[] = [];

      if (rawContent.content_noencode) {
        const extracted = extractContentFromHtml(rawContent.content_noencode);
        if (extracted.text) {
          parts.push(extracted.text);
        }
        if (extracted.imageUrls.length > 0) {
          const uploadResults = await Promise.all(
            extracted.imageUrls.map(async (url) => {
              if (url.startsWith(IMG_HOST)) return `![图片](${url})`;
              const newUrl = await uploadImage(url);
              return newUrl ? `![图片](${newUrl})` : `![图片](${url})`;
            })
          );
          parts.push(...uploadResults);
        }
      }

      if (Array.isArray(rawContent.picture_page_info_list) && rawContent.picture_page_info_list.length > 0) {
        for (const pic of rawContent.picture_page_info_list) {
          if (pic.cdn_url) {
            const originalUrl = normalizeImageUrl(pic.cdn_url);
            const alreadyIncluded = parts.some(p => p.includes(originalUrl));
            if (!alreadyIncluded) {
              const newUrl = await uploadImage(originalUrl);
              parts.push(newUrl ? `![图片](${newUrl})` : `![图片](${originalUrl})`);
            }
          }
        }
      }

      if (parts.length > 0) {
        content = parts.join('\n\n');
      }
    }
  }

  if (!content) {
    const storedContent = format === 'html' ? article.contentHtml : article.contentMarkdown;
    if (storedContent && hasUsefulContent(storedContent, format)) {
      content = storedContent;
    }
  }

  return content;
}

async function saveArticleContentCache(
  articleId: number,
  format: 'markdown' | 'html',
  content: string,
  htmlVariant: HtmlVariant = 'desktop'
): Promise<void> {
  await ensureArticleMetadataContentHtmlMobileColumn();
  const [existing] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  const updateField =
    format === 'html'
      ? htmlVariant === 'mobile'
        ? { contentHtmlMobile: content }
        : { contentHtml: content }
      : { contentMd: content };

  if (existing) {
    await db.update(articleMetadata)
      .set({ ...updateField, updatedAt: new Date() })
      .where(eq(articleMetadata.articleId, articleId));
  } else {
    await db.insert(articleMetadata)
      .values({ articleId, ...updateField });
  }
}

async function refreshArticleContentCache(
  articleId: number,
  format: 'markdown' | 'html',
  htmlVariant: HtmlVariant = 'desktop'
): Promise<void> {
  const content = await fetchArticleContentFromSources(articleId, format, htmlVariant);
  if (content) {
    await saveArticleContentCache(articleId, format, content, htmlVariant);
  }
}

/**
 * 获取文章内容（首次抓取并缓存，后续读库）
 * 优先从 Reader API 抓取，失败则 fallback 到 articles.content 字段
 * @param articleId 文章 ID
 * @param format 格式：markdown 或 html
 */
export async function getArticleContent(
  articleId: number,
  format: 'markdown' | 'html' = 'markdown',
  htmlVariant: HtmlVariant = 'desktop'
): Promise<string | null> {
  await ensureArticleMetadataContentHtmlMobileColumn();
  // 先查缓存
  const [meta] = await db
    .select({
      contentMd: articleMetadata.contentMd,
      contentHtml: articleMetadata.contentHtml,
      contentHtmlMobile: articleMetadata.contentHtmlMobile,
    })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (format === 'html') {
    const cachedHtml = htmlVariant === 'mobile' ? meta?.contentHtmlMobile : meta?.contentHtml;

    // HTML 格式：检查缓存
    if (cachedHtml) {
      if (!hasUsefulContent(cachedHtml, format)) {
        const content = await fetchArticleContentFromSources(articleId, format, htmlVariant);
        if (!content) return null;
        await saveArticleContentCache(articleId, format, content, htmlVariant);
        return content;
      }
      if (htmlVariant === 'desktop' && hasWechatImageRefs(cachedHtml)) {
        refreshArticleContentCache(articleId, format, htmlVariant).catch((e) =>
          console.error(`Background HTML cache refresh failed for article ${articleId}:`, (e as Error).message)
        );
      }
      return cachedHtml;
    }

    if (htmlVariant === 'mobile' && meta?.contentHtml && hasUsefulContent(meta.contentHtml, format)) {
      refreshArticleContentCache(articleId, format, htmlVariant).catch((e) =>
        console.error(`Background mobile HTML cache refresh failed for article ${articleId}:`, (e as Error).message)
      );
      return meta.contentHtml;
    }
  } else {
    // Markdown 格式：检查缓存（排除本地资源引用的脏缓存）
    if (meta?.contentMd) {
      if (!hasUsefulContent(meta.contentMd, format)) {
        const content = await fetchArticleContentFromSources(articleId, format, htmlVariant);
        if (!content) return null;
        await saveArticleContentCache(articleId, format, content, htmlVariant);
        return content;
      }
      if (hasLocalResourceRefs(meta.contentMd) || hasWechatImageRefs(meta.contentMd)) {
        refreshArticleContentCache(articleId, format, htmlVariant).catch((e) =>
          console.error(`Background Markdown cache refresh failed for article ${articleId}:`, (e as Error).message)
        );
      }
      return meta.contentMd;
    }
  }

  const content = await fetchArticleContentFromSources(articleId, format, htmlVariant);

  if (!content) return null;

  await saveArticleContentCache(articleId, format, content, htmlVariant);

  return content;
}

/** 从 markdown 中提取第一张图片 URL */
function extractFirstImageUrl(md: string): string | null {
  const match = md.match(/!\[.*?\]\(([^)]+)\)/);
  return match ? match[1] : null;
}

/**
 * 处理封面图：上传到图床，如果没有则从正文取第一张图
 * 保存到 article_metadata.cover_image
 */
export async function processCoverImage(articleId: number): Promise<string | null> {
  // 查询文章的封面图和原始链接
  const [article] = await db
    .select({
      coverImage: articles.coverImage,
      originalUrl: articles.originalUrl,
    })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  let coverImageUrl: string | null = null;

  // 优先使用源数据的封面图
  if (article.coverImage) {
    coverImageUrl = article.coverImage;
  } else {
    // 没有封面图，从正文提取第一张图片
    const content = await getArticleContent(articleId);
    if (content) {
      coverImageUrl = extractFirstImageUrl(content);
    }
  }

  if (!coverImageUrl) return null;

  // 上传到图床；如果采集流程已经上传过，直接复用。
  const uploadedUrl = coverImageUrl.startsWith(IMG_HOST) ? coverImageUrl : await uploadImage(coverImageUrl);
  if (!uploadedUrl) {
    console.error(`Cover image upload failed for article ${articleId}: ${coverImageUrl}`);
    return null;
  }

  // 确保 metadata 记录存在并保存封面图
  const [existingMeta] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (existingMeta) {
    await db.update(articleMetadata)
      .set({ coverImage: uploadedUrl, updatedAt: new Date() })
      .where(eq(articleMetadata.articleId, articleId));
  } else {
    await db.insert(articleMetadata)
      .values({ articleId, coverImage: uploadedUrl });
  }

  return uploadedUrl;
}
