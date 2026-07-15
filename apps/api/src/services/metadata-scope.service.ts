import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export async function getAdminUserId() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const result = await db.execute(sql`
    SELECT id
    FROM users
    WHERE username = ${adminUsername}
    LIMIT 1
  `);
  const id = Number(result.rows[0]?.id ?? 0);
  if (!id) throw new Error(`Admin user not found: ${adminUsername}`);
  return id;
}

export async function initArticleMetadataUserScope() {
  const adminUserId = await getAdminUserId();

  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'web'`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES mcp_clients(id) ON DELETE SET NULL`));

  await db.execute(sql`
    UPDATE article_metadata
    SET user_id = ${adminUserId},
        source_type = COALESCE(NULLIF(source_type, ''), 'web')
    WHERE user_id IS NULL
  `);

  // Preserve the legacy single-user inbox behavior by creating admin-scoped
  // metadata rows for existing articles that had no metadata.  Exclude
  // summarize-only MCP cache articles so temporary agent requests do not appear
  // in the user's inbox.
  await db.execute(sql`
    INSERT INTO article_metadata (article_id, user_id, source_type, is_favorited, is_archived, created_at, updated_at)
    SELECT a.id, ${adminUserId}, 'legacy', false, false, COALESCE(a.created_at, NOW()), NOW()
    FROM articles a
    WHERE NOT EXISTS (
      SELECT 1
      FROM article_metadata m
      WHERE m.article_id = a.id AND m.user_id = ${adminUserId}
    )
      AND NOT EXISTS (
        SELECT 1
        FROM collect_jobs j
        WHERE j.article_id = a.id
          AND j.request_source = 'mcp'
          AND j.save_to_inbox = false
      )
    ON CONFLICT DO NOTHING
  `);

  // Remove accidental admin inbox rows for summarize-only MCP cache articles.
  // They are content cache artifacts, not user library entries.
  await db.execute(sql`
    DELETE FROM article_metadata m
    WHERE m.user_id = ${adminUserId}
      AND COALESCE(m.is_archived, false) = false
      AND COALESCE(m.is_favorited, false) = false
      AND EXISTS (
        SELECT 1
        FROM collect_jobs j
        WHERE j.article_id = m.article_id
          AND j.request_source = 'mcp'
          AND j.save_to_inbox = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM collect_jobs j
        WHERE j.article_id = m.article_id
          AND j.request_source = 'web'
          AND j.save_to_inbox = true
      )
  `);

  await db.execute(sql.raw(`ALTER TABLE article_metadata ALTER COLUMN user_id SET NOT NULL`));

  await db.execute(sql.raw(`
    DO $$
    DECLARE constraint_name TEXT;
    BEGIN
      SELECT tc.constraint_name INTO constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_name = 'article_metadata'
        AND tc.constraint_type = 'UNIQUE'
        AND ccu.column_name = 'article_id'
      LIMIT 1;

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE article_metadata DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `));

  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS article_metadata_user_article_unique
    ON article_metadata(user_id, article_id)
  `));
}
