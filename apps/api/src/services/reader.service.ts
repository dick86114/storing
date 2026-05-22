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

/** 批量上传 HTML 中的图片到图床并替换 URL（优先处理 data-src，最终赋给 src） */
async function uploadImagesInHtml(html: string): Promise<string> {
  // 匹配所有 img 标签
  const imgPattern = /<img[^>]*>/gi;
  const matches = [...html.matchAll(imgPattern)];
  if (matches.length === 0) return html;

  const uploads = matches.map(async (match) => {
    const [fullMatch] = match;
    
    // 优先提取 data-src（真实图片地址），其次 src
    const dataSrcMatch = fullMatch.match(/data-src=["']([^"']+)["']/i);
    const srcMatch = fullMatch.match(/src=["']([^"']+)["']/i);
    
    const originalUrl = dataSrcMatch?.[1] || srcMatch?.[1];
    if (!originalUrl) return { original: fullMatch, replacement: fullMatch };
    
    // 跳过已经是图床的 URL
    if (originalUrl.startsWith(IMG_HOST)) return { original: fullMatch, replacement: fullMatch };
    
    const newUrl = await uploadImage(originalUrl);
    if (!newUrl) return { original: fullMatch, replacement: fullMatch };
    
    // 构建新的 img 标签：把图床地址赋给 src，移除 data-src
    let newImg = fullMatch;
    
    // 移除 data-src 属性
    if (dataSrcMatch) {
      newImg = newImg.replace(dataSrcMatch[0], '');
    }
    
    // 替换或添加 src 属性
    if (srcMatch) {
      newImg = newImg.replace(srcMatch[0], `src="${newUrl}"`);
    } else {
      // 如果没有 src，添加一个
      newImg = newImg.replace(/<img/i, `<img src="${newUrl}"`);
    }
    
    // 清理多余空格
    newImg = newImg.replace(/\s+/g, ' ').replace(/\s*>/g, '>');
    
    return { original: fullMatch, replacement: newImg };
  });

  const results = await Promise.all(uploads);

  let result = html;
  for (const { original, replacement } of results) {
    if (original !== replacement) {
      result = result.replace(original, replacement);
    }
  }
  return result;
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

/**
 * 获取文章内容（首次抓取并缓存，后续读库）
 * 优先从 Reader API 抓取，失败则 fallback 到 articles.content 字段
 * @param articleId 文章 ID
 * @param format 格式：markdown 或 html
 */
export async function getArticleContent(articleId: number, format: 'markdown' | 'html' = 'markdown'): Promise<string | null> {
  // 先查缓存
  const [meta] = await db
    .select({ contentMd: articleMetadata.contentMd, contentHtml: articleMetadata.contentHtml })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (format === 'html') {
    // HTML 格式：检查缓存
    if (meta?.contentHtml) return meta.contentHtml;
  } else {
    // Markdown 格式：检查缓存（排除本地资源引用的脏缓存）
    if (meta?.contentMd && !hasLocalResourceRefs(meta.contentMd)) return meta.contentMd;
    // 标记需要刷新：如果有脏缓存，先清除
    if (meta?.contentMd && hasLocalResourceRefs(meta.contentMd)) {
      await db.update(articleMetadata)
        .set({ contentMd: null, updatedAt: new Date() })
        .where(eq(articleMetadata.articleId, articleId));
    }
  }

  // 获取原始链接和 content 字段
  const [article] = await db
    .select({ originalUrl: articles.originalUrl, content: articles.content })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  let content: string | null = null;

  // 尝试通过 Reader API 抓取
  if (article.originalUrl) {
    try {
      const fetched = await fetchContent(article.originalUrl, format);
      // 只有内容长度足够时才使用
      if (fetched && fetched.length >= 100) {
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

  // Reader API 抓取失败，fallback 到 articles.content 字段（仅 Markdown）
  if (!content && format === 'markdown' && article.content) {
    const rawContent = article.content as any;
    const parts: string[] = [];

    // 从 content_noencode 提取正文和图片（HTML 解析）
    if (rawContent.content_noencode) {
      const extracted = extractContentFromHtml(rawContent.content_noencode);
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
    if (Array.isArray(rawContent.picture_page_info_list) && rawContent.picture_page_info_list.length > 0) {
      for (const pic of rawContent.picture_page_info_list) {
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
      content = parts.join('\n\n');
    }
  }

  if (!content) return null;

  // 确保 metadata 记录存在并保存内容
  const [existing] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  const updateField = format === 'html' ? { contentHtml: content } : { contentMd: content };

  if (existing) {
    await db.update(articleMetadata)
      .set({ ...updateField, updatedAt: new Date() })
      .where(eq(articleMetadata.articleId, articleId));
  } else {
    await db.insert(articleMetadata)
      .values({ articleId, ...updateField });
  }

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

  // 上传到图床
  const uploadedUrl = await uploadImage(coverImageUrl);
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
