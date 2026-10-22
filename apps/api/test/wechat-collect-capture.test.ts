import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureWechatArticleInMemory } from '../src/services/wechat-collect-capture.service.js';

test('坏链接在微信 JSON、页面元数据和两种正文回退都为空时拒绝入库', async () => {
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/broken', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: null, source: '微信公众号' }),
      fetchContent: async () => null,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('Reader 返回微信验证壳页时不能通过正文有效性校验', async () => {
  const shellText = '当前访问环境异常，请完成访问验证后继续查看内容。'.repeat(8);
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/verification', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? `<html><head><title>访问验证</title></head><body><p>${shellText}</p></body></html>`
        : shellText,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('普通标题下的纯图片错误页不能通过校验', async () => {
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/image-only-error', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? '<html><head><title>待抓取文章</title></head><body><img src="https://img.example/error.png"></body></html>'
        : '![验证图片](https://img.example/error.png)',
    }),
    /微信公众号正文抓取失败/,
  );
});

test('正文容器中含验证提示时即使超过长度阈值也拒绝', async () => {
  const shellText = '当前访问环境异常，请完成访问验证后继续查看内容。'.repeat(30);
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/blocked-by-text', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? `<html><head><title>待抓取文章</title></head><body><div id="js_content"><p>${shellText}</p></div></body></html>`
        : shellText,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('没有微信可信正文结构的长文本也不能冒充文章', async () => {
  const longShellText = '页面暂时无法显示，请稍后重新打开。'.repeat(80);
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/untrusted-long-page', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? `<html><head><title>待抓取文章</title></head><body><p>${longShellText}</p></body></html>`
        : longShellText,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('文章删除和无法查看的常见变体不能通过校验', async () => {
  const unavailableText = '这篇文章目前无法查看，请稍后再试。'.repeat(8);
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/deleted-variant', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? `<html><head><title>文章已删除</title></head><body><div id="js_content"><p>${unavailableText}</p></div></body></html>`
        : unavailableText,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('删除提示位于正文 600 字之后也不能漏检', async () => {
  const lateBlockedText = '这是一段正常的占位内容。'.repeat(80) + '该文章已被删除，暂时无法查看。';
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/late-blocked', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? `<html><head><title>待抓取文章</title></head><body><div id="js_content"><p>${lateBlockedText}</p></div></body></html>`
        : lateBlockedText,
    }),
    /微信公众号正文抓取失败/,
  );
});

test('远程 HTML 的正文容器只有错误图片时仍拒绝', async () => {
  await assert.rejects(
    captureWechatArticleInMemory('https://mp.weixin.qq.com/s/content-image-error', {
      fetchJson: async () => null,
      fetchPageMeta: async () => ({ title: '待抓取文章', source: '微信公众号' }),
      fetchContent: async (_article, format) => format === 'html'
        ? '<html><head><title>微信公众平台</title></head><body><div id="js_content"><img src="https://img.example/error.png"></div></body></html>'
        : '![错误图片](https://img.example/error.png)',
    }),
    /微信公众号正文抓取失败/,
  );
});

test('平台或作者删除文章的变体不能通过标题、HTML 或 Markdown', async () => {
  const variants = ['该文章已被平台删除，请稍后再试。', '该文章已被作者删除，请稍后再试。', '该文章已被发布者删除，请稍后再试。'];
  for (const variant of variants) {
    await assert.rejects(
      captureWechatArticleInMemory(`https://mp.weixin.qq.com/s/deleted-${variants.indexOf(variant)}`, {
        fetchJson: async () => null,
        fetchPageMeta: async () => ({ title: '文章已被平台删除', source: '微信公众号' }),
        fetchContent: async (_article, format) => format === 'html'
          ? `<html><head><title>待抓取文章</title></head><body><div id="js_content"><p>${variant.repeat(12)}</p></div></body></html>`
          : variant.repeat(8),
      }),
      /微信公众号正文抓取失败/,
    );
  }
});

test('至少一种格式得到有效正文时才返回可持久化候选', async () => {
  const paragraph = '这是一段有效正文，包含足够长度用于验证，并且需要在 Markdown 中保留正文图片。'.repeat(3);
  const formats: string[] = [];
  const result = await captureWechatArticleInMemory('https://mp.weixin.qq.com/s/valid', {
    fetchJson: async () => null,
    fetchPageMeta: async () => ({ title: '有效文章', source: '测试公众号' }),
    fetchContent: async (_article, format) => {
      formats.push(format);
      return format === 'html'
        ? `<html><head><meta property="og:type" content="article"></head><body><div id="js_content"><h2>小节标题</h2><p>${paragraph}</p><img src="https://img.example/body.jpg" alt="正文图"></div></body></html>`
        : null;
    },
  });

  assert.equal(result.title, '有效文章');
  assert.equal(result.source, '测试公众号');
  assert.match(result.contentHtml || '', /正文图/);
  assert.match(result.contentMarkdown || '', /## 小节标题/);
  assert.match(result.contentMarkdown || '', /!\[正文图\]\(https:\/\/img\.example\/body\.jpg\)/);
  assert.deepEqual(formats, ['html'], 'HTML 成功后不应再启动第二路远程抓取');
  assert.deepEqual(result.content, {
    collectMethod: 'reader',
    originalUrl: 'https://mp.weixin.qq.com/s/valid',
  });
});

test('微信 JSON 有正文时即使页面元数据失败也能得到候选内容', async () => {
  const structuredBody = `<p>${'结构化正文内容，长度足够用于正文有效性检查。'.repeat(6)}</p>`;
  let remoteFetchCount = 0;
  const result = await captureWechatArticleInMemory('https://mp.weixin.qq.com/s/json', {
    fetchJson: async () => ({
      content_noencode: structuredBody,
      picture_page_info_list: [],
      title: '结构化标题',
      nick_name: '结构化公众号',
      cdn_url: 'https://img.example/cover.jpg',
    }),
    fetchPageMeta: async () => null,
    fetchContent: async () => {
      remoteFetchCount += 1;
      return null;
    },
  });

  assert.equal(result.title, '结构化标题');
  assert.equal(result.source, '结构化公众号');
  assert.equal(result.coverImage, 'https://img.example/cover.jpg');
  assert.equal(result.content.content_noencode, structuredBody);
  assert.equal(remoteFetchCount, 0, '已有微信结构化正文时不应再请求远程 HTML');
});
