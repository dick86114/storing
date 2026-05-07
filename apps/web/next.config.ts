import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 关闭开发状态指示器
  devIndicators: false,

  // 启用 standalone 输出模式（用于容器化部署）
  output: 'standalone',

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:1052/api/:path*',
      },
    ];
  },
};

export default nextConfig;
