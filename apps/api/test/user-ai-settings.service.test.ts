import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(testDir, '../src/db/schema.ts'), 'utf8');
const index = readFileSync(resolve(testDir, '../src/index.ts'), 'utf8');

test('用户 AI 配置主密钥使用 32 字节 Base64，可往返解密', async () => {
  process.env.USER_AI_ENCRYPTION_KEY = Buffer.alloc(32, 'user-ai-key').toString('base64');
  const service = await import('../src/services/user-ai-settings.service.js');

  const ciphertext = service.encryptSecret('sk-test-1234567890');

  assert.notEqual(ciphertext, 'sk-test-1234567890');
  assert.equal(service.decryptSecret(ciphertext), 'sk-test-1234567890');
});

test('同一明文两次 AES-256-GCM 加密产生不同密文', async () => {
  process.env.USER_AI_ENCRYPTION_KEY = Buffer.alloc(32, 'user-ai-key').toString('base64');
  const service = await import('../src/services/user-ai-settings.service.js');

  assert.notEqual(service.encryptSecret('sk-test-1234567890'), service.encryptSecret('sk-test-1234567890'));
});

test('篡改 AES-256-GCM 密文时拒绝解密', async () => {
  process.env.USER_AI_ENCRYPTION_KEY = Buffer.alloc(32, 'user-ai-key').toString('base64');
  const service = await import('../src/services/user-ai-settings.service.js');
  const ciphertext = service.encryptSecret('sk-test-1234567890');
  const parts = Buffer.from(ciphertext, 'base64');
  parts[parts.length - 1] ^= 1;

  assert.throws(() => service.decryptSecret(parts.toString('base64')), /USER_AI_SECRET_DECRYPT_FAILED/);
});

test('缺少账号级主密钥时返回明确部署配置错误', async () => {
  delete process.env.USER_AI_ENCRYPTION_KEY;
  const service = await import('../src/services/user-ai-settings.service.js');

  assert.throws(() => service.encryptSecret('sk-test-1234567890'), /USER_AI_ENCRYPTION_KEY_MISSING/);
  assert.throws(() => service.decryptSecret('not-a-ciphertext'), /USER_AI_ENCRYPTION_KEY_MISSING/);
});

test('用户 AI 配置表使用级联删除、唯一用户和默认关闭自动触发', () => {
  assert.match(schema, /export const userAiSettings = pgTable\('user_ai_settings'/);
  assert.match(schema, /userId: integer\('user_id'\)\.primaryKey\(\)\.references\(\(\) => users\.id, \{ onDelete: 'cascade' \}\)/);
  assert.match(schema, /provider: text\('provider'\)\.notNull\(\)/);
  assert.match(schema, /model: text\('model'\)\.notNull\(\)/);
  assert.match(schema, /baseUrl: text\('base_url'\)/);
  assert.match(schema, /apiKeyCiphertext: text\('api_key_ciphertext'\)/);
  assert.match(schema, /apiKeyLast4: text\('api_key_last4'\)/);
  assert.match(schema, /apiKeyUpdatedAt: timestamp\('api_key_updated_at'\)/);
  assert.match(schema, /autoTriggerOnArchive: boolean\('auto_trigger_on_archive'\)\.notNull\(\)\.default\(false\)/);
});

test('用户 AI 设置摘要不返回明文 Key 或密文', () => {
  const service = readFileSync(resolve(testDir, '../src/services/user-ai-settings.service.ts'), 'utf8');
  const summaryType = service.slice(
    service.indexOf('export type UserAiSettingsSummary'),
    service.indexOf('export type UserAiSettingsInput'),
  );

  assert.match(summaryType, /provider: string/);
  assert.match(summaryType, /model: string/);
  assert.match(summaryType, /baseUrl: string \| null/);
  assert.match(summaryType, /apiKeyConfigured: boolean/);
  assert.match(summaryType, /apiKeyLast4: string \| null/);
  assert.match(summaryType, /autoTriggerOnArchive: boolean/);
  assert.doesNotMatch(summaryType, /apiKey(?!Configured|Last4|UpdatedAt)/);
  assert.doesNotMatch(summaryType, /apiKeyCiphertext/);
});

test('第二次保存空 Key 保留旧密文，只更新模型和开关', () => {
  const service = readFileSync(resolve(testDir, '../src/services/user-ai-settings.service.ts'), 'utf8');
  const saveFunction = service.slice(
    service.indexOf('export async function saveUserAiSettings'),
    service.indexOf('export async function deleteUserAiSettings'),
  );

  assert.match(saveFunction, /apiKey\s*=\s*input\.apiKey\?\.trim\(\)/);
  assert.match(saveFunction, /apiKey \? await encryptSecret\(apiKey\) : current\?\.apiKeyCiphertext/);
  assert.match(saveFunction, /apiKeyLast4: apiKey \? apiKey\.slice\(-4\) : current\?\.apiKeyLast4/);
});

test('只有 provider、model 和可解密 Key 均有效时返回运行配置', () => {
  const service = readFileSync(resolve(testDir, '../src/services/user-ai-settings.service.ts'), 'utf8');
  const resolveFunction = service.slice(
    service.indexOf('export async function resolveUserAiRuntimeConfig'),
    service.indexOf('export function assertUserAiRuntimeConfig'),
  );

  assert.match(resolveFunction, /if \(!row \|\| !row\.provider \|\| !row\.model \|\| !row\.apiKeyCiphertext\)/);
  assert.match(resolveFunction, /const apiKey = decryptSecret\(row\.apiKeyCiphertext\)/);
  assert.doesNotMatch(resolveFunction, /AI_PROVIDER|AI_MODEL|AI_API_KEY/);
});

test('API 启动时初始化用户 AI 配置表', () => {
  assert.match(index, /ensureUserAiSettingsSchema/);
  assert.match(index, /await ensureUserAiSettingsSchema\(\)/);
});
