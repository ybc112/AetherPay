# 🚀 PaymentGatewayV2 重新部署文档

> 支持指定买家功能 - 2025-01-15

---

## 📋 部署信息

### 新合约地址
```
PaymentGatewayV2: 0x4995168D409767330D9693034d5cFfc7daFFb89B
```

### 网络信息
- **网络**: Optimism Sepolia
- **Chain ID**: 11155420
- **部署时间**: 2025-01-15
- **部署者**: 0x5ce38CfB6698c437d76436DF6d5f30355FDE6a8c

### 相关合约
- **FXRouter**: 0xC2ab12Baf3735864528F890B809Ffe2f1cf2f8d1
- **PublicGoodsFund**: 0xCc9b8861CB2e42A043376433A73F2f019A7B2e1B
- **AetherOracleV2**: 0x1D323b80710c1d0c833B920CB7Ace09c49e237d7
- **USDC**: 0x07C1E2588295b73bD0b98F2806AbF13E748b6cC3
- **USDT**: 0xDda8cEa63EDa45777dBd2735A6B4C4c2Dd5f942C

### Etherscan
https://sepolia-optimism.etherscan.io/address/0x4995168D409767330D9693034d5cFfc7daFFb89B

---

## 🆕 新功能：指定买家

### 功能说明

商家在创建订单时可以**指定买家地址**：

1. **公开订单** - `designatedPayer = address(0)`
   - 任何人都可以支付
   - 第一个支付的人成为订单的 payer
   - 适用于：电商、众筹、公开销售

2. **定向订单** - `designatedPayer = 具体地址`
   - 只有指定地址可以支付
   - 其他地址支付会被拒绝
   - 适用于：B2B 交易、预约服务、定向销售

---

## 🔧 合约修改

### 1. createOrder 函数签名

**之前**:
```solidity
function createOrder(
    string memory orderIdString,
    uint256 orderAmount,
    address paymentToken,
    address settlementToken,
    string memory metadataURI,
    bool allowPartialPayment
) external returns (bytes32)
```

**现在**:
```solidity
function createOrder(
    string memory orderIdString,
    uint256 orderAmount,
    address paymentToken,
    address settlementToken,
    string memory metadataURI,
    bool allowPartialPayment,
    address designatedPayer  // 🆕 新增参数
) external returns (bytes32)
```

### 2. processPayment 验证逻辑

**之前**:
```solidity
// 任何人都可以支付，第一个支付的人成为 payer
if (order.payer == address(0)) {
    order.payer = msg.sender;
} else {
    require(order.payer == msg.sender, "Only original payer");
}
```

**现在**:
```solidity
// 验证买家权限
if (order.payer != address(0)) {
    // 定向订单：只有指定买家可以支付
    require(msg.sender == order.payer, "Only designated payer can pay this order");
}
// 公开订单：任何人都可以支付

// 设置 payer（如果是公开订单）
if (order.payer == address(0)) {
    order.payer = msg.sender;
}
```

### 3. OrderCreated 事件

**之前**:
```solidity
event OrderCreated(
    bytes32 indexed orderId,
    string orderIdString,
    address indexed merchant,
    uint256 orderAmount,
    address paymentToken,
    address settlementToken,
    string metadataURI
);
```

**现在**:
```solidity
event OrderCreated(
    bytes32 indexed orderId,
    string orderIdString,
    address indexed merchant,
    address indexed designatedPayer,  // 🆕 新增字段
    uint256 orderAmount,
    address paymentToken,
    address settlementToken,
    string metadataURI
);
```

---

## 💻 前端修改

### 1. 合约地址更新

**文件**: `frontend/lib/contracts.ts`

```typescript
export const CONTRACTS = {
  // ...
  PAYMENT_GATEWAY_V2: '0x4995168D409767330D9693034d5cFfc7daFFb89B', // ✅ 新地址
  // ...
}
```

### 2. ABI 更新

**文件**: `frontend/lib/contracts.ts`

```typescript
// createOrder 函数 ABI
{
  "inputs": [
    {"internalType": "string", "name": "orderIdString", "type": "string"},
    {"internalType": "uint256", "name": "orderAmount", "type": "uint256"},
    {"internalType": "address", "name": "paymentToken", "type": "address"},
    {"internalType": "address", "name": "settlementToken", "type": "address"},
    {"internalType": "string", "name": "metadataURI", "type": "string"},
    {"internalType": "bool", "name": "allowPartialPayment", "type": "bool"},
    {"internalType": "address", "name": "designatedPayer", "type": "address"}  // 🆕
  ],
  "name": "createOrder",
  "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
  "stateMutability": "nonpayable",
  "type": "function"
}
```

### 3. 创建订单表单

**文件**: `frontend/app/dashboard/create-order/page.tsx`

**新增字段**:
```typescript
const [formData, setFormData] = useState({
  orderId: '',
  amount: '',
  description: '',
  buyerEmail: '',
  buyerAddress: '',  // 🆕 买家钱包地址
  paymentToken: CONTRACTS.MOCK_USDC,
  settlementToken: CONTRACTS.MOCK_USDT,
});
```

