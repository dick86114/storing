#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env'), quiet: true });

const STORING_API_BASE = process.env.STORING_API_BASE || 'http://localhost:1052/api/v1';
const STORING_MCP_API_KEY = process.env.STORING_MCP_API_KEY || '';

if (!STORING_MCP_API_KEY) {
  console.error('Missing STORING_MCP_API_KEY');
  process.exit(1);
}

const server = new McpServer({
  name: 'storing-mcp-server',
  version: '0.1.0',
});

type SummarizeResult = {
  status: 'running';
  job_id: number;
  message: string;
};

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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${STORING_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STORING_MCP_API_KEY}`,
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
}

server.registerTool(
  'summarize_url',
  {
    description: '提交一个公开网页链接到 Storing，异步抓取正文并生成智能摘要，返回 job_id 用于轮询。',
    inputSchema: {
      url: z.string().url().describe('需要总结的公开网页链接'),
      language: z.string().optional().describe('摘要语言，可选，当前版本仅透传保留'),
      summary_style: z.enum(['brief', 'detailed', 'bullet']).optional().describe('摘要风格，可选，当前版本仅透传保留'),
    },
    outputSchema: {
      status: z.literal('running'),
      job_id: z.number(),
      message: z.string(),
    },
  },
  async ({ url, language, summary_style }) => {
    const result = await apiFetch<SummarizeResult>('/mcp/summarize', {
      method: 'POST',
      body: JSON.stringify({ url, language, summary_style }),
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);



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
  async ({ url }) => {
    const result = await apiFetch<CollectResult>('/mcp/collect', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  'get_collect_status',
  {
    description: '根据 job_id 查询 Storing 链接总结或收藏任务状态；完成后返回标题、摘要和标签。',
    inputSchema: {
      job_id: z.number().int().positive().describe('summarize_url 或 collect_url 返回的任务 ID'),
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
  async ({ job_id }) => {
    const result = await apiFetch<JobStatusResult>(`/mcp/jobs/${job_id}`);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Storing MCP server running with API base ${STORING_API_BASE}`);
}

main().catch((error) => {
  console.error('Storing MCP server error:', error);
  process.exit(1);
});
