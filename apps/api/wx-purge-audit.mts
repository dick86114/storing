import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query("DELETE FROM admin_audit_logs WHERE article_id = 359 RETURNING id");
console.log('audit removed:', r.rowCount);
await pool.query('DELETE FROM articles WHERE id = 359');
console.log('orphan 359 deleted');
await pool.end();
