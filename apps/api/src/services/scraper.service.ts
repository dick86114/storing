import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

interface ScrapedArticle {
  title: string;
  source: string;
  author: string | null;
  excerpt: string;
  content: string;
  readTimeMin: number;
  coverImage: string | null;
}

export async function scrapeArticle(url: string): Promise<ScrapedArticle> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; StoringBot/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  if (!parsed) {
    throw new Error('Failed to parse article content');
  }

  const content = parsed.textContent || '';
  const charCount = content.length;
  const readTimeMin = Math.max(1, Math.ceil(charCount / 500));

  const hostname = new URL(url).hostname.replace('www.', '');
  const source = parsed.siteName || hostname.split('.')[0];

  return {
    title: parsed.title || '',
    source,
    author: parsed.byline || null,
    excerpt: content.slice(0, 200),
    content: parsed.content || '',
    readTimeMin,
    coverImage: parsed.siteName ? null : null,
  };
}
