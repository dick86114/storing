import { Hono } from 'hono';
import { getCurrentUser, requireAuth } from '../middleware/auth.js';
import {
  buildWikiMarkdownExport,
  buildWikiPageMarkdownExport,
  enqueueAllArchivedForWiki,
  enqueueArticleForWiki,
  enqueuePageRebuild,
  askWiki,
  deleteWikiAnswer,
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

wikiRoutes.get('/wiki', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  void userId;
  const data = await getWikiHome(c.req.query('type'), getCurrentUser(c).id as number);
  return c.json(data);
});

wikiRoutes.get('/wiki/status', requireAuth, async (c) => {
  return c.json(await getWikiStatus(getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/index', requireAuth, async (c) => {
  return c.json(await getWikiIndex(getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/log', requireAuth, async (c) => {
  const limit = Number(c.req.query('limit') || 50);
  return c.json(await getWikiLog(limit, getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/graph', requireAuth, async (c) => {
  return c.json(await getWikiGraph(getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/lint', requireAuth, async (c) => {
  const status = c.req.query('status') || 'open';
  const limit = Number(c.req.query('limit') || 50);
  return c.json(await getWikiLintFindings(status, limit, getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/jobs', requireAuth, async (c) => {
  const status = c.req.query('status') || 'pending';
  const limit = Number(c.req.query('limit') || 30);
  return c.json({ jobs: await getWikiJobs(status, limit, getCurrentUser(c).id as number) });
});

wikiRoutes.get('/wiki/answers', requireAuth, async (c) => {
  const limit = Number(c.req.query('limit') || 20);
  return c.json({ answers: await getWikiAnswers(limit, getCurrentUser(c).id as number) });
});

wikiRoutes.get('/wiki/search', requireAuth, async (c) => {
  const q = c.req.query('q') || '';
  const limit = Number(c.req.query('limit') || 20);
  return c.json(await searchWiki(q, limit, getCurrentUser(c).id as number));
});

wikiRoutes.get('/wiki/pages/:slug', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  const page = await getWikiPage(slug, getCurrentUser(c).id as number);
  if (!page) return c.json({ error: { code: 'NOT_FOUND', message: 'Wiki page not found' } }, 404);
  return c.json(page);
});

wikiRoutes.get('/wiki/articles/:id/status', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid article id' } }, 400);
  return c.json(await getWikiArticleStatus(id, getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/update', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  const queued = await enqueueAllArchivedForWiki(userId);
  const result = await processWikiJobs(Number(c.req.query('limit') || 8), getCurrentUser(c).id as number);
  return c.json({ queued, ...result });
});

wikiRoutes.post('/wiki/process', requireAuth, async (c) => {
  const result = await processWikiJobs(Number(c.req.query('limit') || 8), getCurrentUser(c).id as number);
  return c.json(result);
});

wikiRoutes.post('/wiki/retry-failed', requireAuth, async (c) => {
  await retryFailedWikiJobs(getCurrentUser(c).id as number);
  const result = await processWikiJobs(Number(c.req.query('limit') || 8), getCurrentUser(c).id as number);
  return c.json(result);
});

wikiRoutes.post('/wiki/rebuild-all', requireAuth, async (c) => {
  const result = await rebuildAllWiki(Number(c.req.query('limit') || 4), getCurrentUser(c).id as number);
  return c.json(result);
});

wikiRoutes.post('/wiki/lint', requireAuth, async (c) => {
  return c.json(await runWikiLint(getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/export-markdown', requireAuth, async (c) => {
  return c.json(await buildWikiMarkdownExport(getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/pages/:slug/export-markdown', requireAuth, async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing slug' } }, 400);
  const result = await buildWikiPageMarkdownExport(slug, getCurrentUser(c).id as number);
  if (!result) return c.json({ error: { code: 'NOT_FOUND', message: 'Wiki page not found' } }, 404);
  return c.json(result);
});

wikiRoutes.post('/wiki/claims/reconcile', requireAuth, async (c) => {
  return c.json(await reconcileWikiClaims(getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/ask', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const question = String(body.question || '').trim();
  if (!question) return c.json({ error: { code: 'BAD_REQUEST', message: '请输入要询问知识库的问题。' } }, 400);
  return c.json(await askWiki(question, Array.isArray(body.history) ? body.history : [], getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/answers/:id/file', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid answer id' } }, 400);
  return c.json(await fileWikiAnswer(id, getCurrentUser(c).id as number));
});

wikiRoutes.delete('/wiki/answers/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid answer id' } }, 400);
  return c.json(await deleteWikiAnswer(id, getCurrentUser(c).id as number));
});

wikiRoutes.post('/wiki/articles/:id/reindex', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid article id' } }, 400);
  await enqueueArticleForWiki(id, getCurrentUser(c).id as number, 10);
  const result = await processWikiJobs(4);
  return c.json({ articleId: id, ...result });
});

wikiRoutes.post('/wiki/pages/:id/rebuild', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid page id' } }, 400);
  await enqueuePageRebuild(id, getCurrentUser(c).id as number);
  const result = await processWikiJobs(4);
  return c.json({ pageId: id, ...result });
});
