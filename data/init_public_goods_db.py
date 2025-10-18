"""
Public Goods Fund 数据库初始化脚本
用于存储链上 Public Goods 数据的本地备份和分析
"""

import sqlite3
import os
from datetime import datetime

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(__file__), 'public_goods.db')

def init_database():
    """初始化 Public Goods 数据库"""
    print("🔧 Initializing Public Goods Database...")
    print(f"📁 Database path: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # ============ 1. 捐赠记录表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_hash TEXT UNIQUE NOT NULL,
            block_number INTEGER NOT NULL,
            contributor_address TEXT NOT NULL,
            token_address TEXT NOT NULL,
            token_symbol TEXT,
            ai_rate DECIMAL(18, 8) NOT NULL,
            execution_rate DECIMAL(18, 8) NOT NULL,
            spread_amount DECIMAL(18, 8) NOT NULL,
            spread_amount_usd DECIMAL(18, 2),
            trade_amount DECIMAL(18, 8) NOT NULL,
            timestamp DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_contributor (contributor_address),
            INDEX idx_timestamp (timestamp),
            INDEX idx_token (token_address)
        )
    ''')
    print("✅ Created table: donations")
    
    # ============ 2. 贡献者统计表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contributors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT UNIQUE NOT NULL,
            total_contributed DECIMAL(18, 8) DEFAULT 0,
            total_contributed_usd DECIMAL(18, 2) DEFAULT 0,
            total_transactions INTEGER DEFAULT 0,
            first_contribution_at DATETIME,
            last_contribution_at DATETIME,
            badge_level TEXT DEFAULT 'None',
            is_verified BOOLEAN DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_address (address),
            INDEX idx_badge (badge_level)
        )
    ''')
    print("✅ Created table: contributors")
    
    # ============ 3. 捐赠轮次表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS donation_rounds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_id INTEGER UNIQUE NOT NULL,
            total_donated DECIMAL(18, 8) DEFAULT 0,
            total_donated_usd DECIMAL(18, 2) DEFAULT 0,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            is_distributed BOOLEAN DEFAULT 0,
            distributed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_round_id (round_id),
            INDEX idx_start_time (start_time)
        )
    ''')
    print("✅ Created table: donation_rounds")
    
    # ============ 4. 轮次接收方表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS round_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_id INTEGER NOT NULL,
            recipient_address TEXT NOT NULL,
            recipient_name TEXT,
            allocation_bps INTEGER NOT NULL,
            amount_received DECIMAL(18, 8) DEFAULT 0,
            amount_received_usd DECIMAL(18, 2) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (round_id) REFERENCES donation_rounds(round_id),
            INDEX idx_round_id (round_id),
            INDEX idx_recipient (recipient_address)
        )
    ''')
    print("✅ Created table: round_recipients")
    
    # ============ 5. 公共物品项目表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS public_goods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            good_id INTEGER UNIQUE NOT NULL,
            name TEXT NOT NULL,
            recipient_address TEXT NOT NULL,
            total_received DECIMAL(18, 8) DEFAULT 0,
            total_received_usd DECIMAL(18, 2) DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_good_id (good_id),
            INDEX idx_recipient (recipient_address)
        )
    ''')
    print("✅ Created table: public_goods")
    
    # ============ 6. 全局统计表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS global_stats (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            total_lifetime_donations DECIMAL(18, 8) DEFAULT 0,
            total_lifetime_donations_usd DECIMAL(18, 2) DEFAULT 0,
            total_transactions INTEGER DEFAULT 0,
            total_contributors INTEGER DEFAULT 0,
            current_round_id INTEGER DEFAULT 0,
            last_synced_block INTEGER DEFAULT 0,
            last_synced_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("✅ Created table: global_stats")
    
    # 插入初始统计记录
    cursor.execute('''
        INSERT OR IGNORE INTO global_stats (id, total_lifetime_donations, total_transactions, total_contributors)
        VALUES (1, 0, 0, 0)
    ''')
    
    # ============ 7. 同步日志表 ============
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_type TEXT NOT NULL,
            start_block INTEGER,
            end_block INTEGER,
            records_synced INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            INDEX idx_sync_type (sync_type),
            INDEX idx_status (status)
        )
    ''')
    print("✅ Created table: sync_logs")
    
    conn.commit()
    conn.close()
    
    print("\n✅ Database initialized successfully!")
    print(f"📊 Database location: {DB_PATH}")
    return DB_PATH

def get_database_info():
    """获取数据库信息"""
    if not os.path.exists(DB_PATH):
        print("❌ Database not found. Run init_database() first.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("\n📊 Database Information:")
    print("=" * 60)
    
    # 获取所有表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    for table in tables:
        table_name = table[0]
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"  📋 {table_name}: {count} records")
    
    # 获取全局统计
    cursor.execute("SELECT * FROM global_stats WHERE id = 1")
    stats = cursor.fetchone()
    if stats:
        print("\n🌍 Global Statistics:")
        print(f"  💰 Total Lifetime Donations: ${stats[2]:.2f}")
        print(f"  📊 Total Transactions: {stats[3]}")
        print(f"  👥 Total Contributors: {stats[4]}")
        print(f"  🔄 Current Round ID: {stats[5]}")
        print(f"  🔗 Last Synced Block: {stats[6]}")
    
    conn.close()

def reset_database():
    """重置数据库（危险操作！）"""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("🗑️  Database deleted.")
    init_database()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--reset":
        confirm = input("⚠️  Are you sure you want to reset the database? (yes/no): ")
        if confirm.lower() == 'yes':
            reset_database()
        else:
            print("❌ Reset cancelled.")
    else:
        init_database()
        get_database_info()

