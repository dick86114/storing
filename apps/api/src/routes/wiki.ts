import { Hono } from 'hono';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  buildWikiMarkdownExport,
  buildWikiPageMarkdownExport,
  enqueueAllArchivedForWiki,
  enqueueArticleForWiki,
  enqueuePageRebuild,
  askWiki,
  fileWikiAnswer,
  getWikiAnswers,
  getWikiArticleStatus,
  getWikiGraph,
  getWikiHome,
  getWikiIndex,
  getWikiJobs,
  getWikiLintFindings,
  getWikiLog,
  getWikiPage,
  getWikiStatus,
  processWikiJobs,
  reconcileWikiClaims,
  rebuildAllWiki,
  retryFailedWikiJobs,
  runWikiLint,
  searchWiki,
} from '../services/wiki.service.js';

export const wikiRoutes = new Hono();

wikiRoutes.get('/wiki', optionalAuth, async (c) => {
  const data = await getWikiHome(c.req.query('type'));
  return c.json(data);
});

wikiRoutes.get('/wiki/status', optionalAuth, async (c) => {
  return c.json(await getWikiStatus());
});

wikiRoutes.get('/wiki/index', optionalAuth, async (c) => {
  return c.json(await getWikiIndex());
});

wikiRoutes.get('/wiki/log', optionalAuth, async (c) => {
  const limit = Number(c.req.query('limit') || 50);
  return c.json(await getWikiLog(limit));
});

wikiRoutes.get('/wiki/graph', optionalAuth, async (c) => {
  return c.json(await getWikiGraph());
});

wikiRoutes.get('/wiki/lint', optionalAuth, async (c) => {
  const status = c.req.query('status') || 'open';
  const limit = Number(c.req.query('limit') || 50);
  return c.json(await getWikiLintFindings(status, limit));
});

wikiRoutes.get('/wiki/jobs', requireAuth, async (c) => {
  const status = c.req.query('status') || 'pending';
  const limit = Number(c.req.query('limit') || 30);
  return c.json({ jobs: await getWikiJobs(status, limit) });
});

wikiRoutes.get('/wiki/answers', requireAuth, async (c) => {
  const limit = Number(c.req.query('limit') || 20);
  return c.json({ answers: await getWikiAnswers(limit) });
});

wikiRoutes.get('/wiki/search', optionalAuth, async (c) => {
  const q = c.req.query('q') || '';
  const limit = Number(c.req.query('limit') || 20);
  return c.json(await searchWiki(q, limit));
});

wikiRoutes.get('/wiki/pages/:slug', optionalAuth, async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  const page = await getWikiPage(slug);
  if (!page) return c.json({ error: { code: 'NOT_FOUND', message: 'Wiki page not found' } }, 404);
  return c.json(page);
});

wikiRoutes.get('/wiki/articles/:id/status', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid article id' } }, 400);
  return c.json(await getWikiArticleStatus(id));
});

wikiRoutes.post('/wiki/update', requireAuth, async (c) => {
  const queued = await enqueueAllArchivedForWiki();
  const result = await processWikiJobs(Number(c.req.query('limit') || 8));
  return c.json({ queued, ...result });
});

wikiRoutes.post('/wiki/process', requireAuth, async (c) => {
  const result = await processWikiJobs(Number(c.req.query('limit') || 8));
  return c.json(result);
});

wikiRoutes.post('/wiki/retry-failed', requireAuth, async (c) => {
  await retryFailedWikiJobs();
  const result = await processWikiJobs(Number(c.req.query('limit') || 8));
  return c.json(result);
});

wikiRoutes.post('/wiki/rebuild-all', requireAuth, async (c) => {
  const result = await rebuildAllWiki(Number(c.req.query('limit') || 4));
  return c.json(result);
});

wikiRoutes.post('/wiki/lint', requireAuth, async (c) => {
  return c.json(await runWikiLint());
});

wikiRoutes.post('/wiki/export-markdown', requireAuth, async (c) => {
  return c.json(await buildWikiMarkdownExport());
});

wikiRoutes.post('/wiki/pages/:slug/export-markdown', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  const result = await buildWikiPageMarkdownExport(slug);
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Wiki page not found' } }, 404);
  return c.json(result);
});

wikiRoutes.post('/wiki/claims/reconcile', requireAuth, async (c) => {
  return c.json(await reconcileWikiClaims());
});

wikiRoutes.post('/wiki/ask', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const question = String(body.question || '').trim();
  if (!question) return c.json({ error: { code: 'BAD_REQUEST', message: '请输入要询问知识库的问题。' } }, 400);
  return c.json(await askWiki(question, Array.isArray(body.history) ? body.history : []));
});

wikiRoutes.post('/wiki/answers/:id/file', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid answer id' } }, 400);
  return c.json(await fileWikiAnswer(id));
});

wikiRoutes.post('/wiki/articles/:id/reindex', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid article id' } }, 400);
  await enqueueArticleForWiki(id, 10);
  const result = await processWikiJobs(4);
  return c.json({ articleId: id, ...result });
});

wikiRoutes.post('/wiki/pages/:id/rebuild', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid page id' } }, 400);
  await enqueuePageRebuild(id);
  const result = await processWikiJobs(4);
  return c.json({ pageId: id, ...result });
});
