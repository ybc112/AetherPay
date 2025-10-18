#!/bin/bash

# AetherPay 支付问题一键诊断和修复脚本

echo "🔍 AetherPay 支付问题诊断工具"
echo "================================"
echo ""

# 检查参数
if [ -z "$1" ]; then
    echo "❌ 错误: 缺少订单ID"
    echo ""
    echo "用法: ./diagnose-and-fix.sh <订单ID> [买家地址]"
    echo ""
    echo "示例:"
    echo "  ./diagnose-and-fix.sh ORDER_TEST_001"
    echo "  ./diagnose-and-fix.sh ORDER_TEST_001 0x1234567890123456789012345678901234567890"
    echo ""
    exit 1
fi

ORDER_ID=$1
BUYER_ADDRESS=$2

echo "📋 配置信息:"
echo "  - 订单ID: $ORDER_ID"
if [ -n "$BUYER_ADDRESS" ]; then
    echo "  - 买家地址: $BUYER_ADDRESS"
else
    echo "  - 买家地址: 未提供（仅查询订单状态）"
fi
echo ""

# 运行诊断脚本
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 开始诊断..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$BUYER_ADDRESS" ]; then
    node scripts/diagnose-payment-complete.js "$ORDER_ID" "$BUYER_ADDRESS"
else
    node scripts/diagnose-payment-complete.js "$ORDER_ID"
fi

EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 诊断完成"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 诊断成功完成"
    echo ""
    echo "💡 下一步操作:"
    echo "  1. 查看上方的诊断结果"
    echo "  2. 根据提示修复问题（授权/余额/订单）"
    echo "  3. 前往支付页面测试: http://localhost:3000/pay/$ORDER_ID"
    echo ""
else
    echo "❌ 诊断失败（退出码: $EXIT_CODE）"
    echo ""
    echo "💡 可能的原因:"
    echo "  - RPC 连接失败"
    echo "  - 订单ID 不存在"
    echo "  - 网关合约地址错误"
    echo ""
    echo "📞 需要帮助? 查看 PAYMENT_ISSUE_FIX.md"
    echo ""
fi

exit $EXIT_CODE
