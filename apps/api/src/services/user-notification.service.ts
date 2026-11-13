import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export type UserNotification = {
  id: number;
  articleId: number | null;
  type: string;
  title: string;
  body: string;
  reportVersion: number | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function ensureUserNotificationSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      report_version INTEGER,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx
      ON user_notifications(user_id, created_at DESC)
  `));
}

export async function createDeepAnalysisNotification(input: {
  userId: number;
  articleId: number;
  articleTitle: string | null;
  reportVersion: number;
}): Promise<void> {
  await ensureUserNotificationSchema();
  const title = input.articleTitle?.trim() || '未命名文章';
  await db.execute(sql`
    INSERT INTO user_notifications (user_id, article_id, type, title, body, report_version)
    VALUES (${input.userId}, ${input.articleId}, 'deep_analysis_completed', ${'深度报告已生成'}, ${`《${title}》第 ${input.reportVersion} 版报告已就绪。`}, ${input.reportVersion})
  `);
}

export async function listUserNotifications(
  userId: number,
  limit = 50,
): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  await ensureUserNotificationSchema();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 50));
  const notifications = await db.execute(sql`
    SELECT id, article_id, type, title, body, report_version, read_at, created_at
    FROM user_notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `);
  const [count] = (await db.execute(sql`
    SELECT COUNT(*)::int AS unread_count
    FROM user_notifications
    WHERE user_id = ${userId} AND read_at IS NULL
  `)).rows as Array<{ unreadCount: number }>;
  return {
    notifications: notifications.rows.map((row) => ({
      id: row.id as number,
      articleId: row.article_id as number | null,
      type: row.type as string,
      title: row.title as string,
      body: row.body as string,
      reportVersion: row.report_version as number | null,
      readAt: row.read_at ? new Date(row.read_at as string) : null,
      createdAt: new Date(row.created_at as string),
    })),
    unreadCount: count?.unreadCount ?? 0,
  };
}

export async function markUserNotificationRead(userId: number, notificationId: number): Promise<void> {
  await ensureUserNotificationSchema();
  const result = await db.execute(sql`
    UPDATE user_notifications
    SET read_at = NOW()
    WHERE id = ${notificationId} AND user_id = ${userId} AND read_at IS NULL
  `);
  if (result.rowCount === 0) throw new Error('USER_NOTIFICATION_NOT_FOUND');
}

