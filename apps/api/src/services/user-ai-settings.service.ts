import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userAiSettings } from '../db/schema.js';

export type UserAiSettingsSummary = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  apiKeyUpdatedAt: Date | null;
  autoTriggerOnArchive: boolean;
  updatedAt: Date;
};

export type UserAiSettingsInput = {
  provider: string;
  model: string;
  baseUrl?: string | null;
  apiKey?: string;
  autoTriggerOnArchive: boolean;
};

export type UserAiRuntimeConfig = {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
};

function resolveUserAiEncryptionKey(): Buffer {
  const encodedKey = process.env.USER_AI_ENCRYPTION_KEY;
  if (!encodedKey) {
    throw new Error('USER_AI_ENCRYPTION_KEY_MISSING: 请部署 Base64 编码的 32 字节账号级 AI 主密钥');
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error('USER_AI_ENCRYPTION_KEY_INVALID: 主密钥必须解码为 32 字节');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = resolveUserAiEncryptionKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([nonce, authTag, encrypted]).toString('base64');
}

export function decryptSecret(ciphertext: string): string {
  const key = resolveUserAiEncryptionKey();
  let decoded: Buffer;
  try {
    decoded = Buffer.from(ciphertext, 'base64');
  } catch {
    throw new Error('USER_AI_SECRET_DECRYPT_FAILED: 账号级 AI 配置密文无效');
  }

  if (decoded.length <= 28) {
    throw new Error('USER_AI_SECRET_DECRYPT_FAILED: 账号级 AI 配置密文不完整');
  }

  try {
    const nonce = decoded.subarray(0, 12);
    const authTag = decoded.subarray(12, 28);
    const encrypted = decoded.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('USER_AI_SECRET_DECRYPT_FAILED: 账号级 AI 配置解密失败');
  }
}

export async function ensureUserAiSettingsSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS user_ai_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      base_url TEXT,
      api_key_ciphertext TEXT,
      api_key_last4 TEXT,
      api_key_updated_at TIMESTAMP,
      auto_trigger_on_archive BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS user_ai_settings_user_id_idx
      ON user_ai_settings(user_id)
  `));
}

function asSummary(row: typeof userAiSettings.$inferSelect): UserAiSettingsSummary {
  return {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    apiKeyConfigured: Boolean(row.apiKeyCiphertext),
    apiKeyLast4: row.apiKeyLast4,
    apiKeyUpdatedAt: row.apiKeyUpdatedAt,
    autoTriggerOnArchive: row.autoTriggerOnArchive,
    updatedAt: row.updatedAt,
  };
}

export async function getUserAiSettingsSummary(userId: number): Promise<UserAiSettingsSummary | null> {
  const [row] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);
  return row ? asSummary(row) : null;
}

export async function saveUserAiSettings(
  userId: number,
  input: UserAiSettingsInput,
): Promise<UserAiSettingsSummary> {
  const provider = input.provider.trim();
  const model = input.model.trim();
  const baseUrl = input.baseUrl?.trim() || null;
  const apiKey = input.apiKey?.trim() || '';
  if (!provider) throw new Error('USER_AI_PROVIDER_REQUIRED');
  if (!model) throw new Error('USER_AI_MODEL_REQUIRED');

  const [current] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);
  const now = new Date();
  const values = {
    provider,
    model,
    baseUrl,
    apiKeyCiphertext: apiKey ? await encryptSecret(apiKey) : current?.apiKeyCiphertext,
    apiKeyLast4: apiKey ? apiKey.slice(-4) : current?.apiKeyLast4,
    apiKeyUpdatedAt: apiKey ? now : current?.apiKeyUpdatedAt,
    autoTriggerOnArchive: input.autoTriggerOnArchive,
    updatedAt: now,
  };

  if (current) {
    const [row] = await db.update(userAiSettings)
      .set(values)
      .where(eq(userAiSettings.userId, userId))
      .returning();
    return asSummary(row);
  }

  const [row] = await db.insert(userAiSettings).values({ userId, ...values }).returning();
  return asSummary(row);
}

export async function deleteUserAiSettings(userId: number): Promise<void> {
  await db.delete(userAiSettings).where(eq(userAiSettings.userId, userId));
}

export async function resolveUserAiRuntimeConfig(userId: number): Promise<UserAiRuntimeConfig | null> {
  const [row] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);
  if (!row || !row.provider || !row.model || !row.apiKeyCiphertext) return null;

  const apiKey = decryptSecret(row.apiKeyCiphertext);
  if (!apiKey) return null;
  return {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    apiKey,
  };
}
