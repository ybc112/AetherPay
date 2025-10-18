const { ethers } = require('ethers');

/**
 * 通过 bytes32 orderId 检查订单
 */
async function main() {
  console.log("\n=================================================");
  console.log("🔍 Checking Order by bytes32 ID");
  console.log("=================================================\n");

  const PAYMENT_GATEWAY_V2 = "0x4995168D409767330D9693034d5cFfc7daFFb89B";
  const RPC_URL = "https://sepolia.optimism.io";
  
  // 从错误信息中提取的 orderId
  const ORDER_ID_BYTES32 = "0x5562bbf61d1b11c2bbf3085b676b338a606dbf3505e4e949c4e21e08e8a684c6";
  
  console.log("📋 Order ID (bytes32):", ORDER_ID_BYTES32);
  console.log("📋 Contract:", PAYMENT_GATEWAY_V2);
  console.log("📋 Network: OP Sepolia");
  console.log("");

  // 连接到 RPC
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // 合约 ABI（修正：第5个返回值是 receivedAmount，不是 paymentToken）
  const ABI = [
    "function getOrder(bytes32 orderId) view returns (address merchant, address payer, uint256 orderAmount, uint256 paidAmount, uint256 receivedAmount, uint8 status, uint256 createdAt, uint256 expiryTime, string metadataURI)",
    "function orderIdStrings(bytes32 orderId) view returns (string)"
  ];
  
  const contract = new ethers.Contract(PAYMENT_GATEWAY_V2, ABI, provider);

  try {
    // 获取订单详情
    console.log("🔄 Fetching order details...\n");
    const orderInfo = await contract.getOrder(ORDER_ID_BYTES32);
    
    console.log("=== Order Details ===\n");
    console.log("Merchant:", orderInfo.merchant);
    console.log("Payer (Designated):", orderInfo.payer);
    console.log("Order Amount:", ethers.utils.formatUnits(orderInfo.orderAmount, 6), "tokens");
    console.log("Paid Amount:", ethers.utils.formatUnits(orderInfo.paidAmount, 6), "tokens");
    console.log("Received Amount:", ethers.utils.formatUnits(orderInfo.receivedAmount, 6), "tokens");
    console.log("Status:", orderInfo.status, orderInfo.status === 0 ? "(PENDING)" : orderInfo.status === 1 ? "(PAID)" : "(OTHER)");
    console.log("Created At:", new Date(Number(orderInfo.createdAt) * 1000).toLocaleString());
    console.log("Expiry Time:", new Date(Number(orderInfo.expiryTime) * 1000).toLocaleString());
    console.log("Metadata URI:", orderInfo.metadataURI);
    
    // 获取订单字符串ID
    try {
      const orderIdString = await contract.orderIdStrings(ORDER_ID_BYTES32);
      console.log("\n📝 Order ID (string):", orderIdString);
    } catch (e) {
      console.log("\n📝 Order ID (string): Unable to fetch");
    }
    
    console.log("\n=== Analysis ===\n");
    
    const designatedPayer = orderInfo.payer;
    const isPublicOrder = designatedPayer === "0x0000000000000000000000000000000000000000";
    
    if (isPublicOrder) {
      console.log("✅ This is a PUBLIC order");
      console.log("   Anyone can pay this order!");
    } else {
      console.log("⚠️  This is a PRIVATE order");
      console.log("   Only the designated payer can pay this order!");
      console.log("   Designated Payer:", designatedPayer);
      console.log("");
      console.log("🔍 Checksum comparison:");
      console.log("   Designated (from contract):", ethers.utils.getAddress(designatedPayer));
      console.log("   Your address (claimed):     0x99f8C4e03181022125CAB1A9929Ab44027AD276a");
      
      const yourAddress = "0x99f8C4e03181022125CAB1A9929Ab44027AD276a";
      const match = ethers.utils.getAddress(designatedPayer) === ethers.utils.getAddress(yourAddress);
      
      console.log("");
      if (match) {
        console.log("✅ Addresses MATCH! You should be able to pay.");
        console.log("");
        console.log("🤔 But you're getting an error... Possible reasons:");
        console.log("   1. MetaMask is connected to a DIFFERENT account");
        console.log("   2. The transaction is being sent from a different address");
        console.log("   3. There's a proxy/relayer issue");
        console.log("   4. The order status changed (already paid/cancelled)");
      } else {
        console.log("❌ Addresses DO NOT MATCH!");
        console.log("   You cannot pay this order with your current account.");
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.message.includes("Order not found") || orderInfo.merchant === "0x0000000000000000000000000000000000000000") {
      console.log("\n💡 This order does not exist or has been deleted.");
    }
  }
  
  console.log("\n=================================================");
  console.log("✅ Check completed!");
  console.log("=================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

