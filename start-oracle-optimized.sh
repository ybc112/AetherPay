#!/bin/bash

################################################################################
# AetherOracle 快速启动脚本 (优化版)
#
# 此脚本确保所有必需的服务都在运行：
# - Redis (缓存服务)
# - Oracle Server (API服务)
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
╔════════════════════════════════════════════════════════════════════╗
║       █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗             ║
║      ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗            ║
║      ███████║█████╗     ██║   ███████║█████╗  ██████╔╝            ║
║      ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗            ║
║      ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║            ║
║      ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝            ║
║                                                                    ║
║                 Oracle 服务优化版快速启动                           ║
║                     (5分钟预测窗口)                                ║
╚════════════════════════════════════════════════════════════════════╝
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
log_info "开始启动 Oracle 优化服务..."
echo ""

# 1. 检查并启动 Redis
log "检查 Redis 服务..."
if ! pgrep -x "redis-server" > /dev/null 2>&1; then
    log_info "Redis 未运行，正在启动..."

    # 检查 Redis 是否已安装
    if ! command -v redis-server &> /dev/null; then
        log_error "Redis 未安装"
        log_info "请先安装 Redis:"
        echo "  Ubuntu/Debian: sudo apt-get install redis-server"
        echo "  CentOS/RHEL: sudo yum install redis"
        echo "  MacOS: brew install redis"
        exit 1
    fi

    # 启动 Redis
    redis-server --daemonize yes > /dev/null 2>&1
    sleep 2

    if pgrep -x "redis-server" > /dev/null 2>&1; then
        log_success "Redis 已启动"
    else
        log_error "Redis 启动失败"
        exit 1
    fi
else
    log_success "Redis 已在运行"
fi

# 测试 Redis 连接
if redis-cli ping > /dev/null 2>&1; then
    log_success "Redis 连接正常"
else
    log_error "Redis 连接失败"
    exit 1
fi

echo ""

# 2. 检查配置文件
log "检查配置文件..."
if [ ! -f "$SCRIPT_DIR/oracle/.env" ]; then
    log_error "oracle/.env 文件不存在"
    log_info "请先运行: ./setup-env.sh"
    exit 1
fi

source "$SCRIPT_DIR/oracle/.env"

# 验证关键配置
if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
    log_error "PRIVATE_KEY 未配置"
    log_info "请编辑 oracle/.env 文件设置您的私钥"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    log_error "RPC_URL 未配置"
    exit 1
fi

log_success "配置文件检查通过"
echo ""

# 3. 安装依赖
log "检查 Node.js 依赖..."
cd "$SCRIPT_DIR/oracle"

if [ ! -d "node_modules" ]; then
    log_info "安装 Node.js 依赖..."
    npm install
fi

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    log_info "安装 PM2 进程管理器..."
    npm install -g pm2
fi

log_success "依赖检查完成"
echo ""

# 4. 检查 Python 环境
log "检查 Python 环境..."
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    log_error "Python 未安装"
    exit 1
fi

log_info "使用 Python: $PYTHON_CMD"

# 检查 Python 依赖
log "检查 Python 依赖..."
MISSING_PACKAGES=""

# 检查必需的包
for package in numpy redis requests; do
    if ! $PYTHON_CMD -c "import $package" 2>/dev/null; then
        MISSING_PACKAGES="$MISSING_PACKAGES $package"
    fi
done

if [ -n "$MISSING_PACKAGES" ]; then
    log_info "安装缺失的 Python 包:$MISSING_PACKAGES"
    $PYTHON_CMD -m pip install $MISSING_PACKAGES
fi

log_success "Python 环境就绪"
echo ""

# 5. 测试优化版预测器
log "测试优化版预测器..."
cd "$SCRIPT_DIR/models"

if [ -f "aetherpay_predictor_optimized.py" ]; then
    log_info "运行预测器测试..."
    TEST_RESULT=$($PYTHON_CMD aetherpay_predictor_optimized.py "BTC/USDT" 1000 0.85 2>&1)

    if echo "$TEST_RESULT" | grep -q "predicted_price"; then
        log_success "预测器测试成功"
        echo -e "${BLUE}测试结果:${NC}"
        echo "$TEST_RESULT" | head -5
    else
        log_error "预测器测试失败"
        echo "$TEST_RESULT"
    fi
else
    log_error "优化版预测器文件不存在"
    log_info "请确保 models/aetherpay_predictor_optimized.py 存在"
fi

