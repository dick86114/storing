# 乾坤戒 (Storing)

AI驱动的个人稍后阅读平台，让你的文章收藏变成真正的知识资产。

## 项目介绍

乾坤戒是一个现代化的稍后阅读应用，集成了AI智能摘要和分类功能，帮助你更好地管理和阅读收藏的文章。

## 技术栈

### 前端
- **Next.js 15** - React框架
- **React 19** - UI库
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架

### 后端
- **Hono** - 轻量级Web框架
- **Node.js** - 运行环境
- **TypeScript** - 类型安全
- **Drizzle ORM** - 数据库ORM

### 数据库
- **PostgreSQL** - 关系型数据库

### AI集成
- 支持多种AI提供商：DeepSeek、Anthropic、智谱AI、OpenRouter等
- 智能文章摘要和分类

## 快速开始

### 本地开发

1. 克隆项目
```bash
git clone https://github.com/dick86114/storing.git
cd storing
```

2. 安装依赖
```bash
pnpm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑.env文件，填入必要的配置
```

4. 启动开发服务器
```bash
pnpm dev
```

访问：
- 前端：http://localhost:1050
- 后端API：http://localhost:1052/api/v1

### Docker部署

#### 使用DockerHub镜像
```bash
# 拉取镜像
docker pull 86114/storing:latest

# 运行容器
docker run -d \
  --name storing \
  -p 1050:1050 \
  -p 1052:1052 \
  --env-file .env \
  86114/storing:latest
```

#### 使用docker-compose
```bash
# 生产环境
docker-compose up -d

# 开发环境（支持源码挂载）
docker-compose -f docker-compose.dev.yml up -d
```

## 部署方式

### 1. Docker部署（推荐）
- 支持多平台：linux/amd64, linux/arm64
- 自动化构建和部署
- 镜像地址：`86114/storing`

### 2. 本地开发部署
- 使用pnpm管理依赖
- 支持热重载开发
- 前后端分离架构

### 3. GitHub Actions自动化
- 自动CI检查（lint、类型检查、构建）
- 自动构建Docker镜像
- 自动推送到DockerHub

## 环境变量配置

必需的环境变量：

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@host:port/database

# AI配置
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-api-key

# 文章抓取服务（可选）
READER_API_BASE=https://your-reader-service

# 图片上传服务（可选）
IMG_HOST=https://your-image-host
IMG_API_KEY=your-api-key
```

## 项目结构

```
storing/
├── apps/
│   ├── api/          # 后端API服务
│   └── web/          # 前端Web应用
├── packages/
│   └── shared/       # 共享代码包
├── .github/
│   └── workflows/    # GitHub Actions配置
├── Dockerfile        # Docker构建文件
├── docker-compose.yml # 生产环境部署
└── docker-compose.dev.yml # 开发环境部署
```

## 功能特性

- ✅ 文章收藏和管理
- ✅ AI智能摘要
- ✅ 自动分类和标签
- ✅ 全文搜索
- ✅ 多设备同步
- ✅ 离线阅读支持
- ✅ 深色模式
- ✅ 响应式设计

## 开发指南

### 代码规范
- 使用ESLint进行代码检查
- TypeScript严格模式
- 统一的代码风格

### 提交代码
```bash
# 运行lint检查
pnpm lint

# 构建项目
pnpm build

# 提交代码
git add .
git commit -m "your message"
git push
```

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/dick86114/storing
- DockerHub: https://hub.docker.com/r/86114/storing