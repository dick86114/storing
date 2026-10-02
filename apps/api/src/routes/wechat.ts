import { Hono } from 'hono';
import { z } from 'zod';
import { getCurrentUser, requireAuth } from '../middleware/auth.js';
import { importWeChatShare, WeChatImportError, WeChatSharedFile } from '../services/wechat-import.service.js';

export const wechatRoutes = new Hono();

const manifestSchema = z.object({
  chatName: z.string().trim().max(120).optional().nullable(),
  source: z.enum(['android', 'macos']).default('android'),
});

/** 把 multipart 里的 File 转成服务层统一使用的内存文件对象。 */
async function toSharedFile(value: File): Promise<WeChatSharedFile> {
  return {
    filename: value.name || 'unnamed',
    mime: value.type || 'application/octet-stream',
    data: Buffer.from(await value.arrayBuffer()),
  };
}

/**
 * 微信转发导入入口。
 * 客户端只上传原始文件（macOS 的 ZIP 或安卓分享的散文件），
 * 解析、媒体上图床、入库与 AI 处理全部在服务端完成。
 */
wechatRoutes.post('/wechat/import', requireAuth, async (c) => {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: '请使用 multipart/form-data 上传文件' } }, 400);
  }

  const rawFiles = body.files;
  const fileValues: File[] = [];
  const collectFile = (value: unknown) => {
    if (value instanceof File && value.size > 0) fileValues.push(value);
  };
  if (Array.isArray(rawFiles)) rawFiles.forEach(collectFile);
  else collectFile(rawFiles);
  if (fileValues.length === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '没有收到可导入的文件' } }, 400);
  }

  let manifest: z.infer<typeof manifestSchema> = { source: 'android' };
  if (typeof body.manifest === 'string' && body.manifest.trim()) {
    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(body.manifest);
    } catch {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'manifest 不是合法 JSON' } }, 400);
    }
    const parsed = manifestSchema.safeParse(parsedManifest);
    if (!parsed.success) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'manifest 参数错误' } }, 400);
    }
    manifest = parsed.data;
  }

  try {
    const user = getCurrentUser(c);
    const files = await Promise.all(fileValues.map(toSharedFile));
    const result = await importWeChatShare(files, {
      userId: user.id,
      chatName: manifest.chatName ?? null,
      source: manifest.source,
    });
    return c.json({ import: result }, 201);
  } catch (error) {
    if (error instanceof WeChatImportError) {
      return c.json({ error: { code: error.code, message: error.message } }, 400);
    }
    console.error('WeChat import failed:', error instanceof Error ? error.message : String(error));
    return c.json({ error: { code: 'IMPORT_FAILED', message: '微信内容导入失败' } }, 500);
  }
});
