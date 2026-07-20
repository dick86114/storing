import pg from 'pg';
const client = new pg.Client('postgresql://postgres:postgres@192.168.31.60:54321/weread');
await client.connect();
const { rows } = await client.query(`
  SELECT a.id, a.title, left(a.original_url, 90) AS url,
         length(a.content_markdown) AS md_len, length(a.content_html) AS html_len,
         length(a.content::text) AS json_len,
         length(m.content_html) AS meta_html_len, length(m.content_html_mobile) AS meta_mobile_len,
         left(a.summary, 60) AS summary, m.updated_at
  FROM articles a LEFT JOIN article_metadata m ON m.article_id = a.id
  WHERE a.original_url LIKE '%lDMEjY9CwFy_HgntcEUjWw%'
`);
console.log(JSON.stringify(rows, null, 2));
await client.end();
