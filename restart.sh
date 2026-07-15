#!/bin/bash

# 前后端服务重启脚本
# 支持停止所有服务并重启本地服务
# 使用方法: bash restart.sh [--force]

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/apps/web"
API_DIR="$SCRIPT_DIR/apps/api"
FORCE_RESTART=false

if [ "$1" == "--force" ]; then
  FORCE_RESTART=true
  echo "⚠️  强制重启模式已启用"
fi

echo "=== 服务重启脚本 ==="
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

wait_for_port() {
  local port=$1
  local name=$2
  local max_wait=10
  local count=0

  echo "等待 $name 端口 $port 完全释放..."
  while lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1 && [ $count -lt $max_wait ]; do
    sleep 1
    count=$((count + 1))
    echo "  等待中... ($count/$max_wait)"
  done

  if lsof -i :$port -sTCP:LISTEN >/dev/null 2>&1; then
    echo "⚠️  端口 $port 仍显示为LISTEN状态，但可能已无进程占用"
    echo "  尝试继续启动服务..."
  else
    echo "✓ 端口 $port 已完全释放"
  fi
}

clear_frontend_cache() {
  echo "清理前端 Next 缓存..."
  rm -rf "$WEB_DIR/.next" "$WEB_DIR/.next-dev"
  echo "✓ 前端缓存已清理"
}

check_dependencies() {
  local root_dir="$SCRIPT_DIR"
  local web_modules="$WEB_DIR/node_modules"
  local api_modules="$API_DIR/node_modules"

  echo "检查依赖安装状态..."

  if [ ! -d "$root_dir/node_modules" ] || [ ! -d "$web_modules/.bin" ] || [ ! -d "$api_modules/.bin" ]; then
    echo "❌ 依赖不完整，正在安装..."
    cd "$root_dir"
    pnpm install
    if [ $? -ne 0 ]; then
      echo "❌ 依赖安装失败，请检查网络代理设置或手动运行: pnpm install"
      exit 1
    fi
    echo "✓ 依赖安装完成"
  else
    echo "✓ 依赖已安装"
  fi
}



launch_detached_service() {
  local workdir="$1"
  local logfile="$2"
  local pidfile="$3"
  shift 3

  python3 - "$workdir" "$logfile" "$pidfile" "$@" <<'PY'
import os
import subprocess
import sys

workdir = sys.argv[1]
logfile = sys.argv[2]
pidfile = sys.argv[3]
cmd = sys.argv[4:]

env = os.environ.copy()
env['NODE_OPTIONS'] = '--disable-warning=DEP0205'

with open(logfile, 'ab', buffering=0) as log:
    process = subprocess.Popen(
        cmd,
        cwd=workdir,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )

with open(pidfile, 'w', encoding='utf-8') as f:
    f.write(str(process.pid))

print(process.pid)
PY
}

check_pid_alive() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
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

wait_for_service_health() {
  local name=$1
  local health_url=$2
  local max_wait=${3:-60}
  local count=0

  echo "等待 $name 服务就绪..."
  while [ $count -lt $max_wait ]; do
    if curl -s --max-time 3 "$health_url" > /dev/null 2>&1; then
      echo "✅ $name 服务正常运行"
      return 0
    fi

    sleep 1
    count=$((count + 1))
    if [ $((count % 5)) -eq 0 ]; then
      echo "  等待中... ($count/$max_wait)"
    fi
  done

  echo "❌ $name 服务未正常运行"
  return 1
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

check_dependencies
echo ""

if [ "$FORCE_RESTART" = false ]; then
  DOCKER_RUNNING=$(docker ps --filter "name=storing" --filter "status=running" -q 2>/dev/null)
  
  if [ -n "$DOCKER_RUNNING" ]; then
    echo "⚠️  检测到 Docker 容器正在运行"
    echo "restart.sh 用于重启本地服务，将停止 Docker 容器"
    echo ""
    stop_all_services
    echo ""
  else
    BACKEND_HEALTH=$(check_service_health $BACKEND_PORT "后端" "http://localhost:$BACKEND_PORT/api/v1/health")
    FRONTEND_HEALTH=$(check_service_health $FRONTEND_PORT "前端" "http://localhost:$FRONTEND_PORT")
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "=== 本地服务正常运行，无需重启 ==="
      echo "前端: http://localhost:$FRONTEND_PORT"
      echo "后端: http://localhost:$BACKEND_PORT/api/v1"
      echo ""
      echo "💡 如需强制重启，请使用: bash restart.sh --force"
      echo "💡 如需使用 Docker 版本，请使用: bash deploy-docker.sh"
      exit 0
    fi
  fi
fi

echo ""
stop_all_services
echo ""

wait_for_port $BACKEND_PORT "后端"
echo ""
wait_for_port $FRONTEND_PORT "前端"
echo ""

clear_frontend_cache
echo ""

echo "=== 启动本地服务 ==="
echo ""

echo "启动后端 API..."
BACKEND_PID=$(launch_detached_service "$API_DIR" "$SCRIPT_DIR/api.log" "/tmp/storing-api.pid" pnpm exec tsx watch src/index.ts)
echo "✓ 后端进程: $BACKEND_PID"

sleep 3

echo "启动前端 Web..."
FRONTEND_PID=$(launch_detached_service "$WEB_DIR" "$SCRIPT_DIR/web.log" "/tmp/storing-web.pid" pnpm dev)
echo "✓ 前端进程: $FRONTEND_PID"

echo ""
echo "=== 服务状态 ==="

if wait_for_service_health "后端 API" "http://localhost:$BACKEND_PORT/api/v1/health" 30 && check_pid_alive "$BACKEND_PID"; then
  echo "✅ 后端 API: http://localhost:$BACKEND_PORT/api/v1"
else
  echo "❌ 后端 API 启动失败，查看日志: cat $SCRIPT_DIR/api.log"
fi

if wait_for_service_health "前端 Web" "http://localhost:$FRONTEND_PORT" 60 && check_pid_alive "$FRONTEND_PID"; then
  echo "✅ 前端 Web: http://localhost:$FRONTEND_PORT"
else
  echo "❌ 前端 Web 启动失败，查看日志: cat $SCRIPT_DIR/web.log"
fi

echo ""
echo "=== 完成 ==="
echo "日志文件:"
echo "  后端: $SCRIPT_DIR/api.log"
echo "  前端: $SCRIPT_DIR/web.log"
echo ""
echo "💡 其他命令:"
echo "  停止服务: bash stop.sh"
echo "  Docker 部署: bash deploy-docker.sh"
echo "  本地开发: bash deploy-dev.sh"
