#!/bin/bash

# 前后端服务停止脚本
# 支持停止 Docker 容器和本地服务
# 使用方法: bash stop.sh [--docker|--local|--all]

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

STOP_DOCKER=false
STOP_LOCAL=false

case "$1" in
  --docker)
    STOP_DOCKER=true
    ;;
  --local)
    STOP_LOCAL=true
    ;;
  --all|"")
    STOP_DOCKER=true
    STOP_LOCAL=true
    ;;
  *)
    echo "用法: bash stop.sh [--docker|--local|--all]"
    echo "  --docker  只停止 Docker 容器"
    echo "  --local   只停止本地服务"
    echo "  --all     停止所有服务（默认）"
    exit 1
    ;;
esac

echo "=== 服务停止脚本 ==="
echo ""

kill_port() {
  local port=$1
  local name=$2
  local pids

  echo "检查 $name 端口 $port..."

  pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)

  if [ -n "$pids" ]; then
    echo "端口 $port 被占用，正在关闭所有相关进程: $pids"
    kill $pids 2>/dev/null || true
    sleep 2

    pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "仍有进程占用，强制关闭..."
      kill -9 $pids 2>/dev/null || true
      sleep 2
    fi

    pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "❌ 无法关闭端口 $port"
      return 1
    fi
    echo "✓ $name 端口已释放"
  else
    echo "✓ $name 端口 $port 未被占用"
  fi
  return 0
}

stop_docker() {
  echo "=== 停止 Docker 容器 ==="
  echo ""
  
  cd "$SCRIPT_DIR"
  
  CONTAINER_RUNNING=$(docker ps --filter "name=storing" --filter "status=running" -q 2>/dev/null)
  
  if [ -n "$CONTAINER_RUNNING" ]; then
    echo "正在停止 Docker 容器..."
    docker-compose down
    if [ $? -eq 0 ]; then
      echo "✓ Docker 容器已停止"
    else
      echo "❌ Docker 容器停止失败"
    fi
  else
    echo "✓ Docker 容器未运行"
  fi
  echo ""
}

stop_local() {
  echo "=== 停止本地服务 ==="
  echo ""
  
  echo "清理所有相关进程..."
  pkill -9 -f "node.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "pnpm.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "turbo.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "next.*$SCRIPT_DIR" 2>/dev/null || true
  pkill -9 -f "tsx.*$SCRIPT_DIR" 2>/dev/null || true

  sleep 2

  echo ""
  echo "=== 关闭端口 ==="
  echo ""

  kill_port $BACKEND_PORT "后端"
  echo ""

  kill_port $FRONTEND_PORT "前端"
  echo ""
}

cleanup_logs() {
  echo "=== 清理日志 ==="
  if [ -f "$SCRIPT_DIR/api.log" ]; then
    rm -f "$SCRIPT_DIR/api.log"
    echo "✓ 已删除 api.log"
  fi
  if [ -f "$SCRIPT_DIR/web.log" ]; then
    rm -f "$SCRIPT_DIR/web.log"
    echo "✓ 已删除 web.log"
  fi
  echo ""
}

if [ "$STOP_DOCKER" = true ]; then
  stop_docker
fi

if [ "$STOP_LOCAL" = true ]; then
  stop_local
fi

cleanup_logs

echo "=== 服务已全部停止 ==="
