import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCoverImageBackfillQueue } from '../src/services/cover-image-backfill.service.js';

test('封面回填队列限制并发并按用户和文章去重', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started: string[] = [];
  let running = 0;
  let maxRunning = 0;

  const queue = createCoverImageBackfillQueue(async (articleId, userId) => {
    started.push(`${userId}:${articleId}`);
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await gate;
    running -= 1;
    return null;
  }, { concurrency: 2 });

  queue.enqueue([
    { articleId: 1, userId: 10 },
    { articleId: 2, userId: 10 },
    { articleId: 1, userId: 10 },
    { articleId: 1, userId: 11 },
  ]);

  assert.deepEqual(started, ['10:1', '10:2']);
  assert.equal(queue.activeCount, 2);
  assert.equal(queue.pendingCount, 1);

  release();
  await queue.waitForIdle();

  assert.deepEqual(started, ['10:1', '10:2', '11:1']);
  assert.equal(maxRunning, 2);
  assert.equal(queue.activeCount, 0);
  assert.equal(queue.pendingCount, 0);
});

test('封面回填任务失败后会释放去重标记并允许后续重试', async () => {
  let attempts = 0;
  const queue = createCoverImageBackfillQueue(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('临时失败');
    return 'https://img.example/cover.jpg';
  }, { concurrency: 1, onError: () => undefined });
  const target = { articleId: 7, userId: 3 };

  queue.enqueue([target]);
  await queue.waitForIdle();
  queue.enqueue([target]);
  await queue.waitForIdle();

  assert.equal(attempts, 2);
});

test('封面回填队列拒绝无限堆积待处理任务', () => {
  const gate = new Promise<string | null>(() => undefined);
  const queue = createCoverImageBackfillQueue(async () => gate, {
    concurrency: 1,
    maxPending: 1,
  });

  queue.enqueue([
    { articleId: 1, userId: 1 },
    { articleId: 2, userId: 1 },
    { articleId: 3, userId: 1 },
  ]);

  assert.equal(queue.activeCount, 1);
  assert.equal(queue.pendingCount, 1);
});
