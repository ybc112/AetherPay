#!/bin/bash

################################################################################
# .env 配置向导
#
# 这个脚本帮助您快速创建 oracle/.env 文件
################################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║    AetherOracle 配置向导                 ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 检查是否已存在 .env 文件
if [ -f "oracle/.env" ]; then
    echo -e "${YELLOW}⚠️  警告：oracle/.env 文件已存在${NC}"
    read -p "是否覆盖？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "已取消，退出配置向导。"
        exit 0
    fi
fi

echo ""
echo -e "${GREEN}让我们开始配置您的 Oracle 服务！${NC}"
echo ""

# 1. 私钥配置
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}步骤 1/5: 配置Oracle节点私钥${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "这是您的Oracle节点的钱包私钥（控制资金，请妥善保管）"
echo "从MetaMask获取：账户详情 -> 导出私钥"
echo ""
echo -e "${YELLOW}⚠️  注意：请使用测试网账户，不要用主网账户！${NC}"
echo ""
read -p "请输入您的私钥（0x开头）: " PRIVATE_KEY

# 验证私钥格式
if [[ ! $PRIVATE_KEY =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo -e "${RED}✗ 错误：私钥格式不正确${NC}"
    echo "  私钥应该是 66 个字符，以 0x 开头"
    exit 1
fi

echo -e "${GREEN}✓ 私钥格式正确${NC}"

# 2. RPC节点配置
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}步骤 2/5: 配置RPC节点${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "RPC节点用于连接区块链网络"
echo ""
echo "可用选项："
echo "  1) Optimism Sepolia (免费, 推荐)"
echo "  2) 自定义RPC节点"
echo ""
read -p "请选择 (1-2, 默认1): " rpc_choice
rpc_choice=${rpc_choice:-1}

case $rpc_choice in
    1)
        RPC_URL="https://sepolia.optimism.io"
        CHAIN_ID="11155420"
        NETWORK="optimism-sepolia"
        echo -e "${GREEN}✓ 使用 Optimism Sepolia 免费节点${NC}"
        ;;
    2)
        read -p "请输入自定义RPC URL: " RPC_URL
        read -p "请输入链ID: " CHAIN_ID
        read -p "请输入网络名称: " NETWORK
        echo -e "${GREEN}✓ 使用自定义RPC节点${NC}"
        ;;
    *)
        echo -e "${RED}✗ 无效选项，使用默认值${NC}"
        RPC_URL="https://sepolia.optimism.io"
        CHAIN_ID="11155420"
        NETWORK="optimism-sepolia"
        ;;
esac

# 3. 合约地址（可选）
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}步骤 3/5: 配置合约地址（可选）${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "如果您还没有部署合约，可以暂时留空，稍后运行部署脚本自动填充"
echo ""
read -p "Oracle合约地址（留空跳过）: " CONTRACT_ADDRESS

if [ -n "$CONTRACT_ADDRESS" ]; then
    if [[ ! $CONTRACT_ADDRESS =~ ^0x[0-9a-fA-F]{40}$ ]]; then
        echo -e "${YELLOW}⚠️  警告：合约地址格式可能不正确${NC}"
    else
        echo -e "${GREEN}✓ 合约地址已设置${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  合约地址留空，部署后需要手动填入${NC}"
fi

# 4. 服务端口
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}步骤 4/5: 配置服务端口${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -p "服务端口 (默认 3001): " PORT
PORT=${PORT:-3001}
echo -e "${GREEN}✓ 端口设置为 $PORT${NC}"

# 5. EigenDA配置
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}步骤 5/5: 配置EigenDA（V3版本）${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "是否启用EigenDA存储？"
echo "  - V2 版本: 不启用 (使用SQLite)"
echo "  - V3 版本: 启用 (使用EigenDA)"
echo ""
read -p "启用EigenDA? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    USE_EIGENDA="true"
    read -p "EigenDA Proxy URL (默认 http://localhost:4242): " EIGENDA_URL
    EIGENDA_PROXY_URL=${EIGENDA_URL:-http://localhost:4242}
    echo -e "${GREEN}✓ EigenDA 已启用${NC}"
else
    USE_EIGENDA="false"
    EIGENDA_PROXY_URL="http://localhost:4242"
    echo -e "${YELLOW}✓ EigenDA 未启用（使用SQLite）${NC}"
fi

# 生成 .env 文件
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}正在生成 .env 文件...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cat > oracle/.env << EOF
# ============================================
# AetherOracle 配置文件
# 自动生成于: $(date)
# ============================================

# 🔑 Oracle节点私钥
PRIVATE_KEY=$PRIVATE_KEY

# 🌐 区块链配置
ETHEREUM_RPC_URL=$RPC_URL
RPC_URL=$RPC_URL
CHAIN_ID=$CHAIN_ID
NETWORK=$NETWORK

# 📝 Oracle合约地址
CONTRACT_ADDRESS=$CONTRACT_ADDRESS
ORACLE_ADDRESS=$CONTRACT_ADDRESS

# 🚀 服务配置
PORT=$PORT
NODE_NAME=Oracle-$PORT
NODE_ENV=production
LOG_LEVEL=info

# 📦 EigenDA配置
USE_EIGENDA=$USE_EIGENDA
EIGENDA_PROXY_URL=$EIGENDA_PROXY_URL

# 💾 数据库
DATABASE_PATH=./aether_oracle.db

# 🔄 Redis（可选）
REDIS_URL=redis://localhost:6379

# 🔌 API密钥（可选）
COINGECKO_API_KEY=
BINANCE_API_KEY=
BINANCE_API_SECRET=
EOF

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ 配置完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 配置摘要：${NC}"
echo "  网络: $NETWORK (Chain ID: $CHAIN_ID)"
echo "  RPC: $RPC_URL"
echo "  端口: $PORT"
echo "  EigenDA: $USE_EIGENDA"
if [ -n "$CONTRACT_ADDRESS" ]; then
    echo "  合约: $CONTRACT_ADDRESS"
else
    echo "  合约: ⚠️  未设置（稍后部署）"
fi
echo ""
echo -e "${YELLOW}📝 重要提示：${NC}"
echo "  1. .env 文件已创建在: oracle/.env"
echo "  2. 请不要将此文件提交到 Git"
echo "  3. 保护好您的私钥"
if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "  4. 运行部署脚本后，记得填入合约地址"
fi
echo ""
echo -e "${GREEN}下一步：${NC}"
if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "  运行部署脚本: ./quick-deploy.sh"
else
    echo "  启动服务: npm start"
fi
echo ""
