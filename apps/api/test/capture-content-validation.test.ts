import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  buildReaderProxyUrl,
  fetchReadableProxyHtml,
  validateCapturedHtml,
} from '../src/services/singlefile.service.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('样式表内容不计入网页正文长度', () => {
  const css = Array.from({ length: 20 }, (_, index) => `.item-${index} { color: var(--primary); }`).join('\n');
  const html = `
    <html><head><title>小红书 - 你的生活兴趣社区</title></head>
    <body><style>${css}</style><main><p>登录后查看</p></main></body></html>
  `;

  const result = validateCapturedHtml(html, 'https://www.xiaohongshu.com/explore/test');

  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.reason, /壳页|正文过短/);
});

test('构建只读代理地址时保留目标查询参数', () => {
  const target = 'https://pixpin.cn/docs/change-log/3.6.0.9?type=test';
  const proxyUrl = new URL(buildReaderProxyUrl(target));

  assert.equal(proxyUrl.protocol, 'https:');
  assert.equal(proxyUrl.hostname, 'r.jina.ai');
  assert.equal(proxyUrl.pathname, '/https://pixpin.cn/docs/change-log/3.6.0.9');
  assert.equal(proxyUrl.searchParams.get('type'), 'test');
});

test('只读代理抓取返回 HTML 内容', async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (request: string) => {
    requests.push(request);
    return new Response('<html><body><main><p>代理正文内容</p></main></body></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }) as typeof fetch;

  const html = await fetchReadableProxyHtml('https://example.com/article');

  assert.match(html, /代理正文内容/);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/r\.jina\.ai\//);
});
