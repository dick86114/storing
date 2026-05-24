#!/bin/bash
# Docker 环境变量诊断脚本

echo "=== 诊断 Docker 环境变量问题 ==="
echo ""

echo "1. 检查当前目录:"
pwd
echo ""

echo "2. 检查 .env 文件是否存在:"
if [ -f .env ]; then
    echo "✓ .env 文件存在"
    echo ""
    echo "3. 检查 .env 中的 DATABASE_URL (隐藏敏感信息):"
    if grep -q "^DATABASE_URL=" .env; then
        DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
        # 只显示格式,隐藏密码
        echo "$DB_URL" | sed 's/:\/\/[^:]*:[^@]*@:\/\/[隐藏]:[隐藏]@/'
        echo ""
        echo "4. 检查 DATABASE_URL 格式:"
        if [[ "$DB_URL" =~ ^postgresql:// ]]; then
            echo "✓ 格式正确: postgresql://..."
            # 提取 hostname
            HOSTNAME=$(echo "$DB_URL" | sed -n 's/postgresql:\/\/[^:]*:[^@]*@\([^:]*\):.*/\1/p')
            echo "数据库主机名: $HOSTNAME"
        else
            echo "✗ 格式错误或不完整"
        fi
    else
        echo "✗ .env 文件中没有 DATABASE_URL 配置"
    fi
else
    echo "✗ .env 文件不存在于当前目录"
    echo ""
    echo "可能的 .env 文件位置:"
    find . -name ".env" -type f 2>/dev/null | grep -v node_modules | head -5
fi
echo ""

echo "5. 检查 docker-compose 能否读取环境变量:"
echo "运行: docker-compose config | grep DATABASE_URL"
docker-compose config 2>/dev/null | grep -A1 "DATABASE_URL" || echo "✗ docker-compose 无法读取配置"
echo ""

echo "6. 检查当前运行的容器:"
docker ps -a | grep storing || echo "没有找到 storing 容器"
echo ""

echo "=== 诊断完成 ==="
echo ""
echo "建议:"
echo "- 确保 .env 文件在 docker-compose.yml 同级目录"
echo "- 确保 .env 中 DATABASE_URL 格式正确: postgresql://user:password@host:port/database"
echo "- 如果使用远程数据库,确保 host 可从容器内部访问"