import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { JSDOM } from 'jsdom';

// 文章抓取服务配置（从环境变量读取）
const READER_API_BASE = process.env.READER_API_BASE || 'https://weixin.ali.idickies.com/api/public/v1/download';

// 图床服务配置（从环境变量读取）
const IMG_HOST = process.env.IMG_HOST || 'https://img.ali.idickies.com';
const IMG_API_KEY = process.env.IMG_API_KEY || '';

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

/** 上传单张图片到图床，返回新 URL */
async function uploadImage(imageUrl: string): Promise<string | null> {
  try {
    // 下载图片
    const imgRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'StoringBot/1.0', 'Referer': 'https://mp.weixin.qq.com/' },
      signal: AbortSignal.timeout(15000),
    });
    if (!imgRes.ok) return null;

    const buffer = await imgRes.arrayBuffer();
    const blob = new Blob([buffer]);

    // 上传到图床
    const form = new FormData();
    form.append('file', blob, 'image.jpg');

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

/** 批量上传 markdown 中的图片到图床并替换 URL */
async function uploadImagesInMarkdown(md: string): Promise<string> {
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = [...md.matchAll(imagePattern)];
  if (matches.length === 0) return md;

  // 并发上传所有图片
  const uploads = matches.map(async (match) => {
    const [fullMatch, alt, url] = match;
    // 跳过已经是图床的 URL
    if (url.startsWith(IMG_HOST)) return { original: fullMatch, replacement: fullMatch };
    const newUrl = await uploadImage(url);
    if (!newUrl) return { original: fullMatch, replacement: fullMatch };
    return { original: fullMatch, replacement: `![${alt}](${newUrl})` };
  });

  const results = await Promise.all(uploads);

  let result = md;
  for (const { original, replacement } of results) {
    if (original !== replacement) {
      result = result.replace(original, replacement);
    }
  }
  return result;
}

/**
 * 从 Reader API 抓取文章 markdown 内容（含图片上传）
 */
async function fetchMarkdown(url: string): Promise<string> {
  const apiUrl = `${READER_API_BASE}?url=${encodeURIComponent(url)}&format=markdown`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'StoringBot/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Reader API error: ${res.status}`);
  const raw = await res.text();
  const cleaned = cleanMarkdown(raw);
  // 上传图片到图床
  return uploadImagesInMarkdown(cleaned);
}

/**
 * 获取文章 markdown 内容（首次抓取并缓存，后续读库）
 * 优先从 Reader API 抓取，失败则 fallback 到 articles.content 字段
 */
export async function getArticleContent(articleId: number): Promise<string | null> {
  // 先查缓存（排除本地资源引用的脏缓存）
  const [meta] = await db
    .select({ contentMd: articleMetadata.contentMd })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (meta?.contentMd && !hasLocalResourceRefs(meta.contentMd)) return meta.contentMd;

  // 标记需要刷新：如果有脏缓存，先清除
  if (meta?.contentMd && hasLocalResourceRefs(meta.contentMd)) {
    await db.update(articleMetadata)
      .set({ contentMd: null, updatedAt: new Date() })
      .where(eq(articleMetadata.articleId, articleId));
  }

  // 获取原始链接和 content 字段
  const [article] = await db
    .select({ originalUrl: articles.originalUrl, content: articles.content })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  let md: string | null = null;

  // 尝试通过 Reader API 抓取
  if (article.originalUrl) {
    try {
      const fetched = await fetchMarkdown(article.originalUrl);
      // 只有内容长度足够且不包含本地资源引用时才使用
      if (fetched && fetched.length >= 100 && !hasLocalResourceRefs(fetched)) {
        md = fetched;
      }
    } catch (e) {
      console.error(`Reader API fetch failed for article ${articleId}:`, (e as Error).message);
    }
  }

  // Reader API 抓取失败或结果太短或包含本地资源引用，fallback 到 articles.content 字段
  if (!md && article.content) {
    const content = article.content as any;
    const parts: string[] = [];

    // 从 content_noencode 提取正文和图片（HTML 解析）
    if (content.content_noencode) {
      const extracted = extractContentFromHtml(content.content_noencode);
      if (extracted.text) {
        parts.push(extracted.text);
      }
      // 从 content_noencode 中提取的图片 URL
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

    // 如果 content_noencode 中没有图片，再从 picture_page_info_list 取图片
    if (Array.isArray(content.picture_page_info_list) && content.picture_page_info_list.length > 0) {
      for (const pic of content.picture_page_info_list) {
        if (pic.cdn_url) {
          // 检查是否已在 content_noencode 提取的图片中
          const alreadyIncluded = parts.some(p => p.includes(pic.cdn_url));
          if (!alreadyIncluded) {
            const newUrl = await uploadImage(pic.cdn_url);
            parts.push(newUrl ? `![图片](${newUrl})` : `![图片](${pic.cdn_url})`);
          }
        }
      }
    }

    if (parts.length > 0) {
      md = parts.join('\n\n');
    }
  }

  if (!md) return null;

  // 确保 metadata 记录存在
  const [existing] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (existing) {
    await db.update(articleMetadata)
      .set({ contentMd: md, updatedAt: new Date() })
      .where(eq(articleMetadata.articleId, articleId));
  } else {
    await db.insert(articleMetadata)
      .values({ articleId, contentMd: md });
  }

  return md;
}
