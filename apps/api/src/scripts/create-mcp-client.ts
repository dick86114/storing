import '../env.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mcpClients, users } from '../db/schema.js';
import { generateMcpApiKey, hashMcpApiKey, initMcpSchema } from '../services/mcp-auth.service.js';

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function ensureOwnerUser(username: string, role: 'admin' | 'user' | 'service' = 'service') {
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) return existing;

  const password = getArg('owner-password', 'change-me-now') || 'change-me-now';
  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db.insert(users).values({
    username,
    passwordHash,
    role,
    status: 'active',
  }).returning();
  return created;
}

async function main() {
  await initMcpSchema();

  const ownerUsername = getArg('owner', 'mcp-bot')!;
  const ownerRole = (getArg('owner-role', 'service') as 'admin' | 'user' | 'service');
  const clientName = getArg('name');
  const scopesArg = getArg('scopes', 'summary:create,job:read:self')!;
  const enabled = getArg('enabled', 'true') !== 'false';
  const defaultSaveToInbox = getArg('default-save-to-inbox', 'false') === 'true';

  if (!clientName) {
    throw new Error('缺少参数 --name=<client-name>');
  }

  const owner = await ensureOwnerUser(ownerUsername, ownerRole);
  const apiKey = generateMcpApiKey();
  const apiKeyHash = hashMcpApiKey(apiKey);

  const [client] = await db.insert(mcpClients).values({
    name: clientName,
    ownerUserId: owner.id,
    apiKeyHash,
    scopes: scopesArg.split(',').map((item) => item.trim()).filter(Boolean),
    enabled,
    defaultSaveToInbox,
  }).returning();

  console.log(JSON.stringify({
    owner: { id: owner.id, username: owner.username, role: owner.role },
    client: {
      id: client.id,
      name: client.name,
      scopes: client.scopes,
      enabled: client.enabled,
      defaultSaveToInbox: client.defaultSaveToInbox,
    },
    apiKey,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