echo ""

# 6. 启动/重启 Oracle 服务
log "管理 Oracle 服务..."

# 检查服务是否已在运行
if pm2 describe aether-oracle > /dev/null 2>&1; then
    log_info "Oracle 服务已在运行，正在重启以加载新配置..."
    pm2 restart aether-oracle
else
    log_info "启动 Oracle 服务..."
    cd "$SCRIPT_DIR/oracle"
    pm2 start server.js --name aether-oracle
fi

# 保存 PM2 配置
pm2 save > /dev/null 2>&1

log_success "Oracle 服务已启动"
echo ""

# 7. 等待服务就绪
log_info "等待服务启动..."
PORT=${PORT:-3001}
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
        log_success "Oracle 服务健康检查通过"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
    echo -n "."
done

echo ""
echo ""

if [ $attempt -eq $max_attempts ]; then
    log_error "服务启动超时"
    log_info "查看日志: pm2 logs aether-oracle"
    exit 1
fi

# 8. 测试 API 端点
log "测试 API 端点..."

# 测试健康检查
log_info "测试健康检查端点..."
HEALTH_CHECK=$(curl -s http://localhost:$PORT/health 2>/dev/null | head -c 100)
if [ -n "$HEALTH_CHECK" ]; then
    log_success "健康检查: OK"
fi

# 测试实时价格
log_info "测试实时价格端点..."
REALTIME_TEST=$(curl -s "http://localhost:$PORT/realtime/BTC%2FUSDT" 2>/dev/null | head -c 100)
if echo "$REALTIME_TEST" | grep -q "price\|BTC"; then
    log_success "实时价格: OK"
fi

# 测试AI预测（优化版）
log_info "测试AI预测端点 (5分钟窗口)..."
PREDICTION_TEST=$(curl -s "http://localhost:$PORT/predict/BTC%2FUSDT?amount=1000" 2>/dev/null | head -c 200)
if echo "$PREDICTION_TEST" | grep -q "predicted_price\|confidence"; then
    log_success "AI预测: OK (5分钟预测窗口)"
fi

# 测试结算路径
log_info "测试结算路径端点..."
SETTLEMENT_TEST=$(curl -s "http://localhost:$PORT/settlement-path/BTC%2FUSDT?amount=1000" 2>/dev/null | head -c 100)
if echo "$SETTLEMENT_TEST" | grep -q "name\|protocol"; then
    log_success "结算路径: OK"
fi

echo ""
echo ""

# 9. 显示成功信息
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}           🎉 Oracle 优化服务启动成功！                          ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 服务状态${NC}"
echo "  ├─ Redis: ✅ 运行中 (端口 6379)"
echo "  ├─ Oracle: ✅ 运行中 (端口 $PORT)"
echo "  ├─ 预测窗口: 5分钟 (优化版)"
echo "  ├─ 缓存: 启用 (30秒TTL)"
echo "  └─ 刷新频率: 30秒"
echo ""
echo -e "${BLUE}🔗 API 端点${NC}"
echo "  ├─ 健康检查: http://localhost:$PORT/health"
echo "  ├─ 实时价格: http://localhost:$PORT/realtime/{pair}"
echo "  ├─ AI预测: http://localhost:$PORT/predict/{pair}"
echo "  └─ 结算路径: http://localhost:$PORT/settlement-path/{pair}"
echo ""
echo -e "${BLUE}📊 管理命令${NC}"
echo "  ├─ 查看日志: pm2 logs aether-oracle"
echo "  ├─ 查看状态: pm2 status"
echo "  ├─ 重启服务: pm2 restart aether-oracle"
echo "  ├─ 停止服务: pm2 stop aether-oracle"
echo "  └─ 监控面板: pm2 monit"
echo ""
echo -e "${BLUE}🧪 测试命令${NC}"
echo "  测试预测器:"
echo "  curl http://localhost:$PORT/predict/BTC%2FUSDT?amount=10000"
echo ""
echo -e "${YELLOW}⚠️  优化说明${NC}"
echo "  1. 预测窗口已优化为5分钟（更合理）"
echo "  2. 前端刷新频率降低至30秒（减少负载）"
echo "  3. Redis缓存已启用（30秒TTL）"
echo "  4. 支持多DEX价格聚合"
echo "  5. 智能结算路径选择"
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# 显示实时日志
log_info "显示服务日志（按 Ctrl+C 退出）..."
sleep 2
pm2 logs aether-oracle --lines 20