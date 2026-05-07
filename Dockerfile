# 乾坤戒 - 单镜像容器化配置
# 将前端和后端打包到一个镜像中

FROM node:20-alpine AS base

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ========== 依赖安装阶段 ==========
FROM base AS deps

# 复制 package 文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# ========== 构建阶段 ==========
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

# 构建前端
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && pnpm run build

# ========== 运行阶段 ==========
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 storing

# 复制构建产物
# 共享包（源码，无需构建）
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# API 后端
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=storing:nodejs /app/apps/api/node_modules ./apps/api/node_modules

# Web 前端
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=storing:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# 复根目录文件
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/apps/api && node --import tsx src/index.ts &' >> /app/start.sh && \
    echo 'cd /app/apps/web/.next/standalone/apps/web && node server.js &' >> /app/start.sh && \
    echo 'wait' >> /app/start.sh && \
    chmod +x /app/start.sh

# 设置权限
RUN chown -R storing:nodejs /app

USER storing

# 暴露端口
EXPOSE 1050 1052

# 设置环境变量默认值
ENV PORT=1050
ENV API_PORT=1052

# 启动服务
CMD ["/app/start.sh"]