import type { ArticleBulkIssue, BulkExportFormat } from '@storing/shared';

export interface BulkExportArticleInput {
  articleId: number;
  title: string;
  author: string | null;
  source: string | null;
  originalUrl: string | null;
  publishedAt: Date | string | null;
  savedAt: Date | string | null;
  categoryName: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  contentMd: string | null;
}

function yamlValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function yamlDate(value: Date | string | null): string {
  if (!value) return 'null';
  return yamlValue(value instanceof Date ? value.toISOString() : value);
}

export function sanitizeExportPathSegment(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized && sanitized !== '.' && sanitized !== '..' ? sanitized : fallback;
}

function exportFileName(article: BulkExportArticleInput): string {
  return `${sanitizeExportPathSegment(article.title || '未命名文章', '未命名文章')}-${article.articleId}.md`;
}

export function buildExportEntryPath(
  article: BulkExportArticleInput,
  usedPaths: Set<string>,
): string {
  const category = sanitizeExportPathSegment(article.categoryName || '未分类', '未分类');
  let path = `articles/${category}/${exportFileName(article)}`;
  let sequence = 2;
  while (usedPaths.has(path)) {
    path = `articles/${category}/${exportFileName(article).replace(/\.md$/, `-${sequence}.md`)}`;
    sequence += 1;
  }
  usedPaths.add(path);
  return path;
}

export function buildObsidianMarkdown(article: BulkExportArticleInput): string {
  const tags = article.aiTags ?? [];
  const frontmatter = [
    '---',
    `title: ${yamlValue(article.title || '未命名文章')}`,
    `author: ${yamlValue(article.author)}`,
    `source: ${yamlValue(article.source)}`,
    `url: ${yamlValue(article.originalUrl)}`,
    `published: ${yamlDate(article.publishedAt)}`,
    `saved: ${yamlDate(article.savedAt)}`,
    `category: ${yamlValue(article.categoryName)}`,
    'tags:',
    ...tags.map((tag) => `  - ${yamlValue(tag)}`),
    `summary: ${yamlValue(article.aiSummary)}`,
    `storing_id: ${article.articleId}`,
    '---',
  ].join('\n');
  return `${frontmatter}\n\n${article.contentMd || ''}\n`;
}

export function buildExportManifest(
  format: BulkExportFormat,
  articles: BulkExportArticleInput[],
  failures: ArticleBulkIssue[],
): string {
  const usedPaths = new Set<string>();
  return JSON.stringify({
    format,
    generatedAt: new Date().toISOString(),
    articles: articles.map((article) => ({
      articleId: article.articleId,
      title: article.title,
      path: buildExportEntryPath(article, usedPaths),
    })),
    failures,
  }, null, 2);
}
