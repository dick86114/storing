import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminAuditLogs } from '../db/schema.js';

export type AdminAuditInput = {
  actorUserId: number;
  action: string;
  targetUserId?: number | null;
  articleId?: number | null;
  detail?: Record<string, unknown> | null;
};

/** Creates the audit table independently so existing deployments upgrade safely. */
export async function initAdminAuditSchema() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER NOT NULL REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      article_id INTEGER REFERENCES articles(id),
      action TEXT NOT NULL,
      detail JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS admin_audit_logs_target_user_idx ON admin_audit_logs(target_user_id, created_at DESC)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS admin_audit_logs_article_idx ON admin_audit_logs(article_id, created_at DESC)`));
}

export async function writeAdminAudit(input: AdminAuditInput) {
  const [entry] = await db.insert(adminAuditLogs).values({
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId ?? null,
    articleId: input.articleId ?? null,
    action: input.action,
    detail: input.detail ?? null,
  }).returning();
  return entry;
}
