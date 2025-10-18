#!/bin/bash

# 📋 PaymentGatewayV2 部署和配置自动化脚本
# 用法：./deploy-and-update.sh

set -e  # 遇到错误立即退出

echo "================================================="
echo "🚀 AetherPay V2 Deployment & Update Script"
echo "================================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤 1: 编译合约
echo -e "${YELLOW}📦 Step 1: Compiling PaymentGatewayV2...${NC}"
npx hardhat compile
echo -e "${GREEN}✅ Compilation complete${NC}"
echo ""

# 步骤 2: 部署合约
echo -e "${YELLOW}🚀 Step 2: Deploying to OP Sepolia...${NC}"
echo "⚠️  Make sure you have enough ETH in your wallet!"
read -p "Press Enter to continue or Ctrl+C to cancel..."

npx hardhat run scripts/deploy-gateway-v2.js --network opSepolia

echo -e "${GREEN}✅ Deployment complete${NC}"
echo ""

# 步骤 3: 读取部署地址
if [ ! -f "deployment-gateway-v2.json" ]; then
    echo -e "${RED}❌ Error: deployment-gateway-v2.json not found${NC}"
    exit 1
fi

GATEWAY_V2_ADDRESS=$(cat deployment-gateway-v2.json | grep -o '"PaymentGatewayV2": "[^"]*' | cut -d'"' -f4)

if [ -z "$GATEWAY_V2_ADDRESS" ]; then
    echo -e "${RED}❌ Error: Could not extract contract address${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract deployed at: $GATEWAY_V2_ADDRESS${NC}"
echo ""

# 步骤 4: 更新前端配置
echo -e "${YELLOW}📝 Step 3: Updating frontend configuration...${NC}"

# 备份原文件
cp frontend/lib/contracts.ts frontend/lib/contracts.ts.backup
echo "💾 Backup created: contracts.ts.backup"

# 更新合约地址
sed -i "s/PAYMENT_GATEWAY_V2: 'PENDING_DEPLOYMENT'/PAYMENT_GATEWAY_V2: '$GATEWAY_V2_ADDRESS'/g" frontend/lib/contracts-v2.ts
sed -i "s/PAYMENT_GATEWAY: '0x[^']*'/PAYMENT_GATEWAY_V2: '$GATEWAY_V2_ADDRESS'/g" frontend/lib/contracts.ts

echo -e "${GREEN}✅ Frontend configuration updated${NC}"
echo ""

# 步骤 5: 验证合约（可选）
echo -e "${YELLOW}🔍 Step 4: Verify contract on Etherscan? (y/n)${NC}"
read -p "> " VERIFY

if [ "$VERIFY" = "y" ] || [ "$VERIFY" = "Y" ]; then
    FX_ROUTER="0xC2ab12Baf3735864528F890B809Ffe2f1cf2f8d1"
    TREASURY=$(cat deployment-gateway-v2.json | grep -o '"Treasury": "[^"]*' | cut -d'"' -f4)
    DONATION=$(cat deployment-gateway-v2.json | grep -o '"DonationAddress": "[^"]*' | cut -d'"' -f4)

    echo "Verifying contract..."
    npx hardhat verify --network opSepolia $GATEWAY_V2_ADDRESS "$FX_ROUTER" "$TREASURY" "$DONATION"

    echo -e "${GREEN}✅ Contract verified${NC}"
fi

echo ""
echo "================================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================================="
echo ""
echo "📋 Summary:"
echo "   Contract Address: $GATEWAY_V2_ADDRESS"
echo "   Network: Optimism Sepolia"
echo "   Explorer: https://sepolia-optimism.etherscan.io/address/$GATEWAY_V2_ADDRESS"
echo ""
echo "📝 Next Steps:"
echo "   1. Copy frontend/lib/contracts-v2.ts to replace frontend/lib/contracts.ts"
echo "   2. Restart frontend dev server: cd frontend && npm run dev"
echo "   3. Test order management at /dashboard/orders"
echo ""
echo "🔧 Rollback (if needed):"
echo "   cp frontend/lib/contracts.ts.backup frontend/lib/contracts.ts"
echo ""
