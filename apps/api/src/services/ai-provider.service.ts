import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicIp } from './outbound-url-policy.service.js';
import type { UserAiRuntimeConfig } from './user-ai-settings.service.js';

export type AiDiscoveryConfig = {
  provider: string;
  baseUrl?: string | null;
  apiKey?: string;
};

export type AiCallResult = {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type AiModelOption = { id: string; name: string | null };
export type AiProviderName =
  | 'anthropic'
  | 'deepseek'
  | 'zhipu'
  | 'minimax'
  | 'kimi'
  | 'doubao'
  | 'openrouter'
  | 'nvidia'
  | 'aliyun'
  | 'siliconflow'
  | 'custom';

const PROVIDERS: Record<AiProviderName, { baseUrl: string; defaultModel: string }> = {
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-haiku-4-5-20251001' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', defaultModel: 'MiniMax-Text-01' },
  kimi: { baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-pro-32k' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'anthropic/claude-haiku-4-5-20251001' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-8b-instruct' },
  aliyun: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
  custom: { baseUrl: '', defaultModel: '' },
};

export const SUPPORTED_AI_PROVIDERS = Object.keys(PROVIDERS) as AiProviderName[];

function assertProvider(provider: string): AiProviderName {
  if (!(provider in PROVIDERS)) {
    throw new Error(`AI_PROVIDER_INVALID: 支持的提供商：${SUPPORTED_AI_PROVIDERS.join('、')}`);
  }
  return provider as AiProviderName;
}

export function assertUserAiProvider(provider: string, baseUrl?: string | null): AiProviderName {
  const normalized = assertProvider(provider.trim());
  if (normalized === 'custom' && !baseUrl?.trim()) {
    throw new Error('AI_BASE_URL_REQUIRED: 自定义提供商必须填写公网 HTTPS Base URL');
  }
  return normalized;
}

export async function assertSafeAiBaseUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('AI_BASE_URL_INVALID: Base URL 格式无效');
  }

  if (url.protocol !== 'https:') throw new Error('AI_BASE_URL_INVALID: Base URL 必须使用 HTTPS');
  if (url.username || url.password) throw new Error('AI_BASE_URL_INVALID: Base URL 不能包含凭据');
  if (url.hash) throw new Error('AI_BASE_URL_INVALID: Base URL 不能包含 fragment');

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const directIpVersion = isIP(hostname);
  if (directIpVersion) {
    if (!isPublicIp(hostname)) throw new Error('AI_BASE_URL_NOT_PUBLIC: Base URL 不能指向内网或本机地址');
    return url;
  }

  if (!hostname.includes('.') || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('AI_BASE_URL_NOT_PUBLIC: Base URL 不能指向本机或内部网络');
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new Error('AI_BASE_URL_NOT_PUBLIC: Base URL 解析到内网或本机地址');
  }
  return url;
}

async function resolveProviderBaseUrl(provider: AiProviderName, rawBaseUrl?: string | null): Promise<string> {
  const preset = PROVIDERS[provider];
  const raw = (rawBaseUrl?.trim() || preset.baseUrl).trim();
  if (!raw) throw new Error('AI_BASE_URL_REQUIRED: 自定义提供商必须填写 Base URL');
  const safeUrl = await assertSafeAiBaseUrl(raw);
  return safeUrl.toString().replace(/\/$/, '');
}

async function safeAiFetch(url: string, init?: RequestInit): Promise<Response> {
  let currentUrl = await assertSafeAiBaseUrl(url);
  let response: Response | null = null;

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    response = await fetch(currentUrl, { ...init, redirect: 'manual' }).catch((error) => {
      throw new Error(`AI_NETWORK_FAILED: 无法连接模型服务：${error instanceof Error ? error.message : '未知网络错误'}`);
    });
    if (!(response.status >= 300 && response.status < 400)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);
    if (!location || redirects === 5) throw new Error('AI_BASE_URL_REDIRECT_INVALID: 模型服务重定向无效');
    currentUrl = await assertSafeAiBaseUrl(new URL(location, currentUrl).toString());
  }
  throw new Error('AI_BASE_URL_REDIRECT_INVALID: 模型服务重定向次数过多');
}

