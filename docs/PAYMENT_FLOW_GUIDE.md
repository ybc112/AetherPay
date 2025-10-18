# 🎯 AetherPay 完整支付流程指南

## 📋 目录
- [角色说明](#角色说明)
- [前置准备](#前置准备)
- [完整流程](#完整流程)
- [常见问题](#常见问题)

---

## 👥 角色说明

### 1️⃣ 商家（Merchant）
- **需要注册**：✅ 是
- **功能**：创建订单、接收付款、提现余额
- **页面**：`/dashboard`

### 2️⃣ 买家（Payer/User）
- **需要注册**：❌ 否（自动记录）
- **功能**：支付订单、查看历史、查看贡献
- **页面**：`/pay/{orderId}` → `/user`

---

## 🛠️ 前置准备

### 准备两个钱包

你需要**两个不同的钱包地址**来测试完整流程：

#### 方案 1：MetaMask 创建多个账户（推荐）
```
1. 打开 MetaMask
2. 点击右上角头像
3. 点击 "Create Account"
4. 创建 "Account 2"

结果：
- Account 1 (商家钱包): 0x1234...5678
- Account 2 (买家钱包): 0xabcd...ef01
```

#### 方案 2：使用不同浏览器
```
Chrome 浏览器 → 商家钱包
Edge/Firefox 浏览器 → 买家钱包
```

#### 方案 3：使用隐私模式
```
正常窗口 → 商家钱包
隐私窗口 (Ctrl+Shift+N) → 买家钱包
```

### 确保网络和测试币

1. **切换到 OP Sepolia 测试网**
   - 在 MetaMask 中选择 "OP Sepolia"
   - 如果没有，添加网络：https://chainlist.org/chain/11155420

2. **获取测试 ETH**（用于 Gas 费）
   - 访问：https://www.alchemy.com/faucets/optimism-sepolia
   - 或：https://app.optimism.io/faucet

3. **铸造测试 USDC**（用于支付）
   - 在商家后台 `/dashboard` 有 "Mint Test Tokens" 功能
   - 或直接调用合约的 `mint()` 函数

---

## 🔄 完整流程（5 步）

### 步骤 1：商家注册并创建订单 👨‍💼

**使用钱包**：Account 1（商家钱包）

#### 1.1 访问商家后台
```
浏览器打开: http://localhost:3000/dashboard
```

#### 1.2 连接商家钱包
```
1. 点击页面右上角 "Connect Wallet"
2. 选择 MetaMask
3. 选择 Account 1
4. 确认连接
```

#### 1.3 注册商家（首次使用）
```
1. 在页面上找到 "Register as Merchant" 按钮
2. 填写商家信息：
   - Merchant Name: "Test Store"
   - (其他信息可选)
3. 点击 "Register" 按钮
4. 在 MetaMask 中确认交易
5. 等待交易确认（约 5-10 秒）
6. 看到 "Registration Successful" 提示
```

#### 1.4 铸造测试 USDC（如果余额不足）
```
1. 在 Dashboard 找到 "Mint Test Tokens" 区域
2. 选择 USDC
3. 输入数量：1000
4. 点击 "Mint"
5. 在 MetaMask 中确认
6. 等待确认
```

#### 1.5 创建订单
```
1. 在 Dashboard 找到 "Create Order" 区域
2. 填写订单信息：
   - Order ID: ORDER_TEST_001
   - Amount: 10
   - Payment Token: USDC
   - Settlement Token: USDT
   - Allow Partial Payment: 否
3. 点击 "Create Order"
4. 在 MetaMask 中确认交易
5. 等待确认
6. 看到订单创建成功提示
```

#### 1.6 复制支付链接
```
订单创建成功后，会显示支付链接：
http://localhost:3000/pay/ORDER_TEST_001

📋 复制这个链接！
```

---

### 步骤 2：分享支付链接 📤

**操作**：将支付链接发送给买家

实际场景中的方式：
- 📧 通过邮件发送
- 💬 通过微信/WhatsApp 发送
- 📱 生成二维码让买家扫描
- 🌐 嵌入到网站/商城

测试场景中：
- 直接复制链接到另一个浏览器
- 或在同一浏览器切换钱包账户

---

### 步骤 3：买家打开支付链接 👤

**使用钱包**：Account 2（买家钱包）

#### 3.1 切换到买家钱包

**方案 A：同一浏览器切换账户**
```
1. 打开 MetaMask
2. 点击右上角头像
3. 选择 "Account 2"
```

**方案 B：使用不同浏览器**
```
1. 打开 Edge/Firefox 浏览器
2. 安装 MetaMask 扩展
3. 导入买家钱包
```

**方案 C：使用隐私窗口**
```
1. 按 Ctrl+Shift+N 打开隐私窗口
2. 访问 MetaMask 网站并连接
```

#### 3.2 访问支付链接
```
在浏览器中打开:
http://localhost:3000/pay/ORDER_TEST_001
```

#### 3.3 查看订单详情
```
页面会显示：
- 商家名称: Test Store
- 订单金额: 10 USDC
- 订单状态: Pending
- 支付按钮
```

---

### 步骤 4：买家完成支付 💳

**使用钱包**：Account 2（买家钱包）

#### 4.1 连接买家钱包
```
1. 点击页面上的 "Connect Wallet"
2. 选择 MetaMask
3. 确认连接 Account 2
4. 确保网络是 OP Sepolia
```

#### 4.2 铸造测试 USDC（如果余额不足）
```
如果买家钱包没有 USDC：
1. 访问 http://localhost:3000/dashboard
2. 找到 "Mint Test Tokens"
3. 铸造 100 USDC
4. 返回支付页面
```

#### 4.3 授权代币（Approve）
```
1. 在支付页面点击 "Approve USDC" 按钮
2. MetaMask 会弹出授权请求
3. 确认授权金额（通常是无限授权）
4. 点击 "Confirm"
5. 等待交易确认（约 5-10 秒）
6. 看到 "✓ Sufficient Allowance" 提示
```

#### 4.4 执行支付（Pay）
```
1. 点击 "Pay Now" 按钮
2. MetaMask 会弹出支付请求
3. 检查交易详情：
   - To: PaymentGatewayV2 合约地址
   - Amount: 10 USDC
   - Gas Fee: ~0.0001 ETH
4. 点击 "Confirm"
5. 等待交易确认（约 5-10 秒）
```

#### 4.5 支付成功
```
页面会显示：
✅ 支付成功！
💝 您已为以太坊公共物品贡献 $0.005
🎉 感谢您的支持！

5 秒后自动跳转...
```

---

### 步骤 5：查看用户贡献页面 🎉

**自动跳转**：支付成功后自动跳转到 `/user`

#### 5.1 用户页面内容
```
页面会显示：
- 💳 总支付: $10.00
- 💝 总捐赠: $0.005
- 📊 平均捐赠率: 0.05%
- 🏆 贡献排名
- 🎖️ 徽章等级
```

#### 5.2 查看支付历史
```
1. 点击 "查看全部 →" 或访问 /user/history
2. 看到支付记录：
   - 订单号: ORDER_TEST_001
   - 商家: Test Store
   - 金额: $10.00
   - 捐赠: $0.005
   - 状态: ✓ 已完成
   - 交易哈希: 0x123...
```

---

## 🎬 快速测试脚本

### 完整测试流程（复制粘贴执行）

```bash
# ========================================
# 第 1 步：商家操作（Account 1）
# ========================================

# 1. 打开商家后台
浏览器访问: http://localhost:3000/dashboard

# 2. 连接钱包 → 选择 Account 1

# 3. 注册商家（首次）
点击 "Register as Merchant"
输入: Test Store
点击 "Register" → 确认交易

# 4. 铸造 USDC（如果需要）
点击 "Mint Test Tokens"
选择 USDC → 输入 1000 → 确认

# 5. 创建订单
点击 "Create Order"
填写:
  Order ID: ORDER_TEST_001
  Amount: 10
  Payment Token: USDC
  Settlement Token: USDT
点击 "Create Order" → 确认交易

# 6. 复制支付链接
复制: http://localhost:3000/pay/ORDER_TEST_001

# ========================================
# 第 2 步：买家操作（Account 2）
# ========================================

# 1. 切换钱包
MetaMask → 切换到 Account 2
（或打开新浏览器/隐私窗口）

# 2. 访问支付链接
浏览器访问: http://localhost:3000/pay/ORDER_TEST_001

# 3. 连接钱包 → 选择 Account 2

# 4. 铸造 USDC（如果需要）
访问: http://localhost:3000/dashboard
铸造 100 USDC

# 5. 返回支付页面并授权
点击 "Approve USDC" → 确认交易

# 6. 执行支付
点击 "Pay Now" → 确认交易

# 7. 查看结果
自动跳转到: http://localhost:3000/user
查看总捐赠和贡献
```

---

## ❓ 常见问题

### Q1: 为什么买家不需要注册？
**A**: 合约会在第一次支付时自动记录买家地址（`order.payer = msg.sender`），无需预先注册。

### Q2: 可以用同一个钱包既当商家又当买家吗？
**A**: 技术上可以，但不推荐。实际场景中商家和买家是不同的人。

### Q3: 如果买家没有 USDC 怎么办？
**A**: 
1. 访问 `/dashboard` 铸造测试 USDC
2. 或从水龙头获取
3. 或从其他地址转账

### Q4: 支付失败怎么办？
**A**: 检查：
- 买家钱包是否有足够的 USDC
- 是否已授权（Approve）
- 是否有足够的 ETH 支付 Gas
- 网络是否是 OP Sepolia

### Q5: 如何查看支付历史？
**A**: 
- 买家：访问 `/user/history`
- 商家：访问 `/dashboard` 查看订单列表

### Q6: 捐赠金额是如何计算的？
**A**: 
- 平台费的一部分（默认 5%）捐赠给公共物品
- 跨币种支付时，价差也会捐赠
- 例如：10 USDC 支付 → 约 $0.005 捐赠

---

## 🎯 核心要点总结

1. ✅ **商家需要注册** - 调用 `registerMerchant()`
2. ❌ **买家无需注册** - 支付时自动记录
3. 🔑 **需要两个钱包** - 商家和买家必须是不同地址
4. 💰 **需要测试币** - USDC（支付）+ ETH（Gas）
5. 🔄 **完整流程** - 注册 → 创建订单 → 分享链接 → 支付 → 查看贡献

---

## 📚 相关文档

- [合约架构](./ARCHITECTURE.md)
- [API 文档](./API.md)
- [部署指南](./DEPLOYMENT.md)

