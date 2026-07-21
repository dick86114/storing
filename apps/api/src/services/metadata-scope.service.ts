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

const WIKI_USER_SCOPE_TABLES = [
  'wiki_articles',
  'wiki_article_extracts',
  'wiki_pages',
  'wiki_page_sources',
  'wiki_source_chunks',
  'wiki_claims',
  'wiki_page_claims',
  'wiki_links',
  'wiki_page_versions',
  'wiki_jobs',
  'wiki_log_entries',
  'wiki_lint_findings',
  'wiki_embeddings',
  'wiki_answers',
] as const;

/**
 * Adds a tenant key to all derived Wiki data. Existing rows remain readable
 * only after a later source-aware backfill; new indexes make the intended
 * owner boundaries explicit before the user-scoped Wiki service is enabled.
 */
export async function ensureWikiUserScopeSchema() {
  // Local development may have several tsx watchers during hot reload. Keep
  // DDL serialized across those processes so PostgreSQL never races to create
  // the same index name.
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(734291105)`));
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS storing_schema_migrations (
        key TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    const resetMarker = await tx.execute(sql.raw(`
      INSERT INTO storing_schema_migrations (key)
      VALUES ('wiki_private_scope_reset_v1')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `));
    if (resetMarker.rows.length > 0) {
      await tx.execute(sql.raw(`
        TRUNCATE TABLE wiki_articles, wiki_article_extracts, wiki_pages, wiki_page_sources,
          wiki_source_chunks, wiki_claims, wiki_page_claims, wiki_links, wiki_page_versions,
          wiki_jobs, wiki_log_entries, wiki_lint_findings, wiki_embeddings, wiki_answers
        RESTART IDENTITY CASCADE
      `));
    }
    for (const table of WIKI_USER_SCOPE_TABLES) {
      await tx.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`));
    }

    await tx.execute(sql.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_articles_article_id_key' AND conrelid = 'wiki_articles'::regclass) THEN
          ALTER TABLE wiki_articles DROP CONSTRAINT wiki_articles_article_id_key;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_article_extracts_article_id_key' AND conrelid = 'wiki_article_extracts'::regclass) THEN
          ALTER TABLE wiki_article_extracts DROP CONSTRAINT wiki_article_extracts_article_id_key;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wiki_pages_slug_key' AND conrelid = 'wiki_pages'::regclass) THEN
          ALTER TABLE wiki_pages DROP CONSTRAINT wiki_pages_slug_key;
        END IF;
      END $$;
    `));
    await tx.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS wiki_articles_user_article_unique ON wiki_articles(user_id, article_id)`));
    await tx.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS wiki_article_extracts_user_article_unique ON wiki_article_extracts(user_id, article_id)`));
    await tx.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS wiki_pages_user_slug_unique ON wiki_pages(user_id, slug)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS wiki_jobs_user_status_idx ON wiki_jobs(user_id, status, priority DESC, scheduled_at)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS wiki_log_entries_user_created_idx ON wiki_log_entries(user_id, created_at DESC)`));
    await tx.execute(sql.raw(`CREATE INDEX IF NOT EXISTS wiki_lint_findings_user_status_idx ON wiki_lint_findings(user_id, status, severity)`));
  });
}
