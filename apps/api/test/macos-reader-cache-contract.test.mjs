import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const route = read('src/routes/articles.ts');

test('文章详情返回缓存版本与文章身份字段', () => {
  const detailProjection = route.slice(
    route.indexOf('async function getArticleRecord'),
    route.indexOf('function serializeArticleRecord'),
  );

  assert.match(detailProjection, /createdAt: articles\.createdAt/);
  assert.match(detailProjection, /updatedAt: articles\.updatedAt/);
});

test('公开文章详情返回稳定的文章身份字段', () => {
  const publicProjection = route.slice(
    route.indexOf('function serializePublicPublication'),
    route.indexOf('async function getPublicPublicationRecord'),
  );
  const publicQuery = route.slice(
    route.indexOf('async function getPublicPublicationRecord'),
    route.indexOf('async function repairMissingDisplayMeta'),
  );

  assert.match(publicProjection, /createdAt: article\.createdAt/);
  assert.match(publicProjection, /updatedAt: article\.updatedAt/);
  assert.match(publicQuery, /createdAt: articles\.createdAt/);
  assert.match(publicQuery, /updatedAt: articles\.updatedAt/);
});
