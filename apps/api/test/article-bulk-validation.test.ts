import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseArticleBulkActionInput } from '../src/services/article-bulk-validation.js';

test('归一化重复文章 ID 并保持正整数', () => {
  assert.deepEqual(parseArticleBulkActionInput({
    action: 'favorite',
    articleIds: [3, 1, 3, '2'],
  }), { ok: true, action: 'favorite', articleIds: [3, 1, 2] });
});

test('拒绝未知动作、空列表、非法 ID 和超过 200 篇', () => {
  assert.equal(parseArticleBulkActionInput({ action: 'destroy', articleIds: [1] }).ok, false);
  assert.equal(parseArticleBulkActionInput({ action: 'favorite', articleIds: [] }).ok, false);
  assert.equal(parseArticleBulkActionInput({ action: 'favorite', articleIds: [0] }).ok, false);
  assert.equal(
    parseArticleBulkActionInput({
      action: 'favorite',
      articleIds: Array.from({ length: 201 }, (_, index) => index + 1),
    }).ok,
    false,
  );
});
