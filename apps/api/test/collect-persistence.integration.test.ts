import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { sql } from 'drizzle-orm';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === '1';

test('正文通过后的文章与多用户元数据在短事务内原子写入', { skip: !enabled }, async () => {
  const [{ db }, schema, { upsertArticleFromCaptureInTransaction }] = await Promise.all([
    import('../src/db/index.js'),
    import('../src/db/schema.js'),
    import('../src/services/collect.service.js'),
  ]);
  const { articles, articleMetadata, users } = schema;
  const rollbackSignal = new Error('integration-test-rollback');

  try {
    await db.transaction(async (tx) => {
      const suffix = randomUUID().slice(0, 12);
      const [firstUser, secondUser] = await tx
        .insert(users)
        .values([
          { username: `collect-test-a-${suffix}`, passwordHash: 'test-only' },
          { username: `collect-test-b-${suffix}`, passwordHash: 'test-only' },
        ])
        .returning({ id: users.id });
      const normalizedUrl = `https://example.com/collect-${suffix}`;
      const capturedContent = {
        collectMethod: 'reader',
        originalUrl: normalizedUrl,
        content_noencode: '<p>有效正文</p>',
      };
      const input = {
        normalizedUrl,
        title: '有效文章标题',
        source: '测试公众号',
        contentHtml: '<p>有效正文</p>',
        contentMarkdown: '有效正文',
        content: capturedContent,
        coverImage: 'https://img.example/cover.jpg',
        method: 'reader' as const,
      };

      const firstPersistence = await upsertArticleFromCaptureInTransaction(tx, input, {
        persistMetadata: true,
        userId: firstUser.id,
        sourceType: 'web',
      });
      assert.ok(firstPersistence.articleId > 0);
      assert.equal(firstPersistence.createdArticle, true);
      assert.equal(firstPersistence.createdMetadata, true);
      const expectedArticleId = firstPersistence.articleId;

      const secondPersistence = await upsertArticleFromCaptureInTransaction(tx, input, {
        persistMetadata: true,
        userId: secondUser.id,
        sourceType: 'macos',
      });
      assert.deepEqual(secondPersistence, {
        articleId: expectedArticleId,
        createdArticle: false,
        createdMetadata: true,
      });

      const storedArticles = await tx
        .select({
          id: articles.id,
          title: articles.title,
          source: articles.source,
          content: articles.content,
          contentHtml: articles.contentHtml,
          contentMarkdown: articles.contentMarkdown,
        })
        .from(articles)
        .where(sql`${articles.originalUrl} = ${normalizedUrl}`);
      const storedMetadata = await tx
        .select({
          userId: articleMetadata.userId,
          isDeleted: articleMetadata.isDeleted,
          isArchived: articleMetadata.isArchived,
          contentHtml: articleMetadata.contentHtml,
          contentMd: articleMetadata.contentMd,
        })
        .from(articleMetadata)
        .where(sql`${articleMetadata.articleId} = ${expectedArticleId}`);

      assert.equal(storedArticles.length, 1, '相同 URL 只能有一个共享文章');
      assert.deepEqual(storedArticles[0], {
        id: expectedArticleId,
        title: input.title,
        source: input.source,
        content: capturedContent,
        contentHtml: input.contentHtml,
        contentMarkdown: input.contentMarkdown,
      });
      assert.equal(storedMetadata.length, 2, '两个用户应各自拥有独立元数据');
      assert.deepEqual(
        storedMetadata.map((row) => row.userId).sort((left, right) => left - right),
        [firstUser.id, secondUser.id].sort((left, right) => left - right),
      );
      for (const row of storedMetadata) {
        assert.equal(row.isDeleted, false);
        assert.equal(row.isArchived, false);
        assert.equal(row.contentHtml, input.contentHtml);
        assert.equal(row.contentMd, input.contentMarkdown);
      }

      throw rollbackSignal;
    });
  } catch (error) {
    if (error !== rollbackSignal) throw error;
  } finally {
    await (db as any).$client.end();
  }
});
