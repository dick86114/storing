#!/bin/bash

# 前后端服务重启脚本
# 前端端口: 1050 (Next.js)
# 后端端口: 1052 (API)

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/apps/web"
API_DIR="$SCRIPT_DIR/apps/api"

echo "=== 服务重启脚本 ==="
echo ""

# 关闭指定端口的进程
kill_port() {
  local port=$1
  local name=$2

  echo "检查 $name 端口 $port..."
  PID=$(lsof -i :$port -t 2>/dev/null)

  if [ -n "$PID" ]; then
    echo "端口 $port 被进程 $PID 占用，正在关闭..."
    kill $PID 2>/dev/null
    sleep 2

    # 检查是否成功关闭
    PID=$(lsof -i :$port -t 2>/dev/null)
    if [ -n "$PID" ]; then
      echo "进程未响应，强制关闭..."
      kill -9 $PID 2>/dev/null
      sleep 1
    fi

    PID=$(lsof -i :$port -t 2>/dev/null)
    if [ -n "$PID" ]; then
      echo "❌ 无法关闭端口 $port"
      return 1
    fi
    echo "✓ $name 端口已释放"
  else
    echo "✓ $name 端口 $port 未被占用"
  fi
  return 0
}

# 关闭后端
kill_port $BACKEND_PORT "后端"
echo ""

# 关闭前端
kill_port $FRONTEND_PORT "前端"
echo ""

echo "=== 启动服务 ==="
echo ""

# 启动后端
echo "启动后端 API..."
cd "$API_DIR"
nohup node --import tsx src/index.ts > "$SCRIPT_DIR/api.log" 2>&1 &
BACKEND_PID=$!
echo "✓ 后端进程: $BACKEND_PID"

sleep 2

# 启动前端
echo "启动前端 Web..."
cd "$WEB_DIR"
nohup npx next dev --port 1050 > "$SCRIPT_DIR/web.log" 2>&1 &
FRONTEND_PID=$!
echo "✓ 前端进程: $FRONTEND_PID"

sleep 3

# 验证服务状态
echo ""
echo "=== 服务状态 ==="

BACKEND_RUNNING=$(lsof -i :$BACKEND_PORT -t 2>/dev/null)
FRONTEND_RUNNING=$(lsof -i :$FRONTEND_PORT -t 2>/dev/null)

if [ -n "$BACKEND_RUNNING" ]; then
  echo "✅ 后端 API: http://localhost:$BACKEND_PORT (进程: $BACKEND_RUNNING)"
else
  echo "❌ 后端 API 启动失败，查看日志: cat $SCRIPT_DIR/api.log"
fi

if [ -n "$FRONTEND_RUNNING" ]; then
  echo "✅ 前端 Web: http://localhost:$FRONTEND_PORT (进程: $FRONTEND_RUNNING)"
else
  echo "❌ 前端 Web 启动失败，查看日志: cat $SCRIPT_DIR/web.log"
fi

echo ""
echo "=== 完成 ==="
echo "日志文件:"
echo "  后端: $SCRIPT_DIR/api.log"
echo "  前端: $SCRIPT_DIR/web.log"