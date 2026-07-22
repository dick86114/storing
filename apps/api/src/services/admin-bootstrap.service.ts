import bcrypt from 'bcrypt';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export type ConfiguredAdminStatus = {
  configuredUsername: string;
  accountExists: boolean;
  role: string | null;
  status: string | null;
  configuredPasswordMatches: boolean;
  updatedAt: Date | null;
};


/** Adds non-destructive user-management fields for existing deployments. */
export async function initUserManagementSchema() {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp`);
}

export function requireConfiguredAdminCredentials() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
  }
  if (process.env.NODE_ENV === 'production' && password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters in production');
  }
  return { username, password };
}

async function findConfiguredAdmin() {
  const { username } = requireConfiguredAdminCredentials();
  const [account] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return account ?? null;
}

/**
 * Ensure the configured break-glass administrator exists and can still access the system.
 * Existing passwords are intentionally preserved: changing ADMIN_PASSWORD only takes
 * effect after an administrator explicitly triggers the recovery action.
 */
export async function ensureConfiguredAdmin() {
  const { username, password } = requireConfiguredAdminCredentials();
  const existing = await findConfiguredAdmin();

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db.insert(users).values({
      username,
      passwordHash,
      role: 'admin',
      status: 'active',
    }).returning();
    return { created: true, user: created };
  }

  // Do not silently re-enable or re-promote an existing account at startup.
  // Recovery is an explicit authenticated administrative action.
  return { created: false, user: existing };
}

export async function getConfiguredAdminStatus(): Promise<ConfiguredAdminStatus> {
  const { username, password } = requireConfiguredAdminCredentials();
  const account = await findConfiguredAdmin();

  return {
    configuredUsername: username,
    accountExists: Boolean(account),
    role: account?.role ?? null,
    status: account?.status ?? null,
    configuredPasswordMatches: account ? await bcrypt.compare(password, account.passwordHash) : false,
    updatedAt: account?.updatedAt ?? null,
  };
}

/**
 * Explicit recovery action. This is never called during startup so an environment
 * change cannot silently replace a database administrator's password.
 */
export async function resetConfiguredAdminPassword() {
  const { username, password } = requireConfiguredAdminCredentials();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await findConfiguredAdmin();

  if (!existing) {
    const [created] = await db.insert(users).values({
      username,
      passwordHash,
      role: 'admin',
      status: 'active',
    }).returning();
    return { created: true, user: created };
  }

  const [updated] = await db.update(users)
    .set({ passwordHash, role: 'admin', status: 'active', updatedAt: new Date() })
    .where(eq(users.id, existing.id))
    .returning();
  return { created: false, user: updated };
}