function providerError(status: number): Error {
  const mapping: Record<number, string> = {
    400: 'AI_BAD_REQUEST',
    401: 'AI_UNAUTHORIZED',
    402: 'AI_PAYMENT_REQUIRED',
    403: 'AI_FORBIDDEN',
    404: 'AI_MODEL_NOT_FOUND',
    408: 'AI_TIMEOUT',
    429: 'AI_RATE_LIMITED',
  };
  const code = mapping[status] || (status >= 500 ? 'AI_PROVIDER_UNAVAILABLE' : 'AI_REQUEST_FAILED');
  const messages: Record<string, string> = {
    AI_BAD_REQUEST: '模型请求参数无效',
    AI_UNAUTHORIZED: 'API Key 无效或已过期',
    AI_PAYMENT_REQUIRED: '模型账户余额不足',
    AI_FORBIDDEN: '没有访问该模型或接口的权限',
    AI_MODEL_NOT_FOUND: '模型不存在或不可用',
    AI_TIMEOUT: '模型服务响应超时',
    AI_RATE_LIMITED: '模型服务限流，请稍后再试',
    AI_PROVIDER_UNAVAILABLE: '模型服务暂时不可用',
    AI_REQUEST_FAILED: '模型服务请求失败',
  };
  throw new Error(`${code}: ${messages[code] || '模型服务请求失败'}`);
}

type ModelCacheEntry = { models: AiModelOption[]; expiresAt: number };
const MODEL_CACHE = new Map<string, ModelCacheEntry>();
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

function modelCacheKey(config: AiDiscoveryConfig) {
  return createHash('sha256')
    .update([config.provider, config.baseUrl || '', config.apiKey || ''].join('\n'))
    .digest('hex');
}

function asModelOptions(value: unknown): AiModelOption[] {
  if (!value || typeof value !== 'object') throw new Error('AI_RESPONSE_INVALID: 模型列表格式无效');
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error('AI_RESPONSE_INVALID: 模型列表格式无效');
  return data.map((item) => {
    if (!item || typeof item !== 'object') return { id: '', name: null };
    const record = item as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : '',
      name: typeof record.display_name === 'string'
        ? record.display_name
        : typeof record.name === 'string' ? record.name : null,
    };
  }).filter((item) => item.id);
}

export async function listAiModels(
  config: AiDiscoveryConfig,
): Promise<{ models: AiModelOption[]; cached: boolean }> {
  const provider = assertUserAiProvider(config.provider, config.baseUrl);
  const baseUrl = await resolveProviderBaseUrl(provider, config.baseUrl);
  const apiKey = config.apiKey?.trim();
  if (!apiKey) throw new Error('AI_API_KEY_REQUIRED: 请填写 API Key 后再获取模型');
  const key = modelCacheKey(config);
  const cached = MODEL_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return { models: cached.models, cached: true };

  const isAnthropic = provider === 'anthropic';
  const response = await safeAiFetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: isAnthropic ? {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    } : {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    providerError(response.status);
  }

  const models = asModelOptions(await response.json());
  MODEL_CACHE.set(key, { models, expiresAt: Date.now() + MODEL_CACHE_TTL_MS });
  return { models, cached: false };
}

function asUsage(value: unknown) {
  const usage = value as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; input_tokens?: unknown; output_tokens?: unknown };
  const promptTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : typeof usage.input_tokens === 'number' ? usage.input_tokens : null;
  const completionTokens = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : typeof usage.output_tokens === 'number' ? usage.output_tokens : null;
  const totalTokens = typeof usage.total_tokens === 'number'
    ? usage.total_tokens
    : promptTokens !== null && completionTokens !== null ? promptTokens + completionTokens : null;
  return { promptTokens, completionTokens, totalTokens };
}

export async function callUserAi(
  config: UserAiRuntimeConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<AiCallResult> {
  const provider = assertUserAiProvider(config.provider, config.baseUrl);
  const baseUrl = await resolveProviderBaseUrl(provider, config.baseUrl);
  const isAnthropic = provider === 'anthropic';
  const body = isAnthropic ? {
    model: config.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  } : {
    model: config.model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  const response = await safeAiFetch(isAnthropic ? `${baseUrl}/messages` : `${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(isAnthropic ? {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      } : { Authorization: `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    providerError(response.status);
  }

  const data = await response.json() as Record<string, unknown>;
  const content = isAnthropic
    ? Array.isArray(data.content)
      ? data.content.map((item) => (item as { type?: unknown; text?: unknown }))
          .filter((item) => item?.type === 'text' && typeof item.text === 'string')
          .map((item) => item.text as string).join('')
      : ''
    : Array.isArray(data.choices)
      ? (data.choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content
      : '';
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI_RESPONSE_INVALID: 模型返回内容为空');
  return { content, ...asUsage(data.usage) };
}
