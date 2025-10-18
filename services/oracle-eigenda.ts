#!/usr/bin/env node

/**
 * Oracle 服务 - 集成 EigenDA 存储
 * 替换 SQLite 数据库为去中心化存储
 */

import express from 'express';
import { ethers } from 'ethers';
import EigenDAStorage, { RateData } from '../services/eigenda-storage';
import { execSync } from 'child_process';

const app = express();
app.use(express.json());

// 配置
const PORT = process.env.PORT || 3001;
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const ORACLE_CONTRACT_ADDRESS = process.env.ORACLE_ADDRESS || '0x4Fbc89436BE7A88F7Ee35D8E15fFb78fcAA0b95c';
const EIGENDA_PROXY_URL = process.env.EIGENDA_PROXY_URL || 'http://localhost:4242';
const RPC_URL = process.env.RPC_URL || 'https://sepolia.optimism.io';

// 初始化 EigenDA 存储
const eigenDAStorage = new EigenDAStorage(
  EIGENDA_PROXY_URL,
  ORACLE_CONTRACT_ADDRESS,
  RPC_URL
);

// 初始化以太坊连接
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// AetherOracleV3_EigenDA ABI (部分)
const oracleABI = [
  "function submitRateWithEigenDA(string pair, uint256 rate, uint256 confidence, string eigenDABlobId, bytes signature) external",
  "function getLatestRateWithBlobId(string pair) view returns (uint256 rate, uint256 confidence, uint256 timestamp, bool isValid, string eigenDABlobId)",
  "function getRateByBlobId(string pair, string blobId) view returns (uint256 rate, uint256 confidence, uint256 timestamp, bool isValid)"
];

const oracleContract = new ethers.Contract(
  ORACLE_CONTRACT_ADDRESS,
  oracleABI,
  wallet
);

/**
 * ========================================
 * API Endpoints
 * ========================================
 */

/**
 * POST /submit-rate-eigenda
 * 提交汇率数据并存储到 EigenDA
 */
