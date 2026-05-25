import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const createNextConfig = (phase: string): NextConfig => ({
  // 关闭开发状态指示器
  devIndicators: false,

  // dev 与 build 使用不同输出目录，避免构建时覆盖正在运行的开发服务缓存。
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',

  // Docker 构建时启用 standalone；本地 build 保持默认输出。
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:1052/api/:path*',
      },
    ];
  },
});

export default createNextConfig;
