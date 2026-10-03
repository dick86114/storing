import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const rows = await pool.query(
  `SELECT a.id, a.title, a.created_at, a.content->>'platform' AS platform,
          m.is_deleted, m.is_archived, m.is_favorited, m.is_published
   FROM articles a LEFT JOIN article_metadata m ON m.article_id = a.id
   WHERE a.content->>'type' = 'wechat_chat' OR a.source = '微信'
   ORDER BY a.id`,
);
console.log(JSON.stringify(rows.rows, null, 2));
await pool.end();
