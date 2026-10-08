import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafeAiBaseUrl,
  type AiDiscoveryConfig,
  callUserAi,
  listAiModels,
} from '../src/services/ai-provider.service.ts';
import type { UserAiRuntimeConfig } from '../src/services/user-ai-settings.service.ts';

type MockFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

function setFetch(mock: MockFetch) {
  const previous = globalThis.fetch;
  globalThis.fetch = mock as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
}

test('允许 HTTPS 公网 Base URL', async () => {
  const url = await assertSafeAiBaseUrl('https://1.1.1.1/v1');
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, '1.1.1.1');
});

for (const [label, rawUrl] of [
  ['HTTP', 'http://api.example.com/v1'],
  ['localhost', 'https://localhost:8080/v1'],
  ['127.0.0.1', 'https://127.0.0.1:8080/v1'],
  ['IPv6 环回', 'https://[::1]:8080/v1'],
  ['10.x', 'https://10.0.0.1/v1'],
  ['172.16.x', 'https://172.16.0.1/v1'],
  ['192.168.x', 'https://192.168.1.1/v1'],
  ['IPv6 ULA', 'https://[fd00::1]/v1'],
  ['带凭据', 'https://user:pass@api.example.com/v1'],
  ['带 fragment', 'https://api.example.com/v1#model'],
] as const) {
  test(`拒绝不安全的 ${label} Base URL`, async () => {
    await assert.rejects(() => assertSafeAiBaseUrl(rawUrl), /AI_BASE_URL_INVALID|AI_BASE_URL_NOT_PUBLIC/);
  });
}

test('OpenAI 兼容模型发现会携带 Bearer Key 并映射模型', async () => {
  const config: AiDiscoveryConfig = {
    provider: 'deepseek',
    apiKey: 'sk-discovery-test-key',
  };
  let requestedUrl = '';
  let authorization = '';
  const restore = setFetch(async (input, init) => {
    requestedUrl = String(input);
    authorization = init?.headers && (init.headers as Record<string, string>).Authorization || '';
    return new Response(JSON.stringify({
      data: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat' },
        { id: 'deepseek-reasoner' },
      ],
    }), { status: 200 });
  });

  try {
    const result = await listAiModels(config);
    assert.match(requestedUrl, /\/models$/);
    assert.equal(authorization, 'Bearer sk-discovery-test-key');
    assert.deepEqual(result.models, [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: null },
    ]);
  } finally {
    restore();
  }
});

test('Anthropic 模型发现使用 x-api-key 头并映射模型', async () => {
  const config: AiDiscoveryConfig = {
    provider: 'anthropic',
    apiKey: 'sk-ant-discovery-key',
  };
  let headers: Record<string, string> = {};
  const restore = setFetch(async (_input, init) => {
    headers = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({
      data: [{ id: 'claude-haiku-4-5', display_name: 'Claude Haiku 4.5' }],
    }), { status: 200 });
  });

  try {
    const result = await listAiModels(config);
    assert.equal(headers['x-api-key'], 'sk-ant-discovery-key');
    assert.equal(headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(result.models, [{ id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }]);
  } finally {
    restore();
  }
});

test('模型发现遇到 401/403 返回稳定中文诊断', async () => {
  const config: AiDiscoveryConfig = { provider: 'deepseek', apiKey: 'sk-bad' };
  const restore = setFetch(async () => new Response('unauthorized', { status: 401 }));

  try {
    await assert.rejects(listAiModels(config), /AI_UNAUTHORIZED/);
  } finally {
    restore();
  }

  const forbidden = setFetch(async () => new Response('forbidden', { status: 403 }));
  try {
    await assert.rejects(listAiModels(config), /AI_FORBIDDEN/);
  } finally {
    forbidden();
  }
});

test('模型发现重定向到内网地址会被拒绝', async () => {
  const config: AiDiscoveryConfig = { provider: 'deepseek', apiKey: 'sk-redirect-key' };
  const restore = setFetch(async () => new Response(null, {
    status: 302,
    headers: { Location: 'https://127.0.0.1/v1/models' },
  }));

  try {
    await assert.rejects(listAiModels(config), /AI_BASE_URL_NOT_PUBLIC/);
  } finally {
    restore();
  }
});

test('模型发现网络失败返回稳定错误码', async () => {
  const config: AiDiscoveryConfig = { provider: 'deepseek', apiKey: 'sk-network-key' };
  const restore = setFetch(async () => {
    throw new Error('network down');
  });

  try {
    await assert.rejects(listAiModels(config), /AI_NETWORK_FAILED/);
  } finally {
    restore();
  }
});

test('OpenAI 调用携带 Authorization、Body 不含 Key 并映射 usage', async () => {
  const config: UserAiRuntimeConfig = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: null,
    apiKey: 'sk-call-secret-key',
  };
  let requestedUrl = '';
  let authorization = '';
  let body = '';
  const restore = setFetch(async (input, init) => {
    requestedUrl = String(input);
    authorization = init?.headers && (init.headers as Record<string, string>).Authorization || '';
    body = String(init?.body || '');
    return new Response(JSON.stringify({
      choices: [{ message: { content: '测试输出' } }],
      usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
    }), { status: 200 });
  });

  try {
    const result = await callUserAi(config, '系统提示', '用户输入', 16);
    assert.equal(requestedUrl, 'https://api.deepseek.com/v1/chat/completions');
    assert.equal(authorization, 'Bearer sk-call-secret-key');
    assert.doesNotMatch(body, /sk-call-secret-key/);
    assert.doesNotMatch(requestedUrl, /sk-call-secret-key/);
    assert.deepEqual(result, {
      content: '测试输出',
      promptTokens: 7,
      completionTokens: 3,
      totalTokens: 10,
    });
  } finally {
    restore();
  }
});

test('Anthropic 调用映射输入和输出 token 用量', async () => {
  const config: UserAiRuntimeConfig = {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    baseUrl: null,
    apiKey: 'sk-ant-call-key',
  };
  let headers: Record<string, string> = {};
  let body = '';
  const restore = setFetch(async (_input, init) => {
    headers = init?.headers as Record<string, string>;
    body = String(init?.body || '');
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: '测试输出' }],
      usage: { input_tokens: 11, output_tokens: 4 },
    }), { status: 200 });
  });

  try {
    const result = await callUserAi(config, '系统提示', '用户输入', 16);
    assert.equal(headers['x-api-key'], 'sk-ant-call-key');
    assert.doesNotMatch(body, /sk-ant-call-key/);
    assert.deepEqual(result, {
      content: '测试输出',
      promptTokens: 11,
      completionTokens: 4,
      totalTokens: 15,
    });
  } finally {
    restore();
  }
});

test('错误响应不把 Key 写进 URL、请求体或诊断', async () => {
  const config: UserAiRuntimeConfig = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    baseUrl: null,
    apiKey: 'sk-leak-check-key',
  };
  const restore = setFetch(async () => new Response('service unavailable', { status: 503 }));

  try {
    await assert.rejects(callUserAi(config, '系统', '用户', 16), (error: unknown) => {
      const message = error instanceof Error ? `${error.name}:${error.message}` : String(error);
      assert.match(message, /AI_PROVIDER_UNAVAILABLE/);
      assert.doesNotMatch(message, /sk-leak-check-key/);
      return true;
    });
  } finally {
    restore();
  }
});
