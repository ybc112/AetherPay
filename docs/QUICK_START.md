# ⚡ AetherPay 快速开始指南

> 5 分钟完成第一笔支付测试

---

## 🎯 核心概念

### 买家需要注册吗？
**❌ 不需要！** 

合约会在支付时自动记录买家地址：
```solidity
if (order.payer == address(0)) {
    order.payer = msg.sender;  // 自动记录
}
```

### 需要什么？
1. ✅ **两个钱包** - 商家 + 买家（必须不同）
2. ✅ **OP Sepolia 网络**
3. ✅ **测试 ETH** - 支付 Gas
4. ✅ **测试 USDC** - 支付订单

---

## 🚀 5 步完成测试

### 📱 步骤 1：准备两个钱包（1 分钟）

**在 MetaMask 中创建第二个账户：**
```
1. 打开 MetaMask
2. 点击右上角头像
3. 点击 "Create Account"
4. 创建 "Account 2"
```

**结果：**
- Account 1 → 商家钱包 🏪
- Account 2 → 买家钱包 👤

---

### 🏪 步骤 2：商家创建订单（2 分钟）

**使用 Account 1（商家钱包）**

```bash
# 1. 访问商家后台
http://localhost:3000/dashboard

# 2. 连接钱包（Account 1）
点击 "Connect Wallet"

# 3. 注册商家（首次）
点击 "Register as Merchant"
输入: "Test Store"
确认交易

# 4. 铸造测试 USDC
点击 "Mint Test Tokens"
选择 USDC → 输入 1000
确认交易

# 5. 创建订单
点击 "Create Order"
填写:
  - Order ID: ORDER_001
  - Amount: 10
  - Payment Token: USDC
  - Settlement Token: USDT
确认交易

# 6. 复制支付链接
http://localhost:3000/pay/ORDER_001
```

---

### 👤 步骤 3：买家支付订单（2 分钟）

**切换到 Account 2（买家钱包）**

```bash
# 1. 切换钱包
MetaMask → 选择 "Account 2"

# 2. 打开支付链接
http://localhost:3000/pay/ORDER_001

# 3. 连接钱包（Account 2）
点击 "Connect Wallet"

# 4. 铸造测试 USDC（如果需要）
访问 /dashboard → Mint 100 USDC

# 5. 授权代币
点击 "Approve USDC"
确认交易

# 6. 执行支付
点击 "Pay Now"
确认交易

# 7. 支付成功！
自动跳转到 /user 页面
```

---

### 🎉 步骤 4：查看结果

**自动跳转到用户页面：**
```
http://localhost:3000/user
```

**你会看到：**
- 💳 总支付: $10.00
- 💝 总捐赠: $0.005
- 📊 平均捐赠率: 0.05%
- 🏆 贡献排名
- 🎖️ 徽章等级

---

## 📊 关键代码解析

### 商家创建订单
```typescript
// frontend/app/dashboard/page.tsx
const { writeContract } = useWriteContract();

await writeContract({
  address: CONTRACTS.PAYMENT_GATEWAY_V2,
  abi: PAYMENT_GATEWAY_ABI,
  functionName: 'createOrder',
  args: [
    orderId,           // "ORDER_001"
    orderAmount,       // 10 USDC
    paymentToken,      // USDC 地址
    settlementToken,   // USDT 地址
    false              // allowPartialPayment
  ],
});
```

### 买家支付订单（无需注册）
```typescript
// frontend/app/pay/[orderId]/page.tsx
const { writeContract } = useWriteContract();

// 1. 授权
await writeContract({
  address: CONTRACTS.MOCK_USDC,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [CONTRACTS.PAYMENT_GATEWAY_V2, amount],
});

// 2. 支付（自动记录 payer）
await writeContract({
  address: CONTRACTS.PAYMENT_GATEWAY_V2,
  abi: PAYMENT_GATEWAY_ABI,
  functionName: 'processPayment',
  args: [orderIdBytes32, amount],
});
```

### 合约自动记录买家
```solidity
// contracts/PaymentGatewayV2.sol
function processPayment(bytes32 orderId, uint256 paymentAmount) external {
    Order storage order = orders[orderId];
    
    // 转账代币
    IERC20(order.paymentToken).safeTransferFrom(
        msg.sender,
        address(this),
        paymentAmount
    );
    
    // 🎯 自动记录买家地址（无需预先注册）
    if (order.payer == address(0)) {
        order.payer = msg.sender;  // ✅ 第一次支付时自动设置
    } else {
        require(order.payer == msg.sender, "Only original payer");
    }
    
    // 更新支付金额
    order.paidAmount += paymentAmount;
    
    // 执行支付处理
    if (order.paidAmount >= order.orderAmount) {
        _executePayment(orderId);
    }
}
```

---

## 🔍 常见问题速查

### Q: 为什么需要两个钱包？
**A**: 商家和买家必须是不同地址，模拟真实场景。

### Q: 买家需要注册吗？
**A**: ❌ 不需要！合约会在支付时自动记录 `order.payer = msg.sender`

### Q: 如何获取测试币？
**A**: 
- **ETH**: https://www.alchemy.com/faucets/optimism-sepolia
- **USDC**: 在 `/dashboard` 点击 "Mint Test Tokens"

### Q: 支付失败怎么办？
**A**: 检查：
1. 是否切换到 Account 2（买家钱包）
2. 是否有足够的 USDC
3. 是否已授权（Approve）
4. 是否有 ETH 支付 Gas

### Q: 如何查看支付历史？
**A**: 访问 `/user/history` 查看所有支付记录

---

## 🎬 完整测试脚本

### 一键复制执行

```bash
# ========================================
# 商家操作（Account 1）
# ========================================
1. 打开 http://localhost:3000/dashboard
2. 连接 Account 1
3. Register as Merchant → "Test Store"
4. Mint 1000 USDC
5. Create Order:
   - ID: ORDER_001
   - Amount: 10 USDC
6. 复制支付链接

# ========================================
# 买家操作（Account 2）
# ========================================
1. MetaMask 切换到 Account 2
2. 打开 http://localhost:3000/pay/ORDER_001
3. 连接 Account 2
4. Mint 100 USDC（如果需要）
5. Approve USDC
6. Pay Now
7. 查看 /user 页面

# ========================================
# 验证结果
# ========================================
✅ 总支付: $10.00
✅ 总捐赠: $0.005
✅ 支付历史中有 ORDER_001
✅ 交易哈希可在 Etherscan 查看
```

---

## 📚 下一步

- 📖 [完整流程指南](./PAYMENT_FLOW_GUIDE.md) - 详细的步骤说明
- 🏗️ [架构文档](./ARCHITECTURE.md) - 系统架构设计
- 🔧 [API 文档](./API.md) - 合约接口说明
- 🚀 [部署指南](./DEPLOYMENT.md) - 部署到测试网/主网

---

## 💡 核心要点

1. ✅ **商家需要注册** - `registerMerchant()`
2. ❌ **买家无需注册** - 支付时自动记录
3. 🔑 **两个不同钱包** - 商家 ≠ 买家
4. 💰 **需要测试币** - ETH (Gas) + USDC (支付)
5. 🎯 **5 分钟完成** - 从创建到支付

---

**🎉 现在开始你的第一笔支付测试吧！**