app.post('/submit-rate-eigenda', async (req, res) => {
  const { pair, amount = 1000, confidenceThreshold = 0.95 } = req.body;

  if (!pair) {
    return res.status(400).json({ error: 'Missing pair parameter' });
  }

  try {
    console.log(`\n🔮 Predicting rate for ${pair}...`);

    // 1. 调用 Python AI 模型获取预测
    const pythonScript = `python3 models/aetherpay_predictor.py "${pair}" ${amount} ${confidenceThreshold}`;
    const prediction = JSON.parse(execSync(pythonScript, { encoding: 'utf-8' }));

    if (prediction.error) {
      return res.status(500).json({ error: 'AI prediction failed', details: prediction });
    }

    console.log(`   Predicted: ${prediction.predicted_price}, Confidence: ${prediction.confidence}`);

    // 2. 准备数据存储到 EigenDA
    const rateData: RateData = {
      pair: prediction.pair,
      rate: Math.round(prediction.predicted_price * 1e8), // 转换为 8 位小数
      confidence: Math.round(prediction.confidence * 10000), // 转换为基点
      timestamp: Math.floor(Date.now() / 1000),
      oracleAddress: wallet.address,
      signature: '' // 先留空，后面生成
    };

    // 3. 生成 ECDSA 签名
    const messageHash = ethers.utils.solidityKeccak256(
      ['string', 'uint256', 'uint256', 'uint256'],
      [rateData.pair, rateData.rate, rateData.confidence, Math.floor(Date.now() / 60000)]
    );
    rateData.signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));

    console.log(`\n📦 Storing data to EigenDA...`);

    // 4. 存储到 EigenDA
    const blobId = await eigenDAStorage.storeRateData(rateData);
    console.log(`   ✅ Stored to EigenDA: ${blobId}`);

    // 5. 提交到链上合约
    console.log(`\n⛓️  Submitting to blockchain...`);
    const tx = await oracleContract.submitRateWithEigenDA(
      rateData.pair,
      rateData.rate,
      rateData.confidence,
      blobId,
      rateData.signature
    );

    console.log(`   ⏳ Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

    // 6. 返回结果
    res.json({
      success: true,
      pair: rateData.pair,
      rate: prediction.predicted_price,
      confidence: prediction.confidence,
      eigenDABlobId: blobId,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: '✅ Rate submitted and stored to EigenDA successfully'
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Submission failed',
      message: error.message,
      details: error.stack
    });
  }
});

/**
 * GET /retrieve-from-eigenda
 * 从 EigenDA 检索历史数据
 */
app.get('/retrieve-from-eigenda', async (req, res) => {
  const { blobId } = req.query;

  if (!blobId) {
    return res.status(400).json({ error: 'Missing blobId parameter' });
  }

  try {
    console.log(`\n📥 Retrieving data from EigenDA: ${blobId}`);

    const rateData = await eigenDAStorage.retrieveRateData(blobId as string);

    console.log(`   ✅ Retrieved: ${rateData.pair} = ${rateData.rate / 1e8}`);

    res.json({
      success: true,
      blobId: blobId,
      data: {
        pair: rateData.pair,
        rate: rateData.rate / 1e8,
        confidence: rateData.confidence / 10000,
        timestamp: new Date(rateData.timestamp * 1000).toISOString(),
        oracleAddress: rateData.oracleAddress
      },
      message: '✅ Data retrieved from EigenDA successfully'
    });

  } catch (error: any) {
    console.error('❌ Retrieval error:', error.message);
    res.status(500).json({
      error: 'Retrieval failed',
      message: error.message
    });
  }
});

/**
 * GET /latest-rate-eigenda
 * 获取最新汇率（包含 EigenDA blob ID）
 */
app.get('/latest-rate-eigenda', async (req, res) => {
  const { pair } = req.query;

  if (!pair) {
    return res.status(400).json({ error: 'Missing pair parameter' });
  }

  try {
    console.log(`\n📊 Fetching latest rate for ${pair} from blockchain...`);

    const [rate, confidence, timestamp, isValid, eigenDABlobId] =
      await oracleContract.getLatestRateWithBlobId(pair);

    if (!isValid) {
      return res.status(404).json({
        error: 'No valid rate found',
        pair: pair
      });
    }

    console.log(`   Rate: ${ethers.utils.formatUnits(rate, 8)}`);
    console.log(`   Confidence: ${confidence / 100}%`);
    console.log(`   EigenDA Blob: ${eigenDABlobId}`);

    res.json({
      success: true,
      pair: pair,
      rate: parseFloat(ethers.utils.formatUnits(rate, 8)),
      confidence: confidence / 10000,
      timestamp: timestamp.toNumber(),
      isValid: isValid,
      eigenDABlobId: eigenDABlobId,
      message: '✅ Rate fetched from blockchain'
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch rate',
      message: error.message
    });
  }
});

/**
 * GET /verify-eigenda-data
 * 验证 EigenDA 数据完整性
 */
app.get('/verify-eigenda-data', async (req, res) => {
  const { blobId } = req.query;

  if (!blobId) {
    return res.status(400).json({ error: 'Missing blobId parameter' });
  }

  try {
    console.log(`\n🔍 Verifying blob: ${blobId}`);

    const isVerified = await eigenDAStorage.verifyBlob(blobId as string);

    console.log(`   Verified: ${isVerified ? '✅' : '❌'}`);

    res.json({
      success: true,
      blobId: blobId,
      verified: isVerified,
      message: isVerified
        ? '✅ Data integrity verified'
        : '❌ Data verification failed'
    });

  } catch (error: any) {
    console.error('❌ Verification error:', error.message);
    res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
});

/**
 * GET /storage-cost-estimate
 * 估算 EigenDA 存储成本
 */
app.get('/storage-cost-estimate', async (req, res) => {
  const { dataSize } = req.query;

  if (!dataSize) {
    return res.status(400).json({ error: 'Missing dataSize parameter (in bytes)' });
  }

  try {
    const estimatedCost = await eigenDAStorage.estimateStorageCost(
      parseInt(dataSize as string)
    );

    res.json({
      success: true,
      dataSizeBytes: parseInt(dataSize as string),
      estimatedCostUSD: estimatedCost,
      message: `Estimated storage cost: $${estimatedCost}`
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Estimation failed',
      message: error.message
    });
  }
});

/**
 * GET /health
 * 健康检查（包含 EigenDA 连接状态）
 */
app.get('/health', async (req, res) => {
  try {
    // 检查 EigenDA Proxy 连接
    const eigenDAHealthy = await checkEigenDAHealth();

    // 检查区块链连接
    const blockNumber = await provider.getBlockNumber();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      blockchain: {
        connected: true,
        blockNumber: blockNumber,
        network: (await provider.getNetwork()).name
      },
      eigenDA: {
        connected: eigenDAHealthy,
        proxyUrl: EIGENDA_PROXY_URL
      },
      oracle: {
        address: wallet.address,
        contractAddress: ORACLE_CONTRACT_ADDRESS
      }
    });

  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

async function checkEigenDAHealth(): Promise<boolean> {
  try {
    const axios = require('axios');
    const response = await axios.get(`${EIGENDA_PROXY_URL}/health`, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * ========================================
 * 启动服务器
 * ========================================
 */

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 AetherPay Oracle Service (EigenDA)');
  console.log('========================================');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📦 EigenDA Proxy: ${EIGENDA_PROXY_URL}`);
  console.log(`⛓️  Network: ${RPC_URL}`);
  console.log(`📝 Contract: ${ORACLE_CONTRACT_ADDRESS}`);
  console.log(`🔑 Oracle Address: ${wallet.address}`);
  console.log('========================================\n');
  console.log('API Endpoints:');
  console.log('  POST /submit-rate-eigenda');
  console.log('  GET  /retrieve-from-eigenda?blobId=...');
  console.log('  GET  /latest-rate-eigenda?pair=...');
  console.log('  GET  /verify-eigenda-data?blobId=...');
  console.log('  GET  /storage-cost-estimate?dataSize=...');
  console.log('  GET  /health');
  console.log('\n✅ Ready to accept requests\n');
});
