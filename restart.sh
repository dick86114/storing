#!/bin/bash

# 前后端服务重启脚本
# 前端端口: 1050 (Next.js)
# 后端端口: 1052 (API)
# 使用方法: bash restart.sh [--force]

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/apps/web"
API_DIR="$SCRIPT_DIR/apps/api"
FORCE_RESTART=false

# 解析参数
if [ "$1" == "--force" ]; then
  FORCE_RESTART=true
  echo "⚠️  强制重启模式已启用"
fi

echo "=== 服务重启脚本 ==="
echo ""

# 检查并安装依赖
check_dependencies() {
  local root_dir="$SCRIPT_DIR"
  local web_modules="$WEB_DIR/node_modules"
  local api_modules="$API_DIR/node_modules"

  echo "检查依赖安装状态..."

  # 检查根目录和子项目的 node_modules（pnpm monorepo 需要子项目也有）
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

# 检查依赖
check_dependencies
echo ""

# 检查服务是否正常运行
check_service_health() {
  local port=$1
  local name=$2
  local health_url=$3

  echo "检查 $name 服务健康状态..."

  if curl -s --max-time 3 "$health_url" > /dev/null 2>&1; then
    echo "✅ $name 服务正常运行，无需重启"
    return 0
  else
    echo "❌ $name 服务未正常运行，需要重启"
    return 1
  fi
}

# 先检查服务是否正常运行（如果不是强制重启）
if [ "$FORCE_RESTART" = false ]; then
  BACKEND_HEALTH=$(check_service_health $BACKEND_PORT "后端" "http://localhost:$BACKEND_PORT/api/v1/health")
  FRONTEND_HEALTH=$(check_service_health $FRONTEND_PORT "前端" "http://localhost:$FRONTEND_PORT")

  if [ $? -eq 0 ]; then
    echo ""
    echo "=== 所有服务正常运行，无需重启 ==="
    echo "前端: http://localhost:$FRONTEND_PORT"
    echo "后端: http://localhost:$BACKEND_PORT/api/v1"
    echo ""
    echo "💡 如需强制重启，请使用: bash restart.sh --force"
    exit 0
  fi
fi

echo ""
echo "=== 开始重启服务 ==="
echo ""

# 关闭指定端口的进程（改进版）
kill_port() {
  local port=$1
  local name=$2

  echo "检查 $name 端口 $port..."

  # 使用 fuser 强制关闭所有占用该端口的进程
  if fuser $port/tcp &>/dev/null; then
    echo "端口 $port 被占用，正在关闭所有相关进程..."
    fuser -k $port/tcp 2>/dev/null
    sleep 2

    # 再次检查并强制关闭残留进程
    if fuser $port/tcp &>/dev/null; then
      echo "仍有进程占用，强制关闭..."
      fuser -k -9 $port/tcp 2>/dev/null
      sleep 2
    fi

    # 最终检查
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

# 等待端口完全释放
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

# 关闭所有相关进程（更彻底的清理）
echo "清理所有相关进程..."
# 使用 killall 和 pkill 组合，确保清理所有相关进程
killall -9 node 2>/dev/null || true
killall -9 pnpm 2>/dev/null || true
killall -9 turbo 2>/dev/null || true
killall -9 next 2>/dev/null || true
killall -9 tsx 2>/dev/null || true

# 再次使用 pkill 确保清理
pkill -9 -f "pnpm" 2>/dev/null || true
pkill -9 -f "turbo" 2>/dev/null || true
pkill -9 -f "next" 2>/dev/null || true
pkill -9 -f "tsx" 2>/dev/null || true
pkill -9 -f "node.*storing" 2>/dev/null || true

sleep 3

# 关闭后端
kill_port $BACKEND_PORT "后端"
wait_for_port $BACKEND_PORT "后端"
echo ""

# 关闭前端
kill_port $FRONTEND_PORT "前端"
wait_for_port $FRONTEND_PORT "前端"
echo ""

echo "=== 启动服务 ==="
echo ""

# 启动后端
echo "启动后端 API..."
cd "$API_DIR"
nohup pnpm dev > "$SCRIPT_DIR/api.log" 2>&1 &
BACKEND_PID=$!
echo "✓ 后端进程: $BACKEND_PID"

sleep 3

# 启动前端
echo "启动前端 Web..."
cd "$WEB_DIR"
nohup pnpm dev > "$SCRIPT_DIR/web.log" 2>&1 &
FRONTEND_PID=$!
echo "✓ 前端进程: $FRONTEND_PID"

sleep 5

# 验证服务状态
echo ""
echo "=== 服务状态 ==="

# 使用健康检查验证服务
if curl -s --max-time 5 "http://localhost:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
  echo "✅ 后端 API: http://localhost:$BACKEND_PORT/api/v1"
else
  echo "❌ 后端 API 启动失败，查看日志: cat $SCRIPT_DIR/api.log"
fi

if curl -s --max-time 5 "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
  echo "✅ 前端 Web: http://localhost:$FRONTEND_PORT"
else
  echo "❌ 前端 Web 启动失败，查看日志: cat $SCRIPT_DIR/web.log"
fi

echo ""
echo "=== 完成 ==="
echo "日志文件:"
echo "  后端: $SCRIPT_DIR/api.log"
echo "  前端: $SCRIPT_DIR/web.log"