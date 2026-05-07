import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 关闭开发状态指示器
  devIndicators: false,

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
