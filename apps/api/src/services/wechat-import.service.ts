import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import yauzl from 'yauzl';
import { db } from '../db/index.js';
import { articleMetadata, articles } from '../db/schema.js';
import { generateSummaryAndTags } from './ai.service.js';
import {
  detectWeChatMediaKind,
  guessWeChatMime,
  parseWeChatTranscript,
  renderWeChatTranscriptMarkdown,
  renderWeChatTranscriptHtml,
  safeZipEntryName,
  WeChatMediaKind,
  WeChatTranscriptRecord,
} from './wechat-transcript.js';

/** 图床服务配置，与 reader.service 保持一致的部署变量。 */
const IMG_HOST = process.env.IMG_HOST || 'https://img.ali.idickies.cc';
const IMG_API_KEY = process.env.IMG_API_KEY || '';

/** 导入规模上限：微信单次合并转发不会超过这些量级，防止异常请求打爆内存。 */
const MAX_FILE_COUNT = 32;
const MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 16 * 1024 * 1024;
/** 图床上传并发，避免瞬时打满图床连接。 */
const UPLOAD_CONCURRENCY = 3;

export interface WeChatSharedFile {
  filename: string;
  mime: string;
  data: Buffer;
}

export interface WeChatImportOptions {
  userId: number;
  chatName?: string | null;
  source: 'android' | 'macos';
}

export interface WeChatImportResult {
  articleId: number;
  title: string;
  messageCount: number;
  mediaCount: number;
  uploadedMediaCount: number;
}

interface ZipEntryFile {
  name: string;
  data: Buffer;
}

export class WeChatImportError extends Error {
  constructor(
    message: string,
    readonly code: 'BAD_REQUEST' | 'UNSUPPORTED' = 'BAD_REQUEST',
  ) {
    super(message);
  }
}

/** 上传本地媒体二进制到图床。失败返回 null，由调用方降级记录，不阻塞入库。 */
async function uploadMediaToImgHost(file: { data: Buffer; filename: string; mime: string }): Promise<string | null> {
  if (!IMG_API_KEY) return null;
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.data)], { type: file.mime }), file.filename);
    const res = await fetch(`${IMG_HOST}/api/upload/private`, {
      method: 'POST',
      headers: { 'X-API-Key': IMG_API_KEY },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { url?: string } };
    if (!json?.success || !json.data?.url) return null;
    return `${IMG_HOST}${json.data.url}`;
  } catch (error) {
    console.error(`WeChat media upload failed: ${file.filename}`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** 从内存解析 ZIP：只保留普通文件，逐 entry 校验大小，杜绝 ZIP 炸弹。 */
function extractZipFiles(buffer: Buffer): Promise<ZipEntryFile[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(new WeChatImportError('微信导出的 ZIP 无法读取', 'UNSUPPORTED'));
        return;
      }
      const files: ZipEntryFile[] = [];
      let total = 0;
      let failed = false;
      const fail = (err: Error) => {
        if (failed) return;
        failed = true;
        try { zipFile.close(); } catch { /* 已关闭则忽略 */ }
        reject(err);
      };
      zipFile.on('error', fail);
      zipFile.on('entry', (entry: yauzl.Entry) => {
        const name = safeZipEntryName(entry.fileName);
        if (!name) {
          zipFile.readEntry();
          return;
        }
        if (entry.uncompressedSize > MAX_SINGLE_FILE_BYTES) {
          fail(new WeChatImportError(`ZIP 内文件过大：${name}`, 'BAD_REQUEST'));
          return;
        }
        total += entry.uncompressedSize;
        if (total > MAX_TOTAL_BYTES) {
          fail(new WeChatImportError('ZIP 解压总量超过限制', 'BAD_REQUEST'));
          return;
        }
        zipFile.openReadStream(entry, (streamError, readStream) => {
          if (streamError || !readStream) {
            fail(new WeChatImportError(`读取 ZIP 内文件失败：${name}`, 'UNSUPPORTED'));
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('error', () => fail(new WeChatImportError(`读取 ZIP 内文件失败：${name}`, 'UNSUPPORTED')));
          readStream.on('end', () => {
            files.push({ name, data: Buffer.concat(chunks) });
            zipFile.readEntry();
          });
        });
      });
      zipFile.on('end', () => {
        if (!failed) resolve(files);
      });
      zipFile.readEntry();
    });
  });
}

