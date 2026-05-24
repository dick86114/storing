#!/bin/bash
# Docker 启动验证脚本

echo "=== 验证 Docker 配置修复 ==="
echo ""

echo "1. 检查 docker-compose.yml 配置:"
if grep -q "env_file:" docker-compose.yml; then
    echo "✓ 已添加 env_file 配置"
else
    echo "✗ 缺少 env_file 配置"
fi
echo ""

echo "2. 检查 .env 文件:"
if [ -f .env ]; then
    echo "✓ .env 文件存在"
    if grep -q "^DATABASE_URL=postgresql://" .env; then
        echo "✓ DATABASE_URL 配置正确"
    else
        echo "✗ DATABASE_URL 配置缺失或格式错误"
    fi
else
    echo "✗ .env 文件不存在"
fi
echo ""

echo "3. 检查数据库连接:"
echo "尝试连接到 192.168.31.60:54321..."
# 使用 nc 检查端口是否可达(nc 可能不可用,所以用 ping 作为 fallback)
if command -v nc > /dev/null; then
    nc -zv 192.168.31.60 54321 2>&1 || echo "✗ 端口不可达"
else
    ping -c 1 192.168.31.60 2>&1 > /dev/null && echo "主机可达(无法检查端口)" || echo "✗ 主机不可达"
fi
echo ""

echo "=== 验证步骤 ==="
echo "接下来请执行以下命令:"
echo ""
echo "1. 停止现有容器(如果运行中):"
echo "   docker-compose down"
echo ""
echo "2. 重新启动容器:"
echo "   docker-compose up -d"
echo ""
echo "3. 查看日志验证启动:"
echo "   docker-compose logs -f storing"
echo ""
echo "4. 测试 API 健康检查:"
echo "   curl http://localhost:1052/api/v1/health"
echo ""
echo "5. 测试前端:"
echo "   curl http://localhost:1050"
echo ""
echo "=== 预期结果 ==="
echo "- 日志应该显示: 管理员账号已存在/已创建"
echo "- 日志应该显示: API server running on http://localhost:1052"
echo "- 不应该出现 'injected env (0)' 或 'ECONNREFUSED' 错误"
echo ""
echo "如果仍然失败,请检查:"
echo "- 数据库服务是否在 192.168.31.60:54321 上运行"
echo "- 容器网络能否访问该 IP(防火墙/网络配置)"