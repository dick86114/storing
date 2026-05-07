# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Storing 是一款 AI 驱动的个人稍后阅读平台，核心功能包括 AI 摘要、智能分类和自动标签。

## 技术栈

- **前端**：Next.js 15 (App Router) + React + Tailwind CSS + SWR
- **后端**：Hono (Node.js) + Drizzle ORM
- **数据库**：远程 PostgreSQL（weread 库，articles 表只读）
- **AI**：支持 Anthropic / DeepSeek / 智谱 GLM（通过 .env 配置）
- **包管理**：pnpm monorepo

## 常用命令

```bash
# 启动开发环境（需要两个终端）
cd apps/api && node --import tsx src/index.ts    # API 服务 (端口 3001)
cd apps/web && npx next dev --port 3000          # 前端 (端口 3000)

# 数据库操作
cd apps/api
npx drizzle-kit push                             # 推送 schema 到数据库
```

## 数据库架构

- `articles` 表：外部数据源，**只读不写**
- `article_metadata` 表：平台业务数据（收藏、归档、AI 摘要/分类/标签），通过 `article_id` 关联
- 查询时使用 LEFT JOIN 两张表

## 项目结构

```
storing/
├── apps/web/          # Next.js 前端
│   └── src/
│       ├── app/       # 路由: /inbox, /favorites, /archive
│       ├── components/
│       ├── hooks/
│       └── lib/       # API 客户端
├── apps/api/          # Hono 后端
│   └── src/
│       ├── routes/    # articles, search, health
│       ├── services/  # scraper, ai
│       └── db/        # Drizzle schema
├── packages/shared/   # 共享类型和常量
├── ui/                # HTML 原型（参考用）
└── docs/              # PRD 文档
```

## 设计规范

修改 UI 时请参照 `docs/PRD-Readwise-Later.md` 中的视觉规范。核心设计元素：
- 色彩：oklch 色彩空间，CSS 自定义属性
- 玻璃质感：`backdrop-filter: blur()` + `color-mix()` 半透明
- 纸张纹理：SVG fractalNoise，浅色模式显示
- 响应式断点：900px（桌面/平板）、640px（平板/手机）
- 动效：卡片入场动画、侧滑面板、搜索弹窗

## 环境变量

在项目根目录创建 `.env` 文件：
```
DATABASE_URL=postgresql://user:password@host:port/dbname

# AI 配置（三选一）
AI_PROVIDER=anthropic       # anthropic / deepseek / zhipu
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
ZHIPU_API_KEY=...
```