**新增输入框**:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Buyer Wallet Address <span className="text-gray-400">(Optional - Leave empty for public order)</span>
  </label>
  <input
    type="text"
    value={formData.buyerAddress}
    onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
    placeholder="0x... (Leave empty to allow anyone to pay)"
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900 font-mono text-sm"
  />
  <p className="mt-1 text-xs text-gray-500">
    💡 If specified, only this address can pay the order. Leave empty for public orders.
  </p>
</div>
```

**调用合约**:
```typescript
// 处理买家地址：如果为空或无效，使用 address(0) 表示公开订单
const designatedPayer = formData.buyerAddress && formData.buyerAddress.startsWith('0x') && formData.buyerAddress.length === 42
  ? formData.buyerAddress as `0x${string}`
  : '0x0000000000000000000000000000000000000000' as `0x${string}`;

writeContract({
  address: CONTRACTS.PAYMENT_GATEWAY_V2 as `0x${string}`,
  abi: PAYMENT_GATEWAY_ABI,
  functionName: 'createOrder',
  args: [
    formData.orderId,
    amountInWei,
    formData.paymentToken as `0x${string}`,
    formData.settlementToken as `0x${string}`,
    ipfsCID,
    false,  // allowPartialPayment
    designatedPayer  // 🆕 指定买家地址
  ],
});
```

### 4. 订单市场页面

**文件**: `frontend/app/orders/page.tsx`

**更新事件定义**:
```typescript
const logs = await publicClient.getLogs({
  address: CONTRACTS.PAYMENT_GATEWAY_V2 as `0x${string}`,
  event: parseAbiItem('event OrderCreated(bytes32 indexed orderId, string orderIdString, address indexed merchant, address indexed designatedPayer, uint256 orderAmount, address paymentToken, address settlementToken, string metadataURI)'),
  fromBlock: BigInt(0),
  toBlock: 'latest',
});
```

---

## 🧪 测试场景

### 场景 1：公开订单（任何人都可以支付）

```bash
# 1. 商家创建公开订单
访问 /dashboard/create-order
填写订单信息
Buyer Wallet Address: 留空
创建订单

# 2. 任何买家都可以支付
买家 A 访问 /pay/ORDER_001 → 可以支付 ✅
买家 B 访问 /pay/ORDER_001 → 可以支付 ✅
```

### 场景 2：定向订单（只有指定买家可以支付）

```bash
# 1. 商家创建定向订单
访问 /dashboard/create-order
填写订单信息
Buyer Wallet Address: 0x1234...5678 (买家 A 的地址)
创建订单

# 2. 只有指定买家可以支付
买家 A (0x1234...5678) 访问 /pay/ORDER_001 → 可以支付 ✅
买家 B (0xabcd...efgh) 访问 /pay/ORDER_001 → 支付失败 ❌
  错误: "Only designated payer can pay this order"
```

---

## ⚠️ 重要提示

### 1. 旧订单数据不会迁移
- 旧合约的订单数据不会自动迁移到新合约
- 需要重新创建订单

### 2. 需要重新注册商家
- 商家需要在新合约上重新调用 `registerMerchant()`
- 旧合约的商家信息不会迁移

### 3. 测试代币余额保留
- USDC 和 USDT 的余额保留
- 无需重新铸造（除非需要更多）

---

## 📝 下一步操作

### 1. 重新注册商家
```bash
访问 /dashboard
点击 "Register as Merchant"
输入商家名称
确认交易
```

### 2. 创建测试订单

**公开订单**:
```bash
Order ID: PUBLIC_ORDER_001
Amount: 10 USDC
Buyer Address: 留空
```

**定向订单**:
```bash
Order ID: PRIVATE_ORDER_001
Amount: 20 USDC
Buyer Address: 0x... (指定买家地址)
```

### 3. 测试支付流程

**测试公开订单**:
```bash
# 使用任意钱包支付
访问 /pay/PUBLIC_ORDER_001
连接钱包
Approve + Pay
验证支付成功
```

**测试定向订单**:
```bash
# 使用指定钱包支付
访问 /pay/PRIVATE_ORDER_001
连接指定的钱包
Approve + Pay
验证支付成功

# 使用其他钱包支付（应该失败）
访问 /pay/PRIVATE_ORDER_001
连接其他钱包
Approve + Pay
验证支付失败，错误信息正确
```

---

## 🎉 总结

### 新功能优势

1. **灵活性** ✅
   - 支持公开订单和定向订单
   - 商家可以根据场景选择

2. **安全性** ✅
   - 定向订单只有指定买家可以支付
   - 防止订单被抢先支付

3. **兼容性** ✅
   - 向后兼容（留空表示公开订单）
   - 不影响现有功能

### 适用场景

- **公开订单**: 电商、众筹、公开销售
- **定向订单**: B2B 交易、预约服务、定向销售

---

## 📚 相关文档

- [快速开始指南](./QUICK_START.md)
- [支付流程指南](./PAYMENT_FLOW_GUIDE.md)
- [订单市场功能](./ORDER_MARKET_FEATURE.md)
- [合约代码分析](./PAYMENT_CONTRACT_ANALYSIS.md)

---

**🚀 现在开始测试新功能吧！**

