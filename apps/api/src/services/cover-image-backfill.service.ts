import { processCoverImage } from './reader.service.js';

export type CoverImageBackfillTarget = {
  articleId: number;
  userId: number;
};

type CoverImageBackfillProcessor = (articleId: number, userId: number) => Promise<string | null>;

type CoverImageBackfillQueueOptions = {
  concurrency?: number;
  maxPending?: number;
  onError?: (error: unknown, target: CoverImageBackfillTarget) => void;
};

export type CoverImageBackfillQueue = {
  enqueue: (targets: Iterable<CoverImageBackfillTarget>) => void;
  waitForIdle: () => Promise<void>;
  readonly activeCount: number;
  readonly pendingCount: number;
};

function targetKey(target: CoverImageBackfillTarget) {
  return `${target.userId}:${target.articleId}`;
}

/** 创建可测试的有界后台队列，目录内和跨用户任务分别去重。 */
export function createCoverImageBackfillQueue(
  processor: CoverImageBackfillProcessor,
  options: CoverImageBackfillQueueOptions = {},
): CoverImageBackfillQueue {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 2));
  const maxPending = Math.max(1, Math.floor(options.maxPending ?? 200));
  const onError = options.onError ?? ((error, target) => {
    console.error(
      `Cover image backfill failed for article ${target.articleId}:`,
      error instanceof Error ? error.message : error,
    );
  });
  const pending: CoverImageBackfillTarget[] = [];
  const scheduled = new Set<string>();
  const idleWaiters: Array<() => void> = [];
  let active = 0;

  const notifyIfIdle = () => {
    if (active !== 0 || pending.length !== 0) return;
    for (const resolve of idleWaiters.splice(0)) resolve();
  };

  const run = async (target: CoverImageBackfillTarget) => {
    active += 1;
    try {
      await processor(target.articleId, target.userId);
    } catch (error) {
      onError(error, target);
    } finally {
      active -= 1;
      scheduled.delete(targetKey(target));
      drain();
      notifyIfIdle();
    }
  };

  const drain = () => {
    while (active < concurrency && pending.length > 0) {
      const target = pending.shift();
      if (target) void run(target);
    }
  };

  return {
    enqueue(targets) {
      for (const target of targets) {
        const key = targetKey(target);
        if (scheduled.has(key)) continue;
        if (pending.length + active >= maxPending + concurrency) break;
        scheduled.add(key);
        pending.push(target);
      }
      drain();
    },
    waitForIdle() {
      if (active === 0 && pending.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => idleWaiters.push(resolve));
    },
    get activeCount() {
      return active;
    },
    get pendingCount() {
      return pending.length;
    },
  };
}

export const coverImageBackfillQueue = createCoverImageBackfillQueue(processCoverImage);
