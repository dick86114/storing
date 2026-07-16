import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

type ToolExtra = {
  authInfo?: {
    token: string;
  };
};

type SummarizeResult = {
  status: 'running';
  job_id: number;
  message: string;
};

type SummarizeToolResult = SummarizeResult | (JobStatusResult & {
  job_id: number;
  message: string;
});

type CollectResult = {
  status: 'running';
  job_id: number;
  saved_to_inbox: true;
  message: string;
};

type JobStatusResult = {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string;
  article_id: number | null;
  title: string | null;
  summary: string | null;
  category: string | null;
  tags: string[];
  saved_to_inbox: boolean;
  error: { message: string } | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type StoringMcpServerOptions = {
  apiBase: string;
  staticApiKey?: string;
  transport?: 'stdio' | 'streamable-http';
  clientAgent?: string;
  scopes?: string[];
};

export function createStoringMcpServer(options: StoringMcpServerOptions) {
  const server = new McpServer({
    name: 'storing-mcp-server',
    version: '0.2.0',
  });

  const resolveApiKey = (extra?: ToolExtra) => {
    const apiKey = (extra && extra.authInfo?.token) || options.staticApiKey || '';
    if (!apiKey) throw new Error('Missing Storing MCP API Key');
    return apiKey;
  };

  const hasScope = (scopes: string[] | undefined, scope: string) =>
    Array.isArray(scopes) && scopes.includes(scope);

  const canCollect = hasScope(options.scopes, 'collect:create') && hasScope(options.scopes, 'inbox:write');

  const apiFetch = async <T>(path: string, apiKey: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${options.apiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Storing-MCP-Transport': options.transport || 'stdio',
        'X-Storing-MCP-Client': options.clientAgent || 'Storing MCP stdio client',
        ...(init?.headers || {}),
      },
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = data?.error?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return data as T;
  };

  const waitForMcpJob = async (apiKey: string, jobId: number, waitTimeoutSeconds: number): Promise<SummarizeToolResult> => {
    const job = await apiFetch<JobStatusResult>(`/mcp/jobs/${jobId}?wait_seconds=${waitTimeoutSeconds}`, apiKey);
    const message = job.status === 'completed'
      ? '文章已抓取并生成摘要。'
      : job.status === 'failed'
        ? '文章抓取或摘要失败，请查看 error.message。'
        : '任务仍在进行中，尚未失败；请稍后使用 get_collect_status 查询该 job_id。';
    return { ...job, job_id: job.id, message };
  };

  server.registerTool(
    'summarize_url',
    {
      description: '提交公开网页链接到 Storing 并生成智能摘要。默认在服务端等待最多 45 秒得到最终结果；只有 status=failed 才可判定失败，pending/running 表示仍在处理，应继续使用 get_collect_status 查询。',
      inputSchema: {
        url: z.string().url().describe('需要总结的公开网页链接'),
        language: z.string().optional().describe('摘要语言，可选，当前版本仅透传保留'),
        summary_style: z.enum(['brief', 'detailed', 'bullet']).optional().describe('摘要风格，可选，当前版本仅透传保留'),
        wait_for_result: z.boolean().optional().describe('默认 true：在单次调用内等待任务完成；设为 false 时立即返回 job_id。'),
        wait_timeout_seconds: z.number().int().min(3).max(60).optional().describe('等待最终结果的秒数，默认 45，最大 60。'),
      },
      outputSchema: {
        status: z.enum(['pending', 'running', 'completed', 'failed']),
        job_id: z.number(),
        id: z.number().optional(),
        message: z.string(),
        stage: z.string().optional(),
        article_id: z.number().nullable().optional(),
        title: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        saved_to_inbox: z.boolean().optional(),
        error: z.object({ message: z.string() }).nullable().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        finished_at: z.string().nullable().optional(),
      },
    },
    async ({ url, language, summary_style, wait_for_result, wait_timeout_seconds }, extra) => {
      const apiKey = resolveApiKey(extra);
      const result = await apiFetch<SummarizeResult>('/mcp/summarize', apiKey, {
        method: 'POST',
        body: JSON.stringify({ url, language, summary_style }),
      });
      const waitForResult = wait_for_result ?? true;
      const waitTimeoutSeconds = wait_timeout_seconds ?? 45;
      const output = waitForResult
        ? await waitForMcpJob(apiKey, result.job_id, waitTimeoutSeconds)
        : result;
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  if (canCollect) {
    server.registerTool(
      'collect_url',
      {
        description: '提交一个公开网页链接到 Storing，异步抓取正文并明确保存到 MCP client owner 的收件箱。需要 collect:create 和 inbox:write 权限。',
        inputSchema: {
          url: z.string().url().describe('需要收藏到 owner 收件箱的公开网页链接'),
        },
        outputSchema: {
          status: z.literal('running'),
          job_id: z.number(),
          saved_to_inbox: z.literal(true),
          message: z.string(),
        },
      },
      async ({ url }, extra) => {
        const result = await apiFetch<CollectResult>('/mcp/collect', resolveApiKey(extra), {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      },
    );
  }

  server.registerTool(
    'get_collect_status',
    {
      description: '根据 job_id 查询 Storing 链接总结或收藏任务状态；可通过 wait_seconds 在服务端等待最终状态。pending/running 表示仍在处理，不是抓取失败。',
      inputSchema: {
        job_id: z.number().int().positive().describe('summarize_url 或 collect_url 返回的任务 ID'),
        wait_seconds: z.number().int().min(0).max(60).optional().describe('可选：服务端最长等待秒数，避免客户端自行高频轮询。'),
      },
      outputSchema: {
        id: z.number(),
        status: z.enum(['pending', 'running', 'completed', 'failed']),
        stage: z.string(),
        article_id: z.number().nullable(),
        title: z.string().nullable(),
        summary: z.string().nullable(),
        category: z.string().nullable(),
        tags: z.array(z.string()),
        saved_to_inbox: z.boolean(),
        error: z.object({ message: z.string() }).nullable(),
        created_at: z.string(),
        updated_at: z.string(),
        finished_at: z.string().nullable(),
      },
    },
    async ({ job_id, wait_seconds }, extra) => {
      const waitQuery = wait_seconds && wait_seconds > 0 ? `?wait_seconds=${wait_seconds}` : '';
      const result = await apiFetch<JobStatusResult>(`/mcp/jobs/${job_id}${waitQuery}`, resolveApiKey(extra));
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  return server;
}
