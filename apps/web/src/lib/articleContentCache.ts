'use client';

const DB_NAME = 'storing-article-content-cache';
const STORE_NAME = 'articles';
const DB_VERSION = 1;
const MAX_CACHE_ENTRIES = 40;
const MAX_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 30;

type ArticleContentCacheRecord = {
  key: string;
  data: any;
  cachedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getCacheDb() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('cachedAt', 'cachedAt');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  return getCacheDb().then((db) => new Promise<T | undefined>((resolve) => {
    if (!db) {
      resolve(undefined);
      return;
    }

    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    if (!request) {
      transaction.oncomplete = () => resolve(undefined);
      transaction.onerror = () => resolve(undefined);
      transaction.onabort = () => resolve(undefined);
      return;
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  }));
}

export function getArticleContentCacheKey(id: number, format: 'markdown' | 'html') {
  return `article:${id}:${format}`;
}

export async function readCachedArticleContent(key: string) {
  const record = await withStore<ArticleContentCacheRecord>('readonly', (store) => store.get(key));
  if (!record) return null;

  if (Date.now() - record.cachedAt > MAX_CACHE_AGE_MS) {
    void deleteCachedArticleContent(key);
    return null;
  }

  return record.data;
}

export async function writeCachedArticleContent(key: string, data: any) {
  await withStore('readwrite', (store) => {
    store.put({ key, data, cachedAt: Date.now() } satisfies ArticleContentCacheRecord);
  });
  void trimArticleContentCache();
}

export async function deleteCachedArticleContent(key: string) {
  await withStore('readwrite', (store) => {
    store.delete(key);
  });
}

async function trimArticleContentCache() {
  const db = await getCacheDb();
  if (!db) return;

  const cutoff = Date.now() - MAX_CACHE_AGE_MS;
  const records = await new Promise<Array<Pick<ArticleContentCacheRecord, 'key' | 'cachedAt'>>>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(
        (request.result as ArticleContentCacheRecord[])
          .map((record) => ({ key: record.key, cachedAt: record.cachedAt }))
      );
    };
    request.onerror = () => resolve([]);
  });

  const staleKeys = records
    .filter((record) => record.cachedAt < cutoff)
    .map((record) => record.key);
  const overflowKeys = records
    .filter((record) => record.cachedAt >= cutoff)
    .sort((a, b) => b.cachedAt - a.cachedAt)
    .slice(MAX_CACHE_ENTRIES)
    .map((record) => record.key);
  const keysToDelete = [...new Set([...staleKeys, ...overflowKeys])];

  if (keysToDelete.length === 0) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    keysToDelete.forEach((key) => store.delete(key));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}
