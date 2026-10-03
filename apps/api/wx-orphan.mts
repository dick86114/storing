import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// 仅删除无任何用户元数据、且属于微信转发的孤儿文章行
const orphans = await pool.query(
  `SELECT a.id, a.title FROM articles a
   LEFT JOIN article_metadata m ON m.article_id = a.id
   WHERE m.id IS NULL AND a.content->>'type' = 'wechat_chat'`,
);
console.log('orphans:', JSON.stringify(orphans.rows));
for (const row of orphans.rows) {
  await pool.query('DELETE FROM articles WHERE id = $1', [row.id]);
  console.log('deleted orphan:', row.id);
}
await pool.end();