async function getNextArticleId(): Promise<number> {
  const [row] = await db.select({ nextId: sql<number>`COALESCE(MAX(${articles.id}), 0) + 1` }).from(articles);
  return Number(row?.nextId || 1);
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 统一处理从微信转发进来的文件：
 * macOS 合并转发的 ZIP 在服务端解开；安卓分享的散文件直接作为媒体处理。
 * 媒体一律先上图床，聊天记录与附件清单再入库并触发 AI 摘要。
 */
export async function importWeChatShare(files: WeChatSharedFile[], options: WeChatImportOptions): Promise<WeChatImportResult> {
  if (files.length === 0) throw new WeChatImportError('没有收到可导入的文件');
  if (files.length > MAX_FILE_COUNT) throw new WeChatImportError(`单次最多导入 ${MAX_FILE_COUNT} 个文件`);
  const totalBytes = files.reduce((sum, file) => sum + file.data.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new WeChatImportError('导入内容总量超过限制');
  if (files.some((file) => file.data.length > MAX_SINGLE_FILE_BYTES)) throw new WeChatImportError('单个文件超过 100MB 限制');

  // 归一化文件名，避免客户端传来路径或空名。
  const normalized = files.map((file, index) => {
    const base = file.filename.split(/[\\/]/).pop() || `file-${index + 1}`;
    return { ...file, filename: base };
  });

  let transcriptText: string | null = null;
  let mediaFiles: Array<{ name: string; mime: string; data: Buffer }>;

  const zipInput = normalized.find((file) => file.data.length > 4 && file.data[0] === 0x50 && file.data[1] === 0x4b);
  if (zipInput) {
    const entries = await extractZipFiles(zipInput.data);
    const transcriptEntry =
      entries.find((entry) => entry.name === '聊天记录.txt') ??
      entries.find((entry) => entry.name.toLowerCase().endsWith('.txt') && entry.data.length <= MAX_TRANSCRIPT_BYTES);
    transcriptText = transcriptEntry ? transcriptEntry.data.toString('utf8') : null;
    mediaFiles = entries
      .filter((entry) => entry !== transcriptEntry)
      .map((entry) => ({ name: entry.name, mime: guessWeChatMime(entry.name, ''), data: entry.data }));
    // ZIP 外如果还带了散文件（分批转发场景），一并当作媒体。
    mediaFiles.push(
      ...normalized
        .filter((file) => file !== zipInput)
        .map((file) => ({ name: file.filename, mime: guessWeChatMime(file.filename, file.mime), data: file.data })),
    );
  } else {
    mediaFiles = normalized.map((file) => ({ name: file.filename, mime: guessWeChatMime(file.filename, file.mime), data: file.data }));
  }

  const uploadedUrls = await mapWithConcurrency(mediaFiles, UPLOAD_CONCURRENCY, async (file) => ({
    ...file,
    kind: detectWeChatMediaKind(file.name),
    url: await uploadMediaToImgHost({ data: file.data, filename: file.name, mime: file.mime }),
  }));

  const records = transcriptText ? parseWeChatTranscript(transcriptText) : [];
  const firstDate = records.find((record) => record.date)?.date ?? new Date();
  const title = options.chatName?.trim()
    ? `微信聊天记录：${options.chatName.trim()}`
    : `微信转发内容 ${formatDateTime(firstDate)}`;
  const markdown = transcriptText || uploadedUrls.length > 0
    ? renderWeChatTranscriptMarkdown({ records, media: uploadedUrls })
    : '';
  if (!markdown) throw new WeChatImportError('没有识别到聊天记录或媒体文件', 'UNSUPPORTED');
  // 阅读器默认请求 HTML 正文；微信导入没有可抓取的外部源，落库时直接生成。
  const html = renderWeChatTranscriptHtml({ records, media: uploadedUrls });

  const articleId = await getNextArticleId();
  const now = new Date();
  const originalUrl = `qiankunjie://wechat-import/${randomUUID()}`;
  await db.insert(articles).values({
    id: articleId,
    title,
    source: '微信',
    originalUrl,
    contentMarkdown: markdown,
    contentHtml: html,
    content: {
      type: 'wechat_chat',
      platform: options.source,
      chatName: options.chatName?.trim() || null,
      messageCount: records.length,
      transcript: transcriptText,
      mediaFiles: uploadedUrls.map((file) => ({
        name: file.name,
        kind: file.kind,
        mime: file.mime,
        size: file.data.length,
        url: file.url,
      })),
    },
    readStatus: 'unread',
    createdAt: now,
    updatedAt: now,
  });

  const [existingMeta] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, options.userId)))
    .limit(1);
  if (existingMeta) {
    await db
      .update(articleMetadata)
      .set({ contentMd: markdown, contentHtml: html, isDeleted: false, isArchived: false, updatedAt: now })
      .where(eq(articleMetadata.id, existingMeta.id));
  } else {
    await db.insert(articleMetadata).values({
      articleId,
      userId: options.userId,
      sourceType: `wechat_${options.source}`,
      contentMd: markdown,
      contentHtml: html,
      isFavorited: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 摘要/标签失败不阻塞导入，与网页采集的容错策略一致。
  generateSummaryAndTags(articleId, options.userId).catch((error) =>
    console.error('WeChat import AI summary failed:', error instanceof Error ? error.message : String(error)),
  );

  return {
    articleId,
    title,
    messageCount: records.length,
    mediaCount: mediaFiles.length,
    uploadedMediaCount: uploadedUrls.filter((file) => file.url).length,
  };
}
