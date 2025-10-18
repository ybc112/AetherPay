#!/bin/bash

################################################################################
# AetherOracle V2 简化部署脚本
#
# 此脚本专为 V2 版本设计，不需要 EigenDA
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Banner
echo -e "${PURPLE}"
cat << "EOF"
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║     █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗          ║
    ║    ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗         ║
    ║    ███████║█████╗     ██║   ███████║█████╗  ██████╔╝         ║
    ║    ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗         ║
    ║    ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║         ║
    ║    ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝         ║
    ║                                                               ║
    ║                  Oracle V2 快速部署                           ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ✗${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓${NC} $1"
}

log_info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] ℹ${NC} $1"
}

echo ""
log_info "开始 Oracle V2 部署流程..."
echo ""

# 1. 检查配置文件
log "检查配置文件..."
if [ ! -f "oracle/.env" ]; then
    log_error "oracle/.env 文件不存在"
    log_info "请先运行: ./setup-env.sh 或复制 oracle/.env.template"
    exit 1
fi

source oracle/.env

# 验证关键配置
if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
    log_error "PRIVATE_KEY 未配置"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    log_error "RPC_URL 未配置"
    exit 1
fi

log_success "配置文件检查通过"
echo ""

# 2. 检查 Oracle 服务是否已在运行
log "检查现有服务..."
if pm2 describe aether-oracle > /dev/null 2>&1; then
    log_info "检测到已运行的 Oracle 服务"
    read -p "是否重启服务？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 restart aether-oracle
        log_success "服务已重启"
    fi

    log_info "查看服务状态:"
    pm2 status aether-oracle

    echo ""
    log_success "部署检查完成！"
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo "  pm2 logs aether-oracle    # 查看日志"
    echo "  pm2 restart aether-oracle # 重启服务"
    echo "  pm2 stop aether-oracle    # 停止服务"
    exit 0
fi

# 3. 启动 Oracle 服务
log "启动 Oracle V2 服务..."

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    log_info "安装 PM2..."
    npm install -g pm2
fi

# 启动服务
cd "$SCRIPT_DIR/oracle"
pm2 start server.js --name aether-oracle

log_success "Oracle 服务已启动"
echo ""

# 4. 等待服务就绪
log_info "等待服务启动..."
sleep 5

# 5. 健康检查
log "执行健康检查..."

max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:${PORT:-3001}/health > /dev/null 2>&1; then
        log_success "Oracle 服务健康检查通过"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
    echo -n "."
done

if [ $attempt -eq $max_attempts ]; then
    log_error "服务启动超时"
    log_info "查看日志: pm2 logs aether-oracle"
    exit 1
fi

echo ""
echo ""

# 6. 显示部署信息
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}               🎉 Oracle V2 部署成功！                          ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 部署信息${NC}"
echo "  ├─ 网络: ${NETWORK:-optimism-sepolia}"
echo "  ├─ 合约: ${CONTRACT_ADDRESS:-未设置}"
echo "  ├─ RPC: ${RPC_URL}"
echo "  ├─ 端口: ${PORT:-3001}"
echo "  └─ 版本: V2 (SQLite存储)"
echo ""
echo -e "${BLUE}🔗 服务地址${NC}"
echo "  └─ Oracle Service: http://localhost:${PORT:-3001}"
echo ""
echo -e "${BLUE}📊 管理命令${NC}"
echo "  ├─ 查看日志: pm2 logs aether-oracle"
echo "  ├─ 查看状态: pm2 status"
echo "  ├─ 重启服务: pm2 restart aether-oracle"
echo "  ├─ 停止服务: pm2 stop aether-oracle"
echo "  └─ 保存配置: pm2 save"
echo ""
echo -e "${BLUE}🔍 测试服务${NC}"
echo "  curl http://localhost:${PORT:-3001}/health"
echo ""
echo -e "${YELLOW}⚠️  注意事项${NC}"
echo "  1. 确保合约已部署（如果 CONTRACT_ADDRESS 未设置）"
echo "  2. 确保账户有足够的测试 ETH"
echo "  3. 定期备份 oracle/aether_oracle.db 数据库"
echo ""
echo -e "${BLUE}📖 升级到 V3 (EigenDA)${NC}"
echo "  如果想升级到 V3 版本使用 EigenDA 存储:"
echo "  ./migrate-to-eigenda.sh"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# 显示实时日志
log_info "显示服务日志（按 Ctrl+C 退出）..."
sleep 2
pm2 logs aether-oracle --lines 20
