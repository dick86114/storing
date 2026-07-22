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
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false`));

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
          AND j.request_source = 'mcp'
          AND j.save_to_inbox = true
          AND j.user_id = m.user_id
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

/**
 * Repairs records written by pre-user-scope deployments. Those builds stored a
 * collected article's metadata under admin even when the collect job belonged
 * to another user. Copy the per-user state first, then remove the admin row
 * only when no admin-owned collection references that article.
 */
export async function repairCollectedArticleMetadataOwnership() {
  const adminUserId = await getAdminUserId();

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(734291106)`));
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS storing_schema_migrations (
        key TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    const marker = await tx.execute(sql.raw(`
      INSERT INTO storing_schema_migrations (key)
      VALUES ('collect_metadata_owner_repair_v1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `));
    if (marker.rows.length === 0) return;

    await tx.execute(sql`
      INSERT INTO article_metadata (
        article_id, user_id, source_type, client_id,
        is_favorited, is_archived, ai_summary, ai_category, ai_tags,
        content_md, content_html, content_html_mobile, cover_image,
        favorited_at, archived_at, is_published, published_at, public_id,
        created_at, updated_at
      )
      SELECT
        admin_meta.article_id,
        owner_job.user_id,
        COALESCE(NULLIF(owner_job.request_source, ''), 'web'),
        owner_job.client_id,
        admin_meta.is_favorited,
        admin_meta.is_archived,
        admin_meta.ai_summary,
        admin_meta.ai_category,
        admin_meta.ai_tags,
        admin_meta.content_md,
        admin_meta.content_html,
        admin_meta.content_html_mobile,
        admin_meta.cover_image,
        admin_meta.favorited_at,
        admin_meta.archived_at,
        FALSE,
        NULL,
        NULL,
        admin_meta.created_at,
        admin_meta.updated_at
      FROM collect_jobs owner_job
      INNER JOIN article_metadata admin_meta
        ON admin_meta.article_id = owner_job.article_id
       AND admin_meta.user_id = ${adminUserId}
      LEFT JOIN article_metadata owner_meta
        ON owner_meta.article_id = owner_job.article_id
       AND owner_meta.user_id = owner_job.user_id
      WHERE owner_job.user_id IS NOT NULL
        AND owner_job.user_id <> ${adminUserId}
        AND owner_job.article_id IS NOT NULL
        AND owner_job.save_to_inbox = TRUE
        AND owner_meta.id IS NULL
      ON CONFLICT (user_id, article_id) DO NOTHING
    `);

    await tx.execute(sql`
      DELETE FROM article_metadata admin_meta
      USING collect_jobs owner_job
      WHERE admin_meta.article_id = owner_job.article_id
        AND admin_meta.user_id = ${adminUserId}
        AND owner_job.user_id IS NOT NULL
        AND owner_job.user_id <> ${adminUserId}
        AND owner_job.article_id IS NOT NULL
        AND owner_job.save_to_inbox = TRUE
        AND COALESCE(admin_meta.is_published, FALSE) = FALSE
        AND EXISTS (
          SELECT 1
          FROM article_metadata owner_meta
          WHERE owner_meta.article_id = owner_job.article_id
            AND owner_meta.user_id = owner_job.user_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM collect_jobs admin_job
          WHERE admin_job.article_id = owner_job.article_id
            AND admin_job.user_id = ${adminUserId}
            AND admin_job.save_to_inbox = TRUE
        )
    `);
  });
}

/**
 * One-time repair for the summarize-only cleanup bug that could remove an
 * owner's real MCP library row when the same article also had a temporary
 * summarize_url job. The current cleanup guard prevents new losses; this
 * migration restores only the rows that were already removed.
 */
export async function repairMissingMcpSavedArticleMetadata() {
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(734291107)`));
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS storing_schema_migrations (
        key TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    const marker = await tx.execute(sql.raw(`
      INSERT INTO storing_schema_migrations (key)
      VALUES ('mcp_saved_metadata_repair_v1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `));
    if (marker.rows.length === 0) return;

    await tx.execute(sql.raw(`
      INSERT INTO article_metadata (
        article_id, user_id, source_type, client_id,
        is_favorited, is_archived, is_deleted, created_at, updated_at
      )
      SELECT DISTINCT ON (j.user_id, j.article_id)
        j.article_id,
        j.user_id,
        'mcp',
        j.client_id,
        FALSE,
        FALSE,
        FALSE,
        COALESCE(j.finished_at, j.created_at, NOW()),
        NOW()
      FROM collect_jobs j
      WHERE j.request_source = 'mcp'
        AND j.save_to_inbox = TRUE
        AND j.user_id IS NOT NULL
        AND j.article_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM article_metadata m
          WHERE m.article_id = j.article_id
            AND m.user_id = j.user_id
        )
      ORDER BY j.user_id, j.article_id, j.finished_at DESC NULLS LAST, j.id DESC
      ON CONFLICT (user_id, article_id) DO NOTHING
    `));
  });
}

/**
 * Adds publication fields before any route queries them.  The guard is
 * intentionally separate from the initial user-scope migration so an
 * already-upgraded installation can safely run it at every API startup.
 */
export async function ensurePrivateLibraryPublicationSchema() {
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS published_at TIMESTAMP`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS public_id TEXT`));
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS article_metadata_public_id_unique ON article_metadata(public_id) WHERE public_id IS NOT NULL`));
}
