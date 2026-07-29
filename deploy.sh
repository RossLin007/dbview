#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    🚀 DBView 一键 Docker 部署 & 发布脚本          ${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. 校验环境依赖
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Docker 运行环境，请先安装 Docker。${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ 错误: Docker Daemon 未启动，请先启动 Docker 服务。${NC}"
    exit 1
fi

# 2. 校验 .env 配置文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️ 警告: 根目录未找到 .env 文件，正在从 .env.example 复制...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}请记得配置 .env 中的 SUPABASE 与 DATABASE 凭证。${NC}"
fi

# 3. 清理旧残留容器并编译启动
echo -e "${BLUE}🧹 正在停止并清理残留的旧容器...${NC}"
docker compose down --remove-orphans || true

echo -e "${BLUE}📦 [1/3] 开始构建 Docker 镜像...${NC}"
docker compose build

echo -e "${BLUE}🔄 [2/3] 启动 Docker 容器服务...${NC}"
docker compose up -d

# 4. 健康检查与状态确认
echo -e "${BLUE}⏳ [3/3] 等待服务健康检查探针生效...${NC}"
sleep 5

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 DBView 部署完成！容器运行状态如下：            ${NC}"
echo -e "${GREEN}====================================================${NC}"
docker compose ps

# 从 .env 读取已配置端口，无配时提供默认值
F_PORT=$(grep -E '^FRONTEND_PORT=' .env | cut -d '=' -f2 || echo "7880")
B_PORT=$(grep -E '^BACKEND_PORT=' .env | cut -d '=' -f2 || echo "3301")

echo -e ""
echo -e "${GREEN}🌐 前端网页访问入口: http://localhost:${F_PORT}${NC}"
echo -e "${GREEN}🔌 后端 API 探针地址: http://localhost:${B_PORT}/api/health${NC}"
echo -e ""
echo -e "${YELLOW}💡 提示指令:${NC}"
echo -e "  - 查看实时日志: ${BLUE}docker compose logs -f${NC}"
echo -e "  - 停止容器服务: ${BLUE}docker compose down${NC}"
echo -e "  - 重建启动服务: ${BLUE}./deploy.sh${NC}"
