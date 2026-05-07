import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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
 */
export async function getArticleContent(articleId: number): Promise<string | null> {
  // 先查缓存
  const [meta] = await db
    .select({ contentMd: articleMetadata.contentMd })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (meta?.contentMd) return meta.contentMd;

  // 获取原始链接
  const [article] = await db
    .select({ originalUrl: articles.originalUrl })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article?.originalUrl) return null;

  // 抓取
  const md = await fetchMarkdown(article.originalUrl);
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
