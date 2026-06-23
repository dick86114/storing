import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  enqueueAllArchivedForWiki,
  enqueueArticleForWiki,
  enqueuePageRebuild,
  getWikiArticleStatus,
  getWikiHome,
  getWikiJobs,
  getWikiPage,
  getWikiStatus,
  processWikiJobs,
  rebuildAllWiki,
  retryFailedWikiJobs,
  searchWiki,
} from '../services/wiki.service.js';

export const wikiRoutes = new Hono();

wikiRoutes.get('/wiki', requireAuth, async (c) => {
  const data = await getWikiHome(c.req.query('type'));
  return c.json(data);
});

wikiRoutes.get('/wiki/status', requireAuth, async (c) => {
  return c.json(await getWikiStatus());
});

wikiRoutes.get('/wiki/jobs', requireAuth, async (c) => {
  const status = c.req.query('status') || 'pending';
  const limit = Number(c.req.query('limit') || 30);
  return c.json({ jobs: await getWikiJobs(status, limit) });
});

wikiRoutes.get('/wiki/search', requireAuth, async (c) => {
  const q = c.req.query('q') || '';
  const limit = Number(c.req.query('limit') || 20);
  return c.json(await searchWiki(q, limit));
});

wikiRoutes.get('/wiki/pages/:slug', requireAuth, async (c) => {
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
