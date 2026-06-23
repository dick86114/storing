import { processWikiJobs } from './wiki.service.js';

let workerTimer: NodeJS.Timeout | null = null;
let tickRunning = false;

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function startWikiWorker() {
  if (process.env.WIKI_WORKER_ENABLED === 'false') {
    console.log('Wiki worker disabled by WIKI_WORKER_ENABLED=false');
    return;
  }
  if (workerTimer) return;

  const intervalMs = envNumber('WIKI_WORKER_INTERVAL_MS', 30_000);
  const batchSize = envNumber('WIKI_WORKER_BATCH_SIZE', 2);

  const tick = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      const result = await processWikiJobs(batchSize);
      if (result.processed > 0) {
        console.log(`Wiki worker processed ${result.processed} job(s)`);
      }
    } catch (error: any) {
      console.error('Wiki worker tick failed:', error.message);
    } finally {
      tickRunning = false;
    }
  };

  workerTimer = setInterval(tick, intervalMs);
  workerTimer.unref?.();

  const initialDelay = envNumber('WIKI_WORKER_INITIAL_DELAY_MS', 5_000);
  setTimeout(tick, initialDelay).unref?.();
  console.log(`Wiki worker started: interval=${intervalMs}ms batch=${batchSize}`);
}

export function stopWikiWorker() {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}
