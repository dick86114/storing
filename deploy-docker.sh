#!/bin/bash

# Docker Compose 部署脚本
# 用于部署 DockerHub 线上版本
# 使用方法: bash deploy-docker.sh [--force]

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FORCE_RESTART=false

if [ "$1" == "--force" ]; then
  FORCE_RESTART=true
  echo "⚠️  强制重启模式已启用"
fi

echo "=== Docker Compose 部署脚本 ==="
echo ""

kill_port() {
  local port=$1
  local name=$2

  echo "检查 $name 端口 $port..."

  if fuser $port/tcp &>/dev/null; then
    echo "端口 $port 被占用，正在关闭所有相关进程..."
    fuser -k $port/tcp 2>/dev/null
    sleep 2

    if fuser $port/tcp &>/dev/null; then
      echo "仍有进程占用，强制关闭..."
      fuser -k -9 $port/tcp 2>/dev/null
      sleep 2
    fi

    if fuser $port/tcp &>/dev/null; then
      echo "❌ 无法关闭端口 $port"
      return 1
    fi
    echo "✓ $name 端口已释放"
  else
    echo "✓ $name 端口 $port 未被占用"
  fi
  return 0
}

stop_all_services() {
  echo "=== 停止所有服务 ==="
  echo ""

  echo "停止 Docker 容器..."
  cd "$SCRIPT_DIR"
  docker-compose down 2>/dev/null || true

  echo ""
  echo "停止本地服务..."
  kill_port $BACKEND_PORT "后端"
  kill_port $FRONTEND_PORT "前端"

  pkill -9 -f "node.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "pnpm.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "turbo.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "next.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "tsx.*$SCRIPT_DIR" 2>/dev/null || true

  sleep 2
  echo "✓ 所有服务已停止"
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
  fi

  if ! docker info &> /dev/null; then
    echo "❌ Docker 服务未运行，请先启动 Docker"
    exit 1
  fi
  echo "✓ Docker 环境正常"
}

check_env_file() {
  if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "⚠️  .env 文件不存在"
    echo "请确保已配置必要的环境变量："
    echo "  - DATABASE_URL"
    echo "  - AI_PROVIDER"
    echo "  - 对应的 API_KEY"
    exit 1
  fi
  echo "✓ .env 文件存在"
}

check_service_health() {
  local port=$1
  local name=$2
  local health_url=$3

  echo "检查 $name 服务健康状态..."

  if curl -s --max-time 3 "$health_url" > /dev/null 2>&1; then
    echo "✅ $name 服务正常运行"
    return 0
  else
    echo "❌ $name 服务未正常运行"
    return 1
  fi
}

check_docker
echo ""
check_env_file
echo ""

if [ "$FORCE_RESTART" = false ]; then
  CONTAINER_RUNNING=$(docker ps --filter "name=storing" --filter "status=running" -q 2>/dev/null)
  
  if [ -n "$CONTAINER_RUNNING" ]; then
    BACKEND_HEALTH=$(check_service_health $BACKEND_PORT "后端" "http://localhost:$BACKEND_PORT/api/v1/health")
    FRONTEND_HEALTH=$(check_service_health $FRONTEND_PORT "前端" "http://localhost:$FRONTEND_PORT")
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "=== Docker 服务正常运行，无需重启 ==="
      echo "前端: http://localhost:$FRONTEND_PORT"
      echo "后端: http://localhost:$BACKEND_PORT/api/v1"
      echo ""
      echo "💡 如需强制重启，请使用: bash deploy-docker.sh --force"
      exit 0
    fi
  fi
fi

echo ""
stop_all_services
echo ""

echo "=== 拉取最新镜像 ==="
cd "$SCRIPT_DIR"
docker-compose pull
if [ $? -ne 0 ]; then
  echo "❌ 镜像拉取失败"
  exit 1
fi
echo "✓ 镜像拉取完成"
echo ""

echo "=== 启动 Docker 容器 ==="
docker-compose up -d
if [ $? -ne 0 ]; then
  echo "❌ Docker 容器启动失败"
  exit 1
fi
echo "✓ Docker 容器已启动"
echo ""

echo "=== 等待服务就绪 ==="
MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  if curl -s --max-time 2 "http://localhost:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
    echo "✓ 后端服务就绪"
    break
  fi
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
  echo "  等待中... ($WAIT_COUNT/$MAX_WAIT 秒)"
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo "⚠️  后端服务启动超时，请检查日志: docker-compose logs"
fi

sleep 3

echo ""
echo "=== 服务状态 ==="
if curl -s --max-time 5 "http://localhost:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
  echo "✅ 后端 API: http://localhost:$BACKEND_PORT/api/v1"
else
  echo "❌ 后端 API 启动失败"
fi

if curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
  echo "✅ 前端 Web: http://localhost:$FRONTEND_PORT"
else
  echo "❌ 前端 Web 启动失败"
fi

echo ""
echo "=== 部署完成 ==="
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down 或 bash stop.sh"