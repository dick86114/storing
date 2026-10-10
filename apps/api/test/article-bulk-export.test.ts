import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildExportEntryPath,
  buildExportManifest,
  buildObsidianMarkdown,
  sanitizeExportPathSegment,
  type BulkExportArticleInput,
} from '../src/services/article-bulk-export.js';

const article: BulkExportArticleInput = {
  articleId: 12,
  title: '标题: "引用"',
  author: '作者',
  source: 'wechat',
  originalUrl: 'https://example.com/a',
  publishedAt: '2026-01-02T03:04:05.000Z',
  savedAt: '2026-01-03T03:04:05.000Z',
  categoryName: '产品/研究',
  aiSummary: '摘要',
  aiTags: ['AI', '阅读'],
  contentMd: '# 正文',
};

test('清理路径分隔符并防止路径逃逸', () => {
  assert.equal(sanitizeExportPathSegment('../../evil', '未命名'), '.._.._evil');
  assert.equal(sanitizeExportPathSegment('a/b\\c', '未命名'), 'a_b_c');
  assert.equal(sanitizeExportPathSegment('a\u0000b', '未命名'), 'ab');
  assert.equal(sanitizeExportPathSegment('   ', '未命名'), '未命名');
});

test('Obsidian Markdown 包含 frontmatter 和正文', () => {
  const markdown = buildObsidianMarkdown(article);
  assert.match(markdown, /^---\n/);
  assert.match(markdown, /title: /);
  assert.match(markdown, /storing_id: 12/);
  assert.match(markdown, /# 正文/);
});

test('导出路径使用分类目录并保留文章 ID', () => {
  const usedPaths = new Set<string>();
  const path = buildExportEntryPath(article, usedPaths);
  assert.match(path, /^articles\/产品_研究\/标题: "引用"-12\.md$/);
  const duplicateTitlePath = buildExportEntryPath({ ...article, articleId: 13 }, usedPaths);
  assert.match(duplicateTitlePath, /标题: "引用"-13\.md$/);
});

test('manifest 记录格式、文章路径和失败项', () => {
  const manifest = JSON.parse(buildExportManifest('obsidian', [article], [
    { articleId: 13, code: 'NOT_FOUND', message: '不存在' },
  ]));
  assert.equal(manifest.format, 'obsidian');
  assert.equal(manifest.articles[0].articleId, 12);
  assert.equal(manifest.failures[0].articleId, 13);
});
