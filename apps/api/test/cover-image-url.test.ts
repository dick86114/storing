import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCoverImageUrl, prepareCapturedDocument } from '../src/services/singlefile.service.ts';
import { extractWechatCoverImage, normalizeWechatContentHtml } from '../src/services/reader.service.ts';

test('normalizes a malformed proxy URL that embeds an absolute image URL', () => {
  const nested = 'https://tu.wnflb2023.com/https://img03.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/100/?appid=122&url=https://tva1.sinaimg.cn/large/00984cGCgy1if7dod41waj31bz0zbdzr.jpg';
  const expected = 'https://img03.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/100/?appid=122&url=https://tva1.sinaimg.cn/large/00984cGCgy1if7dod41waj31bz0zbdzr.jpg';

  assert.equal(normalizeCoverImageUrl(nested), expected);
});

test('leaves a normal absolute image URL unchanged', () => {
  const imageUrl = 'https://img03.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/100/?appid=122&url=https://tva1.sinaimg.cn/large/00984cGCgy1if7dod41waj31bz0zbdzr.jpg';

  assert.equal(normalizeCoverImageUrl(imageUrl), imageUrl);
});


test('uses the normalized nested og:image as the prepared document cover', () => {
  const nested = 'https://tu.wnflb2023.com/https://img03.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/100/?appid=122&url=https://tva1.sinaimg.cn/large/00984cGCgy1if7dod41waj31bz0zbdzr.jpg';
  const expected = 'https://img03.sogoucdn.com/v2/thumb/retype_exclude_gif/ext/auto/q/100/?appid=122&url=https://tva1.sinaimg.cn/large/00984cGCgy1if7dod41waj31bz0zbdzr.jpg';
  const prepared = prepareCapturedDocument(`<html><head><meta property="og:image" content="${nested}" /></head><body><h1>Example</h1></body></html>`, 'https://fuliba2023.net/fuliba-moyu.html');

  assert.equal(prepared.coverImage, expected);
});

test('prefers an explicit article cover element before falling back to the first body image', () => {
  const prepared = prepareCapturedDocument(
    `<html><body>
      <figure class="article-cover"><img src="/covers/canonical.jpg" /></figure>
      <article><img src="/body/first.jpg" /></article>
    </body></html>`,
    'https://example.com/articles/cover-priority',
  );

  assert.equal(prepared.coverImage, 'https://example.com/covers/canonical.jpg');
});


test('prefers the WeChat Reader API cdn_url cover over a body picture', () => {
  const cover = 'https://mmbiz.qpic.cn/mmbiz_jpg/cover/0?wx_fmt=jpeg';
  const bodyPicture = 'https://mmbiz.qpic.cn/mmbiz_jpg/body/640?wx_fmt=jpeg';

  assert.equal(
    extractWechatCoverImage({
      cdn_url: cover,
      cdn_url_235_1: cover,
      picture_page_info_list: [{ cdn_url: bodyPicture }],
    }),
    cover,
  );
});

test('解析微信 Reader HTML 前移除会触发 jsdom 异常的内联样式', () => {
  const rawHtml = `<span style="display: block;background: none;height: 30px;background-color: #fafafa;background-image: url(&quot;https://mmbiz.qpic.cn/icon.svg&quot;);">代码块标题</span>`;

  assert.equal(
    normalizeWechatContentHtml(rawHtml),
    '<span>代码块标题</span>',
  );
});
