export const WECHAT_CAPTURE_FAILURE_PREFIX = '微信公众号正文抓取失败：';

export type CaptureTrace = (step: string, startedAt: number, outcome: string) => void;

export function readWechatCaptureFailure(error: string) {
  if (!error.startsWith(WECHAT_CAPTURE_FAILURE_PREFIX)) return null;
  const [summary, ...details] = error.split('\n');
  const hasVerification = /访问验证|验证页|风控/.test(summary)
    || details.some((detail) => /访问验证|验证页|风控/.test(detail));
  const unavailable = summary.includes('内容不可用')
    || details.some((detail) => detail.includes('内容不可用'));
  return {
    summary: summary.trim(),
    details: details.filter(Boolean),
    hint: hasVerification
      ? '请用浏览器确认原链接是否要求验证，再稍后重试。'
      : unavailable
        ? '请用浏览器打开原链接，确认文章是否仍能访问。'
        : summary.includes('所有可用抓取方式均未返回有效正文')
          ? '请用浏览器打开原链接确认文章是否仍可访问；如果浏览器正常，可能是抓取服务被站点限制，请稍后重试。'
          : null,
  };
}

export type CollectFailureInfo = {
  summary: string | null;
  details: string[];
  hint: string | null;
};

/** Split a stored collect error into a short reason, observable details, and a next step. */
export function formatCollectError(error?: string | null): CollectFailureInfo {
  if (!error) {
    return { summary: null, details: [], hint: null };
  }

  const wechatFailure = readWechatCaptureFailure(error);
  if (wechatFailure) return wechatFailure;

  const normalized = error.replace(/\s+/g, ' ').trim();
  const details: string[] = [];
  let summary = normalized;
  let hint: string | null = null;

  if (/desktop:/i.test(normalized) || /mobile:/i.test(normalized)) {
    summary = '网页正文未通过有效性校验';
    const parts = normalized.split('；').map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const strategyMatch = part.match(/^([^：:]+)：\s*(desktop|mobile):\s*(.+)$/i);
      if (strategyMatch) {
        const [, strategy, variant, message] = strategyMatch;
        details.push(`${strategy} ${variant.toLowerCase() === 'desktop' ? '桌面抓取' : '移动抓取'}：${message}`);
      } else if (/^desktop:/i.test(part)) {
        details.push(`桌面抓取：${part.replace(/^desktop:\s*/i, '')}`);
      } else if (/^mobile:/i.test(part)) {
        details.push(`移动抓取：${part.replace(/^mobile:\s*/i, '')}`);
      } else {
        details.push(part);
      }
    }
  } else if (/验证码|风控|验证页|captcha|verification/i.test(normalized)) {
    summary = '采集被站点风控或验证页拦截';
    details.push(normalized);
  } else if (/正文过短|缺少有效正文|壳页|异常页/i.test(normalized)) {
    summary = '抓取结果不像有效正文';
    details.push(normalized);
  } else if (/SingleFile 服务失败/i.test(normalized)) {
    summary = '网页镜像服务执行失败';
    details.push(normalized);
  } else {
    details.push(normalized);
  }

  if (/验证码|风控|验证页|captcha|verification/i.test(normalized)) {
    hint = '建议稍后重试；如果站点分桌面/移动页，可优先使用更稳定的入口链接。';
  } else if (/Chromium executable not found|spawn single-file ENOENT|spawn docker ENOENT|spawn npx ENOENT/i.test(normalized)) {
    hint = '当前运行环境缺少本地浏览器抓取依赖；Docker 部署建议确认 singlefile sidecar 已启动并重建镜像，或配置 SINGLEFILE_BROWSER_EXECUTABLE_PATH 指向可用 Chromium。';
  } else if (/正文过短|缺少有效正文|壳页|异常页/i.test(normalized)) {
    hint = '建议检查链接是否跳转到了活动页、壳页或登录页，再重新采集。';
  } else if (/SingleFile 服务失败/i.test(normalized)) {
    hint = '建议检查 SingleFile sidecar、本机命令或网络访问状态。';
  }

  return { summary, details, hint };
}

/** Report known operational failures without storing raw network or browser errors. */
export function describeCaptureError(error: unknown): string {
  if (!(error instanceof Error)) return '抓取异常';
  if (error.name === 'TimeoutError') return '请求超时';
  if (error.name === 'AbortError') return '请求被中止';
  if (error instanceof SyntaxError) return '响应不是有效 JSON';

  const httpStatus = error.message.match(/^(?:Reader API(?: json)? error|Wechat public page error|只读网页代理返回异常|SingleFile 服务返回异常)[:：]\s*([1-5]\d{2})$/);
  if (httpStatus) return `HTTP ${httpStatus[1]}`;
  if (/没有可用的 SingleFile 抓取策略/.test(error.message)) return '当前运行环境没有可用的 SingleFile 抓取策略';
  if (/未配置 SingleFile 服务地址/.test(error.message)) return '未配置 SingleFile 服务地址';
  if (/所有 SingleFile 抓取策略均失败/.test(error.message)) return '所有 SingleFile 抓取策略均失败';
  if (/SingleFile 服务(?:没有返回 HTML 内容|执行失败)/.test(error.message)) return 'SingleFile 服务没有返回有效 HTML';
  if (/只读网页代理没有返回内容/.test(error.message)) return '只读网页代理没有返回内容';
  if (/没有可用的 SingleFile 抓取策略|Chromium executable not found|spawn (?:single-file|docker|npx) ENOENT/i.test(error.message)) {
    return '缺少可用的 SingleFile 或 Chromium 运行环境';
  }
  if (/验证码|验证页|风控/.test(error.message)) return '抓取结果被识别为验证页或风控拦截';
  if (/正文过短|缺少有效正文/.test(error.message)) return '抓取结果缺少有效正文';
  if (/没有返回 HTML/.test(error.message)) return '没有返回 HTML';
  if (/超时|\btimed out\b|\bETIMEDOUT\b/i.test(error.message)) return '请求或抓取超时';

  const cause = error.cause as { code?: unknown } | undefined;
  switch (cause?.code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN': return 'DNS 解析失败';
    case 'ECONNREFUSED': return '连接被拒绝';
    case 'ECONNRESET': return '连接被重置';
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT': return '连接超时';
  }
  return error instanceof TypeError ? '网络请求失败' : '抓取异常';
}
