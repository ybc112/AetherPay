#!/bin/bash

###############################################
# AetherPay EigenDA 集成 - 一键部署脚本
###############################################

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🚀 AetherPay EigenDA 集成部署"
echo "=========================================="
echo ""

# 检查依赖
echo "1️⃣  检查依赖..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker 未安装"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose 未安装"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "❌ Node.js/npx 未安装"; exit 1; }
echo "   ✅ 依赖检查通过"
echo ""

# 启动 EigenDA Proxy
echo "2️⃣  启动 EigenDA Proxy..."
docker-compose -f docker-compose-eigenda.yml up -d eigenda-proxy
echo "   ⏳ 等待 EigenDA Proxy 启动 (30秒)..."
sleep 30

# 检查 EigenDA 健康状态
echo "   🔍 检查 EigenDA Proxy 健康状态..."
HEALTH_STATUS=$(curl -s http://localhost:4242/health || echo "unhealthy")
if [[ $HEALTH_STATUS == *"healthy"* ]] || [[ $HEALTH_STATUS == *"ok"* ]]; then
  echo "   ✅ EigenDA Proxy 运行正常"
else
  echo "   ⚠️  EigenDA Proxy 可能还在启动中，继续部署..."
fi
echo ""

# 安装 npm 依赖
echo "3️⃣  安装 npm 依赖..."
npm install axios ethers@^5.7.0
echo "   ✅ 依赖安装完成"
echo ""

# 编译智能合约
echo "4️⃣  编译智能合约..."
npx hardhat compile
echo "   ✅ 合约编译完成"
echo ""

# 部署 AetherOracleV3_EigenDA 合约
echo "5️⃣  部署 AetherOracleV3_EigenDA 合约..."

# 检查是否有 .env 文件
if [ ! -f .env ]; then
  echo "   ⚠️  未找到 .env 文件，创建示例配置..."
  cat > .env << EOF
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000001
RPC_URL=https://sepolia.optimism.io
ORACLE_ADDRESS=
EOF
  echo "   ❌ 请编辑 .env 文件，填入正确的 PRIVATE_KEY 和 RPC_URL"
  exit 1
fi

# 部署合约
DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy-oracle-v3-eigenda.js --network op-sepolia 2>&1)
echo "$DEPLOY_OUTPUT"

# 提取合约地址
ORACLE_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "AetherOracleV3_EigenDA deployed to:" | awk '{print $NF}')

if [ -z "$ORACLE_ADDRESS" ]; then
  echo "   ❌ 合约部署失败或无法提取地址"
  exit 1
fi

echo "   ✅ 合约部署成功: $ORACLE_ADDRESS"

# 更新 .env 文件
sed -i.bak "s|ORACLE_ADDRESS=.*|ORACLE_ADDRESS=$ORACLE_ADDRESS|" .env
echo "   ✅ 已更新 .env 文件"
echo ""

# 注册 Oracle 节点
echo "6️⃣  注册 Oracle 节点..."
ORACLE_WALLET=$(npx hardhat run scripts/get-wallet-address.js 2>&1 | tail -n 1)
echo "   Oracle 钱包地址: $ORACLE_WALLET"

npx hardhat run scripts/register-oracle-node.js --network op-sepolia
echo "   ✅ Oracle 节点注册完成"
echo ""

# 启动 Oracle 服务
echo "7️⃣  启动 Oracle 服务..."
docker-compose -f docker-compose-eigenda.yml up -d oracle-eigenda
echo "   ✅ Oracle 服务已启动"
echo ""

# 等待服务启动
echo "8️⃣  等待服务完全启动..."
sleep 10

# 健康检查
echo "9️⃣  健康检查..."
ORACLE_HEALTH=$(curl -s http://localhost:3001/health || echo "{}")
echo "$ORACLE_HEALTH" | python3 -m json.tool
echo ""

# 测试 EigenDA 存储
echo "🔟  测试 EigenDA 存储..."
TEST_RESULT=$(curl -s -X POST http://localhost:3001/submit-rate-eigenda \
  -H "Content-Type: application/json" \
  -d '{"pair": "BTC/USDT", "amount": 1000, "confidenceThreshold": 0.95}' || echo "{}")

echo "$TEST_RESULT" | python3 -m json.tool
echo ""

# 启动监控服务
echo "1️⃣1️⃣  启动监控服务..."
docker-compose -f docker-compose-eigenda.yml up -d prometheus grafana
echo "   ✅ Prometheus 运行在 http://localhost:9090"
echo "   ✅ Grafana 运行在 http://localhost:3000"
echo "      (用户名: admin, 密码: aetherpay123)"
echo ""

# 打印总结
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "📊 服务地址:"
echo "   EigenDA Proxy:  http://localhost:4242"
echo "   Oracle API:     http://localhost:3001"
echo "   Prometheus:     http://localhost:9090"
echo "   Grafana:        http://localhost:3000"
echo ""
echo "📝 合约地址:"
echo "   AetherOracleV3_EigenDA: $ORACLE_ADDRESS"
echo "   Oracle 节点: $ORACLE_WALLET"
echo ""
echo "🧪 测试命令:"
echo "   # 提交汇率到 EigenDA"
echo "   curl -X POST http://localhost:3001/submit-rate-eigenda \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"pair\": \"ETH/USDT\", \"amount\": 1000}'"
echo ""
echo "   # 检索 EigenDA 数据"
echo "   curl 'http://localhost:3001/retrieve-from-eigenda?blobId=0x123...'"
echo ""
echo "   # 查看最新汇率"
echo "   curl 'http://localhost:3001/latest-rate-eigenda?pair=BTC/USDT'"
echo ""
echo "📖 详细文档: README-EIGENDA.md"
echo ""
echo "=========================================="
