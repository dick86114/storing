# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Storing（乾坤戒）是 AI 驱动的个人稍后阅读平台，核心功能包括 AI 摘要、智能分类和自动标签。

## 常用命令

```bash
# 启动开发环境（turbo 并行启动前后端）
pnpm dev

# 或使用重启脚本（自动检查健康状态，支持 --force 强制重启）
bash restart.sh

# 或分别启动
cd apps/api && pnpm dev    # API 服务 (端口 1052)
cd apps/web && pnpm dev    # 前端 (端口 1050)

# 构建和 lint
pnpm build
pnpm lint

# 数据库操作
pnpm db:push               # 推送 schema 到数据库
pnpm db:seed               # 种子数据（如有）
```

访问地址：
- 前端：http://localhost:1050
- 后端 API：http://localhost:1052/api/v1

## 架构概览

### Monorepo 结构
```
apps/
├── api/          # Hono 后端 (端口 1052)
│   └── src/
│       ├── routes/       # articles.ts, auth.ts, search.ts, health.ts
│       ├── services/     # AI、抓取、阅读器服务
│       ├── middleware/   # JWT 认证中间件
│       └── db/           # Drizzle schema
├── web/          # Next.js 15 前端 (端口 1050)
│   └── src/
│       ├── app/          # App Router
│       ├── components/   # React 组件
│       ├── hooks/        # SWR hooks (useArticles, useArticle, useSearch 等)
│       └── lib/          # API 客户端
packages/shared/  # 共享类型和常量
```

### 数据库架构

三张核心表，通过 `article_id` 关联：

- **articles**（只读）：外部数据源，存储原始文章内容
- **article_metadata**（读写）：业务数据，存储收藏状态、归档状态、AI 摘要/分类/标签
- **users**：管理员账号，启动时自动初始化（默认 admin/admin123）

查询时 LEFT JOIN articles 和 article_metadata。

### 认证

JWT 认证，token 存储在 localStorage，前端 API 客户端自动携带 Authorization header。

中间件：
- `requireAuth`：强制登录
- `optionalAuth`：可选登录

### AI 服务

支持多提供商：anthropic、deepseek、zhipu、minimax、kimi、doubao、openrouter、nvidia、aliyun、siliconflow、custom。通过 `.env` 中的 `AI_PROVIDER` 选择。

## 环境变量

```bash
# 必需
DATABASE_URL=postgresql://user:password@host:port/dbname
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...

# 可选
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your-secret
READER_API_BASE=https://...    # 文章抓取服务
IMG_HOST=https://...           # 图片上传服务
```

## 设计规范

UI 修改参照 `docs/PRD-Readwise-Later.md`：
- oklch 色彩空间，CSS 自定义属性
- 玻璃质感：`backdrop-filter: blur()` + 半透明
- 响应式断点：900px、640px