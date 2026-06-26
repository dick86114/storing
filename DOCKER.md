# 乾坤戒 - 容器化部署

## 快速开始

### 1. 准备环境变量文件

创建 `.env` 文件（参考 `.env.example`）：

```bash
cp .env.example .env
# 编辑 .env 文件，填入真实的配置值
```

**必须配置的环境变量：**
- `DATABASE_URL` - PostgreSQL 数据库连接地址
- `AI_PROVIDER` - AI 服务提供商（如 deepseek）
- `DEEPSEEK_API_KEY` 或其他 AI 密钥

### 2. 构建并启动

```bash
# 拉取 GitHub Actions 推送到 DockerHub 的镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

启动后会有两个容器：

- `storing`：Web + API 主服务
- `storing-singlefile`：网页采集 sidecar，使用无头浏览器运行 SingleFile，把普通网页保存成完整 HTML

### 3. 访问服务

- **前端**: http://localhost:1050
- **API**: http://localhost:1052/api/v1/health

---

## 常用命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建
docker-compose build --no-cache

# 进入容器
docker exec -it storing sh

# 查看容器资源使用
docker stats storing

# 单独查看网页采集服务日志
docker-compose logs -f singlefile

# 只重建网页采集服务
docker-compose up -d --build singlefile
```

---

## 网页采集 / SingleFile

手动采集普通网页时，API 会优先调用 `SINGLEFILE_SERVICE_URL` 指向的 SingleFile 服务。`docker-compose.yml` 默认已经内置：

```env
SINGLEFILE_SERVICE_URL=http://singlefile:3000
SINGLEFILE_TIMEOUT_MS=180000
SINGLEFILE_MAX_BUFFER=83886080
```

这不是普通 `fetch` 抓取，而是由 `storing-singlefile` 容器启动无头浏览器加载网页，再用 SingleFile 保存完整 HTML。这样对前端渲染页面、懒加载图片和基础机器人检测会更友好。

如果 sidecar 抓取失败，API 默认会继续尝试本地兜底链路：`single-file` 命令、Docker CLI、`npx single-file-cli`。如果你的服务器只希望使用 sidecar，避免 API 容器里尝试其他方式，可以在 `.env` 中增加：

```env
SINGLEFILE_SERVICE_FALLBACK_LOCAL=false
```

注意：强验证码、登录墙、付费墙或必须人工交互的网站仍可能无法抓取。

---

## 生产部署建议

### 1. 使用外部数据库
建议使用云数据库服务（如 Supabase、Neon、AWS RDS），而不是容器内的 PostgreSQL。

### 2. 配置 HTTPS
使用反向代理（如 Nginx、Caddy）配置 SSL 证书：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:1050;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:1052;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3. 设置资源限制
在 `docker-compose.yml` 中添加：

```yaml
services:
  storing:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## 容器架构说明

本项目主服务仍采用单镜像架构，将前端和后端打包在一起；网页采集使用独立 SingleFile sidecar：

- **storing**：同时运行 API 和 Web 服务
- **singlefile**：只负责浏览器级网页镜像抓取，不对外暴露端口
- **端口**：1050（前端）、1052（API）

主服务镜像大小约 **200-300MB**（Node.js Alpine + 构建产物）。SingleFile sidecar 包含浏览器运行环境，体积会明显更大，这是为了保证网页采集还原度。
