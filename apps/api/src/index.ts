import './env.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { articlesRoutes } from './routes/articles.js';
import { searchRoutes } from './routes/search.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: 'http://localhost:1050' }));

app.route('/api/v1', healthRoutes);
app.route('/api/v1', articlesRoutes);
app.route('/api/v1', searchRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
});

serve({ fetch: app.fetch, port: 1052 }, (info) => {
  console.log(`API server running on http://localhost:${info.port}`);
});
