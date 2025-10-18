/**
 * EigenDA 去中心化存储服务
 * 替代 SQLite 本地存储
 */

import axios from 'axios';
import { ethers } from 'ethers';

export interface RateData {
  pair: string;
  rate: number;
  confidence: number;
  timestamp: number;
  oracleAddress: string;
  signature: string;
}

export interface EigenDABlob {
  data: string; // Base64 编码的数据
  commitment: string; // KZG commitment
  proof: string; // KZG proof
}

export class EigenDAStorage {
  private proxyUrl: string;
  private contractAddress: string;
  private provider: ethers.providers.Provider;

  constructor(
    proxyUrl: string = 'http://localhost:4242', // EigenDA Proxy 默认端口
    contractAddress: string = '', // AetherOracleV2 合约地址
    providerUrl: string = process.env.RPC_URL || ''
  ) {
    this.proxyUrl = proxyUrl;
    this.contractAddress = contractAddress;
    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
  }

  /**
   * 存储数据到 EigenDA
   * @returns blobId - 可以用来检索数据的唯一标识符
   */
  async storeRateData(data: RateData): Promise<string> {
    try {
      // 1. 序列化数据
      const jsonData = JSON.stringify(data);
      const blobData = Buffer.from(jsonData, 'utf-8').toString('base64');

      // 2. 提交到 EigenDA Proxy
      const response = await axios.post(`${this.proxyUrl}/put`, {
        data: blobData,
        // 可选参数
        confirmationThreshold: 0.67, // 67% 验证者确认
        quorumIds: [0], // Quorum ID (默认 0)
      });

      const blobId = response.data.blobId; // 类似 "0x1234...abcd"

      console.log(`✅ Data stored to EigenDA: ${blobId}`);
      console.log(`   Pair: ${data.pair}, Rate: ${data.rate}`);

      return blobId;

    } catch (error: any) {
      console.error('❌ Failed to store data to EigenDA:', error.message);
      throw new Error(`EigenDA storage failed: ${error.message}`);
    }
  }

  /**
   * 从 EigenDA 检索数据
   */
  async retrieveRateData(blobId: string): Promise<RateData> {
    try {
      // 1. 从 EigenDA 获取 blob
      const response = await axios.get(`${this.proxyUrl}/get/${blobId}`);

      // 2. 解码数据
      const blobData = Buffer.from(response.data.data, 'base64').toString('utf-8');
      const rateData: RateData = JSON.parse(blobData);

      console.log(`✅ Data retrieved from EigenDA: ${blobId}`);
      return rateData;

    } catch (error: any) {
      console.error('❌ Failed to retrieve data from EigenDA:', error.message);
      throw new Error(`EigenDA retrieval failed: ${error.message}`);
    }
  }

  /**
   * 批量存储多个汇率数据（节省成本）
   */
  async storeBatchRateData(dataList: RateData[]): Promise<string> {
    const batchData = {
      version: '1.0',
      timestamp: Date.now(),
      rates: dataList
    };

    const jsonData = JSON.stringify(batchData);
    const blobData = Buffer.from(jsonData, 'utf-8').toString('base64');

    const response = await axios.post(`${this.proxyUrl}/put`, {
      data: blobData,
      confirmationThreshold: 0.67,
    });

    return response.data.blobId;
  }

  /**
   * 验证 blob 数据完整性
   */
  async verifyBlob(blobId: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.proxyUrl}/verify/${blobId}`);
      return response.data.verified === true;
    } catch {
      return false;
    }
  }

  /**
   * 获取存储成本估算
   */
  async estimateStorageCost(dataSizeBytes: number): Promise<string> {
    // EigenDA 收费模型：约 $0.001 per KB
    const costPerKB = 0.001;
    const sizeKB = dataSizeBytes / 1024;
    const estimatedCostUSD = sizeKB * costPerKB;

    return estimatedCostUSD.toFixed(6);
  }
}

export default EigenDAStorage;
