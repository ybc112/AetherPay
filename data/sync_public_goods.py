"""
Public Goods Fund 数据同步脚本
从链上同步 PublicGoodsFund 合约数据到本地数据库
"""

import sqlite3
import os
import json
from datetime import datetime
from web3 import Web3
from decimal import Decimal

# ============ 配置 ============
RPC_URL = "https://sepolia.optimism.io"
PUBLIC_GOODS_FUND_ADDRESS = "0xCc9b8861CB2e42A043376433A73F2f019A7B2e1B"
DB_PATH = os.path.join(os.path.dirname(__file__), 'public_goods.db')

# PublicGoodsFund ABI
PUBLIC_GOODS_FUND_ABI = [
    {
        "inputs": [],
        "name": "totalLifetimeDonations",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalTransactions",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalContributors",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "currentRoundId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getContributorInfo",
        "outputs": [
            {"internalType": "uint256", "name": "totalContributed", "type": "uint256"},
            {"internalType": "uint256", "name": "lastContributionTime", "type": "uint256"},
            {"internalType": "string", "name": "badgeLevel", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "roundId", "type": "uint256"}],
        "name": "getCurrentRoundInfo",
        "outputs": [
            {"internalType": "uint256", "name": "roundId", "type": "uint256"},
            {"internalType": "uint256", "name": "totalDonated", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "endTime", "type": "uint256"},
            {"internalType": "bool", "name": "distributed", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "contributor", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "token", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "aiRate", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "executionRate", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "spreadAmount", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "SpreadContributed",
        "type": "event"
    }
]

class PublicGoodsSync:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(PUBLIC_GOODS_FUND_ADDRESS),
            abi=PUBLIC_GOODS_FUND_ABI
        )
        self.db_path = DB_PATH
        
        # 确保数据库已初始化
        if not os.path.exists(self.db_path):
            print("❌ Database not found. Please run init_public_goods_db.py first.")
            raise FileNotFoundError(f"Database not found: {self.db_path}")
    
    def sync_global_stats(self):
        """同步全局统计数据"""
        print("\n📊 Syncing global statistics...")
        
        try:
            # 从链上读取数据
            total_donations = self.contract.functions.totalLifetimeDonations().call()
            total_transactions = self.contract.functions.totalTransactions().call()
            total_contributors = self.contract.functions.getTotalContributors().call()
            current_round_id = self.contract.functions.currentRoundId().call()
            
            # 转换单位 (假设是 USDC/USDT，6 decimals)
            total_donations_usd = float(total_donations) / 1e6
            
            print(f"  💰 Total Donations: ${total_donations_usd:.2f}")
            print(f"  📊 Total Transactions: {total_transactions}")
            print(f"  👥 Total Contributors: {total_contributors}")
            print(f"  🔄 Current Round: {current_round_id}")
            
            # 更新数据库
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE global_stats
                SET total_lifetime_donations = ?,
                    total_lifetime_donations_usd = ?,
                    total_transactions = ?,
                    total_contributors = ?,
                    current_round_id = ?,
                    last_synced_at = ?,
                    updated_at = ?
                WHERE id = 1
            ''', (
                total_donations,
                total_donations_usd,
                total_transactions,
                total_contributors,
                current_round_id,
                datetime.now(),
                datetime.now()
            ))
            
            conn.commit()
            conn.close()
            
            print("✅ Global stats synced successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error syncing global stats: {e}")
            return False
    
    def sync_donation_events(self, from_block=0, to_block='latest'):
        """同步捐赠事件"""
        print(f"\n📡 Syncing donation events from block {from_block} to {to_block}...")
        
        try:
            # 获取 SpreadContributed 事件
            event_filter = self.contract.events.SpreadContributed.create_filter(
                fromBlock=from_block,
                toBlock=to_block
            )
            
            events = event_filter.get_all_entries()
            print(f"  📋 Found {len(events)} donation events")
            
            if len(events) == 0:
                print("  ℹ️  No new donation events found.")
                return True
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            synced_count = 0
            
            for event in events:
                try:
                    # 解析事件数据
                    contributor = event['args']['contributor']
                    token = event['args']['token']
                    ai_rate = event['args']['aiRate']
                    execution_rate = event['args']['executionRate']
                    spread_amount = event['args']['spreadAmount']
                    timestamp = event['args']['timestamp']
                    tx_hash = event['transactionHash'].hex()
                    block_number = event['blockNumber']
                    
                    # 转换为 USD (假设 6 decimals)
                    spread_amount_usd = float(spread_amount) / 1e6
                    
                    # 插入捐赠记录
                    cursor.execute('''
                        INSERT OR IGNORE INTO donations (
                            tx_hash, block_number, contributor_address, token_address,
                            ai_rate, execution_rate, spread_amount, spread_amount_usd,
                            trade_amount, timestamp
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        tx_hash, block_number, contributor, token,
                        ai_rate, execution_rate, spread_amount, spread_amount_usd,
                        0,  # trade_amount 需要从其他地方获取
                        datetime.fromtimestamp(timestamp)
                    ))
                    
                    # 更新贡献者统计
                    cursor.execute('''
                        INSERT INTO contributors (address, total_contributed, total_contributed_usd, total_transactions, first_contribution_at, last_contribution_at)
                        VALUES (?, ?, ?, 1, ?, ?)
                        ON CONFLICT(address) DO UPDATE SET
                            total_contributed = total_contributed + ?,
                            total_contributed_usd = total_contributed_usd + ?,
                            total_transactions = total_transactions + 1,
                            last_contribution_at = ?,
                            updated_at = ?
                    ''', (
                        contributor, spread_amount, spread_amount_usd,
                        datetime.fromtimestamp(timestamp), datetime.fromtimestamp(timestamp),
                        spread_amount, spread_amount_usd,
                        datetime.fromtimestamp(timestamp), datetime.now()
                    ))
                    
                    synced_count += 1
                    
                except Exception as e:
                    print(f"  ⚠️  Error processing event {tx_hash}: {e}")
                    continue
            
            conn.commit()
            conn.close()
            
            print(f"✅ Synced {synced_count} donation events successfully!")
            return True
            
        except Exception as e:
            print(f"❌ Error syncing donation events: {e}")
            return False
    
    def sync_all(self):
        """同步所有数据"""
        print("🚀 Starting full sync...")
        print("=" * 60)
        
        # 1. 同步全局统计
        self.sync_global_stats()
        
        # 2. 同步捐赠事件（从最近 10000 个区块）
        current_block = self.w3.eth.block_number
        from_block = max(0, current_block - 10000)
        self.sync_donation_events(from_block=from_block)
        
        print("\n✅ Full sync completed!")
        print("=" * 60)

def main():
    """主函数"""
    try:
        syncer = PublicGoodsSync()
        syncer.sync_all()
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())

