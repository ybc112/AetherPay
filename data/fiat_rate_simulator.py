#!/usr/bin/env python3
"""
法币汇率模拟器 - 不需要API密钥
使用硬编码的汇率 + 随机波动模拟真实汇率
"""

import sqlite3
import json
from datetime import datetime
import random
import os

class FiatRateSimulator:
    """模拟法币汇率（用于开发环境）"""

    def __init__(self):
        # 基础汇率（2024年10月参考值）
        self.base_rates = {
            'CNY_USD': 0.14,    # 人民币
            'EUR_USD': 1.08,    # 欧元
            'JPY_USD': 0.0067,  # 日元
            'GBP_USD': 1.26,    # 英镑
            'KRW_USD': 0.00074, # 韩元
            'HKD_USD': 0.128,   # 港币
            'SGD_USD': 0.74,    # 新加坡元
            'AUD_USD': 0.65,    # 澳元
            'CAD_USD': 0.73,    # 加元
        }

        # 数据库路径
        self.db_path = os.path.join(os.path.dirname(__file__), '..', 'aether_oracle.db')

    def generate_rate(self, pair):
        """生成带有小幅波动的汇率"""
        base_rate = self.base_rates.get(pair, 1.0)

        # 添加±0.5%的随机波动
        volatility = random.uniform(-0.005, 0.005)
        rate = base_rate * (1 + volatility)

        return round(rate, 6)

    def insert_rates(self):
        """插入模拟汇率到数据库"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        timestamp = datetime.now().isoformat()

        for pair, base_rate in self.base_rates.items():
            rate = self.generate_rate(pair)

            # 插入数据（不包含volume_24h）
            cursor.execute("""
                INSERT INTO exchange_rates (pair, source, price, timestamp)
                VALUES (?, ?, ?, ?)
            """, (pair, 'simulated', rate, timestamp))

            print(f"✅ {pair}: {rate:.6f} (base: {base_rate})")

        conn.commit()
        conn.close()

        return f"Successfully inserted {len(self.base_rates)} fiat rates"

def main():
    """主函数"""
    simulator = FiatRateSimulator()
    result = simulator.insert_rates()
    print(f"\n{result}")

    # 验证数据
    conn = sqlite3.connect(simulator.db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pair, price, timestamp
        FROM exchange_rates
        WHERE source = 'simulated'
        ORDER BY timestamp DESC
        LIMIT 5
    """)

    print("\n📊 Latest simulated rates:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: ${row[1]:.6f} at {row[2][:19]}")

    conn.close()

if __name__ == '__main__':
    main()