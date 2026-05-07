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
# 构建镜像并启动服务
docker-compose up -d --build

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

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
```

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

## 单镜像架构说明

本项目采用单镜像架构，将前端和后端打包在一起：

- **优点**：部署简单、镜像体积小、无需多容器编排
- **运行方式**：容器启动时同时运行 API 和 Web 服务
- **端口**：1050（前端）、1052（API）

镜像大小约 **200-300MB**（Node.js Alpine + 构建产物）。