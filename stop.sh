#!/bin/bash

# 前后端服务停止脚本
# 前端端口: 1050 (Next.js)
# 后端端口: 1052 (API)
# 使用方法: bash stop.sh

FRONTEND_PORT=1050
BACKEND_PORT=1052
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 服务停止脚本 ==="
echo ""

# 关闭指定端口的进程
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

# 关闭所有相关进程
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

sleep 2

echo ""
echo "=== 关闭端口 ==="
echo ""

# 关闭后端
kill_port $BACKEND_PORT "后端"
echo ""

# 关闭前端
kill_port $FRONTEND_PORT "前端"
echo ""

# 清理日志文件（可选）
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
echo "=== 服务已全部停止 ==="