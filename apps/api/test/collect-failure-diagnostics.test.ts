import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeCaptureError, formatCollectError, readWechatCaptureFailure } from '../src/services/collect-capture-diagnostics.js';

test('微信多行失败按行拆分为失败原因、抓取详情和处理建议', () => {
  const error = [
    '微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文',
    '微信结构化数据（18 ms）：HTTP 503',
    '微信页面元数据（412 ms）：超时',
    'HTML 正文抓取（6312 ms）：缺少微信正文结构（正文容器或文章标记）',
    'Markdown 正文抓取（5977 ms）：内容不可用',
  ].join('\n');
  const info = formatCollectError(error);
  assert.equal(info.summary, '微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文');
  assert.deepEqual(info.details, [
    '微信结构化数据（18 ms）：HTTP 503',
    '微信页面元数据（412 ms）：超时',
    'HTML 正文抓取（6312 ms）：缺少微信正文结构（正文容器或文章标记）',
    'Markdown 正文抓取（5977 ms）：内容不可用',
  ]);
  assert.equal(info.hint, '请用浏览器打开原链接，确认文章是否仍能访问。');
});

test('没有明确不可用提示时给出浏览器核对建议', () => {
  const error = [
    '微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文',
    'Reader JSON（18 ms）：HTTP 204；响应为空',
    'HTML 正文抓取（1150 ms）：缺少微信正文结构（正文容器或文章标记）',
    'Markdown 正文抓取（372 ms）：正文不足（提取 0 字符，最低要求 80 字符）',
  ].join('\n');
  const info = formatCollectError(error);
  assert.equal(info.details.length, 3);
  assert.equal(info.hint, '请用浏览器打开原链接确认文章是否仍可访问；如果浏览器正常，可能是抓取服务被站点限制，请稍后重试。');
});

test('验证页失败给出稍后重试建议，无额外行时详情为空', () => {
  const info = formatCollectError('微信公众号正文抓取失败：页面要求访问验证或内容不可用\n页面要求访问验证');
  assert.equal(info.summary, '微信公众号正文抓取失败：页面要求访问验证或内容不可用');
  assert.deepEqual(info.details, ['页面要求访问验证']);
  assert.equal(info.hint, '请用浏览器确认原链接是否要求验证，再稍后重试。');

  const noDetails = readWechatCaptureFailure('微信公众号正文抓取失败：页面要求访问验证或内容不可用');
  assert.deepEqual(noDetails?.details, []);
  assert.equal(noDetails?.hint, '请用浏览器确认原链接是否要求验证，再稍后重试。');
});

test('旧的 SingleFile desktop/mobile 失败信息仍能拆分', () => {
  const info = formatCollectError('singlefile_sidecar：desktop: 抓取结果正文过短；mobile: 抓取结果命中了验证页：访问验证');
  assert.equal(info.summary, '网页正文未通过有效性校验');
  assert.deepEqual(info.details, [
    'singlefile_sidecar 桌面抓取：抓取结果正文过短',
    '移动抓取：抓取结果命中了验证页：访问验证',
  ]);
});

test('单行通用失败保持原有摘要和详情', () => {
  const info = formatCollectError('请求超时');
  assert.equal(info.summary, '请求超时');
  assert.deepEqual(info.details, ['请求超时']);
  assert.equal(info.hint, null);
  assert.deepEqual(formatCollectError(null), { summary: null, details: [], hint: null });
});

test('抓取异常归类为已知运行时原因而不暴露原始文本', () => {
  assert.equal(describeCaptureError(new Error('Reader API error: 502')), 'HTTP 502');
  assert.equal(describeCaptureError(new Error('SingleFile 服务返回异常：503')), 'HTTP 503');
  assert.equal(describeCaptureError(new Error('所有 SingleFile 抓取策略均失败：/Users/alice/private: boom')), '所有 SingleFile 抓取策略均失败');
  assert.equal(describeCaptureError(new Error('当前运行环境没有可用的 SingleFile 抓取策略')), '当前运行环境没有可用的 SingleFile 抓取策略');
  assert.equal(describeCaptureError(new DOMException('private-url', 'TimeoutError')), '请求超时');
  assert.equal(describeCaptureError(new TypeError('fetch failed')), '网络请求失败');
  assert.equal(describeCaptureError(new Error('spawn /Users/alice/Chromium ENOENT')), '抓取异常');
});
