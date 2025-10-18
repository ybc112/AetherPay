# 🔍 支付合约代码分析

> 深入理解 PaymentGatewayV2 的支付流程

---

## 📋 目录
- [核心问题](#核心问题)
- [合约结构](#合约结构)
- [支付流程](#支付流程)
- [关键代码](#关键代码)
- [状态转换](#状态转换)

---

## ❓ 核心问题

### Q: 买家需要注册吗？
**A: ❌ 不需要！**

合约在 `processPayment` 函数中会自动记录买家地址：

```solidity
// 第一次支付时自动设置 payer
if (order.payer == address(0)) {
    order.payer = msg.sender;
}
```

### Q: 为什么商家需要注册？
**A: ✅ 需要存储商家信息**

商家需要注册是因为需要存储：
- 商家名称
- 费率设置
- 余额管理
- 订单索引

---

## 🏗️ 合约结构

### 数据结构

#### Order（订单）
```solidity
struct Order {
    address merchant;           // 商家地址
    address payer;             // 买家地址（支付时自动设置）
    uint256 orderAmount;       // 订单金额
    uint256 paidAmount;        // 已支付金额
    address paymentToken;      // 支付代币
    address settlementToken;   // 结算代币
    OrderStatus status;        // 订单状态
    uint256 createdAt;         // 创建时间
    uint256 paidAt;           // 支付时间
    bool allowPartialPayment; // 是否允许部分支付
    // ... 其他字段
}
```

#### Merchant（商家）
```solidity
struct Merchant {
    string name;                                    // 商家名称
    bool isActive;                                  // 是否激活
    uint256 feeRate;                               // 费率
    mapping(address => uint256) balances;          // 余额
    uint256 totalOrders;                           // 总订单数
    uint256 totalVolume;                           // 总交易量
    // ... 其他字段
}
```

---

## 🔄 支付流程详解

### 完整流程图

```
商家创建订单
    ↓
createOrder()
    ↓
订单状态: PENDING
    ↓
买家打开支付链接
    ↓
买家授权代币
    ↓
approve(USDC, 网关地址)
    ↓
买家执行支付
    ↓
processPayment(orderId, amount)
    ↓
【关键】自动记录买家地址
    ↓
if (order.payer == address(0)) {
    order.payer = msg.sender;  // ✅ 无需预先注册
}
    ↓
转账代币到合约
    ↓
IERC20.safeTransferFrom(msg.sender, address(this), amount)
    ↓
订单状态: PAID
    ↓
执行支付处理
    ↓
_executePayment(orderId)
    ↓
跨币种兑换（如果需要）
    ↓
FXRouter.swapExactTokensForTokens()
    ↓
计算费用和捐赠
    ↓
_calculateFees() + _processDonation()
    ↓
价差捐赠到公共物品
    ↓
_processSpreadDonation()
    ↓
更新商家余额
    ↓
merchants[merchant].balances[token] += amount
    ↓
订单状态: COMPLETED
    ↓
支付完成
```

---

## 💻 关键代码分析

### 1. processPayment - 核心支付函数

```solidity
/**
 * @notice 处理支付（支持部分支付）
 * @param orderId 订单ID
 * @param paymentAmount 支付金额
 */
function processPayment(
    bytes32 orderId,
    uint256 paymentAmount
) external nonReentrant whenNotPaused onlyPendingOrder(orderId) returns (bool) {
    Order storage order = orders[orderId];
    require(paymentAmount > 0, "Invalid payment amount");

    // 🔍 检查支付金额
    if (order.allowPartialPayment) {
        require(
            order.paidAmount + paymentAmount <= order.orderAmount,
            "Payment exceeds order amount"
        );
    } else {
        require(paymentAmount == order.orderAmount, "Must pay full amount");
    }

    // 💰 转账代币到合约
    IERC20(order.paymentToken).safeTransferFrom(
        msg.sender,
        address(this),
        paymentAmount
    );

    // 🎯 关键：自动设置或验证 payer
    if (order.payer == address(0)) {
        // ✅ 第一次支付：自动记录买家地址
        order.payer = msg.sender;
    } else {
        // ✅ 后续支付：验证是同一个买家
        require(order.payer == msg.sender, "Only original payer can add payment");
    }

    // 📊 累积支付金额
    order.paidAmount += paymentAmount;

    // ⏰ 记录支付时间（仅首次）
    if (order.paidAt == 0) {
        order.paidAt = block.timestamp;
    }

    // 📢 触发事件
    emit PaymentReceived(orderId, msg.sender, paymentAmount, order.paymentToken);

    // 🔄 检查是否支付完成
    if (order.paidAmount >= order.orderAmount) {
        // 更新状态索引
        _removeFromStatusIndex(order.merchant, orderId, OrderStatus.PENDING);
        order.status = OrderStatus.PAID;
        _addToStatusIndex(order.merchant, orderId, OrderStatus.PAID);

        // 执行支付处理
        _executePayment(orderId);
    }
    // 否则保持 PENDING 状态，等待后续支付

    return true;
}
```

### 2. _executePayment - 执行支付处理

```solidity
/**
 * @notice 执行支付处理（内部函数）
 * @param orderId 订单ID
 */
function _executePayment(bytes32 orderId) internal {
    Order storage order = orders[orderId];

    // 更新状态为 PROCESSING
    _removeFromStatusIndex(order.merchant, orderId, OrderStatus.PAID);
    order.status = OrderStatus.PROCESSING;
    _addToStatusIndex(order.merchant, orderId, OrderStatus.PROCESSING);

    uint256 amountAfterFees;
    uint256 totalFees;

    if (order.paymentToken == order.settlementToken) {
        // 🔹 同币种支付
        order.exchangeRate = 1e8;
        totalFees = _calculateFees(order.paidAmount, order.merchant);
        amountAfterFees = order.paidAmount - totalFees;
        order.receivedAmount = amountAfterFees;
    } else {
        // 🔸 跨币种支付 - 通过 FXRouter 兑换
        
        // 1. 授权 FXRouter
        IERC20(order.paymentToken).approve(address(fxRouter), order.paidAmount);

        // 2. 构建兑换参数
        FXRouter.SwapParams memory swapParams = FXRouter.SwapParams({
            tokenIn: order.paymentToken,
            tokenOut: order.settlementToken,
            amountIn: order.paidAmount,
            minAmountOut: 0,
            recipient: address(this),
            deadline: block.timestamp + 300,
            userData: ""
        });

        // 3. 执行兑换
        try fxRouter.swapExactTokensForTokens(swapParams) returns (uint256 swappedAmount) {
            // 兑换成功
            order.exchangeRate = (swappedAmount * 1e8) / order.paidAmount;
            totalFees = _calculateFees(swappedAmount, order.merchant);
            amountAfterFees = swappedAmount - totalFees;
            order.receivedAmount = amountAfterFees;

            // 🎁 价差捐赠到公共物品
            if (
                enableSpreadDonation &&
                address(publicGoodsFund) != address(0) &&
                address(aetherOracle) != address(0)
            ) {
                _processSpreadDonation(orderId, order);
            }
        } catch {
            // 兑换失败 - 回滚并退款
            _removeFromStatusIndex(order.merchant, orderId, OrderStatus.PROCESSING);
            order.status = OrderStatus.PAID;
            _addToStatusIndex(order.merchant, orderId, OrderStatus.PAID);

            IERC20(order.paymentToken).safeTransfer(order.payer, order.paidAmount);
            revert("Cross-currency swap failed");
        }
    }

    // 💰 分配费用
    order.platformFee = (totalFees * platformFeeRate) / (platformFeeRate + merchants[order.merchant].feeRate);
    order.merchantFee = totalFees - order.platformFee;

    // 💵 更新商家余额
    merchants[order.merchant].balances[order.settlementToken] += amountAfterFees;
    merchants[order.merchant].pendingBalance += amountAfterFees;
    merchants[order.merchant].totalOrders++;
    merchants[order.merchant].totalVolume += order.orderAmount;

    // 📊 更新全局统计
    totalOrdersCount++;
    totalVolumeUSD += order.orderAmount;

    // 🎁 处理平台费捐赠
    _processDonation(order.platformFee, order.settlementToken);

    // ✅ 更新状态为 COMPLETED
    _removeFromStatusIndex(order.merchant, orderId, OrderStatus.PROCESSING);
    order.status = OrderStatus.COMPLETED;
    _addToStatusIndex(order.merchant, orderId, OrderStatus.COMPLETED);

    emit OrderCompleted(orderId, order.merchant, amountAfterFees, order.platformFee);
}
```

---

## 🔄 订单状态转换

### 状态枚举
```solidity
enum OrderStatus {
    PENDING,      // 0 - 待支付
    PAID,         // 1 - 已支付
    PROCESSING,   // 2 - 处理中
    COMPLETED,    // 3 - 已完成
    CANCELLED     // 4 - 已取消
}
```

### 状态转换图
```
PENDING (创建订单)
    ↓
    | processPayment() - 买家支付
    ↓
PAID (支付完成)
    ↓
    | _executePayment() - 开始处理
    ↓
PROCESSING (处理中)
    ↓
    | 兑换 + 费用计算 + 捐赠
    ↓
COMPLETED (完成)

特殊情况：
PENDING → CANCELLED (商家取消)
PAID/PROCESSING → CANCELLED (退款)
```

---

## 🎯 关键特性

### 1. 自动记录买家（无需注册）
```solidity
if (order.payer == address(0)) {
    order.payer = msg.sender;  // ✅ 自动记录
}
```

**优点：**
- ✅ 降低用户门槛
- ✅ 简化支付流程
- ✅ 提升用户体验

### 2. 支持部分支付
```solidity
if (order.allowPartialPayment) {
    require(
        order.paidAmount + paymentAmount <= order.orderAmount,
        "Payment exceeds order amount"
    );
}
```

**用例：**
- 分期付款
- 众筹
- 预付款

### 3. 跨币种支付
```solidity
if (order.paymentToken != order.settlementToken) {
    // 通过 FXRouter 自动兑换
    fxRouter.swapExactTokensForTokens(swapParams);
}
```

**优点：**
- ✅ 买家用任意代币支付
- ✅ 商家收到指定代币
- ✅ 自动处理汇率

### 4. 价差捐赠
```solidity
if (enableSpreadDonation) {
    _processSpreadDonation(orderId, order);
}
```

**机制：**
- 获取 AI 推荐汇率
- 计算实际汇率
- 价差捐赠到公共物品基金

---

## 📊 数据流

### 支付数据流
```
买家钱包 (USDC)
    ↓ safeTransferFrom
PaymentGateway 合约
    ↓ approve + swap
FXRouter 合约
    ↓ 兑换为 USDT
PaymentGateway 合约
    ↓ 扣除费用
商家余额 (USDT)
    ↓ withdraw
商家钱包 (USDT)
```

### 捐赠数据流
```
平台费 (5%)
    ↓ _processDonation
捐赠地址 (50% 平台费)
    ↓
PublicGoodsFund 合约
    ↓ 记录贡献
买家贡献统计
```

---

## 🔐 安全机制

### 1. 重入保护
```solidity
function processPayment(...) external nonReentrant {
    // ...
}
```

### 2. 暂停机制
```solidity
function processPayment(...) external whenNotPaused {
    // ...
}
```

### 3. 状态检查
```solidity
modifier onlyPendingOrder(bytes32 orderId) {
    require(orders[orderId].status == OrderStatus.PENDING, "Order not pending");
    _;
}
```

### 4. 权限控制
```solidity
require(msg.sender == order.merchant || msg.sender == owner(), "Not authorized");
```

---

## 💡 总结

### 核心要点
1. ✅ **买家无需注册** - 支付时自动记录
2. ✅ **商家需要注册** - 存储商家信息
3. ✅ **支持部分支付** - 灵活的支付方式
4. ✅ **跨币种支付** - 自动兑换
5. ✅ **价差捐赠** - 支持公共物品

### 设计优势
- 🎯 **用户友好** - 降低买家门槛
- 🔒 **安全可靠** - 多重安全机制
- 🔄 **灵活扩展** - 支持多种支付场景
- 💝 **公益导向** - 自动捐赠机制

---

## 📚 相关文档

- [快速开始](./QUICK_START.md)
- [完整流程指南](./PAYMENT_FLOW_GUIDE.md)
- [架构文档](./ARCHITECTURE.md)

