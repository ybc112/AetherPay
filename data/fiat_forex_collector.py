"""
扩展数据收集器 - 支持法币汇率
用途：为跨境支付提供完整的法币汇率预测数据
"""

import os
import requests
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging

load_dotenv('./config/.env')

class FiatForexCollector:
    """法币汇率数据收集器"""

    def __init__(self):
        # ExchangeRate-API (免费1500次/月)
        self.exchangerate_api_key = os.getenv('EXCHANGERATE_API_KEY')
        self.exchangerate_base_url = 'https://v6.exchangerate-api.com/v6'

        # Open Exchange Rates (免费1000次/月)
        self.openexchange_api_key = os.getenv('OPENEXCHANGE_API_KEY')
        self.openexchange_base_url = 'https://openexchangerates.org/api'

        # 数据库
        self.db_path = 'aether_oracle.db'

        # 核心法币对（亚太跨境支付）
        self.fiat_pairs = [
            'CNY/USD',    # 人民币/美元 - 最重要
            'JPY/USD',    # 日元/美元
            'KRW/USD',    # 韩元/美元
            'HKD/USD',    # 港币/美元
            'SGD/USD',    # 新加坡元/美元
            'EUR/USD',    # 欧元/美元
            'GBP/USD',    # 英镑/美元
            'AUD/USD',    # 澳元/美元
            'CAD/USD',    # 加元/美元
        ]

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def fetch_exchangerate_api(self):
        """
        从 ExchangeRate-API 获取法币汇率
        文档: https://www.exchangerate-api.com/docs
        """
        # 如果没有API密钥，跳过此源
        if not self.exchangerate_api_key:
            return []

        try:
            # 获取美元为基准的汇率
            url = f"{self.exchangerate_base_url}/{self.exchangerate_api_key}/latest/USD"
            response = requests.get(url, timeout=10)
            data = response.json()

            if data['result'] == 'success':
                rates = data['conversion_rates']
                timestamp = datetime.fromtimestamp(data['time_last_update_unix'])

                results = []
                for pair in self.fiat_pairs:
                    base, quote = pair.split('/')

                    if quote == 'USD':
                        # 直接汇率（如 CNY/USD）
                        # ExchangeRate-API 给的是 USD/XXX，需要取倒数
                        if base in rates:
                            rate = 1 / rates[base]  # CNY/USD = 1 / (USD/CNY)
                            results.append({
                                'pair': pair,
                                'source': 'exchangerate-api',
                                'price': rate,
                                'timestamp': timestamp,
                                'raw_data': None
                            })

                return results

        except Exception as e:
            self.logger.error(f"ExchangeRate-API fetch error: {e}")
            return []

    def fetch_openexchange_rates(self):
        """
        从 Open Exchange Rates 获取法币汇率
        文档: https://docs.openexchangerates.org/
        """
        # 如果没有API密钥，跳过此源
        if not self.openexchange_api_key:
            return []

        try:
            url = f"{self.openexchange_base_url}/latest.json?app_id={self.openexchange_api_key}"
            response = requests.get(url, timeout=10)
            data = response.json()

            rates = data['rates']
            timestamp = datetime.fromtimestamp(data['timestamp'])

            results = []
            for pair in self.fiat_pairs:
                base, quote = pair.split('/')

                if quote == 'USD' and base in rates:
                    rate = 1 / rates[base]  # XXX/USD = 1 / (USD/XXX)
                    results.append({
                        'pair': pair,
                        'source': 'openexchangerates',
                        'price': rate,
                        'timestamp': timestamp,
                        'raw_data': None
                    })

            return results

        except Exception as e:
            self.logger.error(f"OpenExchangeRates fetch error: {e}")
            return []

    def fetch_fixer_io(self):
        """
        从 Fixer.io 获取欧元基准汇率（欧洲央行官方数据）
        文档: https://fixer.io/documentation
        """
        fixer_api_key = os.getenv('FIXER_API_KEY')
        if not fixer_api_key:
            return []

        try:
            # Fixer.io 基准货币是EUR
            url = f"http://data.fixer.io/api/latest?access_key={fixer_api_key}"
            response = requests.get(url, timeout=10)
            data = response.json()

            if data['success']:
                rates = data['rates']
                timestamp = datetime.fromtimestamp(data['timestamp'])

                results = []
                # EUR为基准，转换成USD基准
                if 'USD' in rates:
                    usd_rate = rates['USD']  # EUR/USD

                    for pair in self.fiat_pairs:
                        base, quote = pair.split('/')

                        if quote == 'USD' and base in rates:
                            # XXX/USD = (EUR/USD) / (EUR/XXX)
                            rate = usd_rate / rates[base]
                            results.append({
                                'pair': pair,
                                'source': 'fixer',
                                'price': rate,
                                'timestamp': timestamp,
                                'raw_data': None
                            })

                return results

        except Exception as e:
            self.logger.error(f"Fixer.io fetch error: {e}")
            return []

    def store_forex_data(self, data_list):
        """存储法币汇率数据到数据库"""
        if not data_list:
            return

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        for data in data_list:
            try:
                cursor.execute('''
                    INSERT INTO exchange_rates (pair, source, price, volume, timestamp, raw_data)
                    VALUES (?, ?, ?, NULL, ?, ?)
                ''', (
                    data['pair'], data['source'], data['price'],
                    data['timestamp'], data.get('raw_data')
                ))

                self.logger.info(f"✅ Stored {data['pair']} from {data['source']}: {data['price']:.4f}")

            except Exception as e:
                self.logger.error(f"Store error for {data['pair']}: {e}")

        conn.commit()
        conn.close()

    def collect_all_fiat_rates(self):
        """收集所有法币汇率（聚合多数据源）"""
        all_data = []

        # 数据源1: ExchangeRate-API
        data1 = self.fetch_exchangerate_api()
        if data1:
            all_data.extend(data1)

        # 数据源2: Open Exchange Rates
        data2 = self.fetch_openexchange_rates()
        if data2:
            all_data.extend(data2)

        # 数据源3: Fixer.io (可选)
        data3 = self.fetch_fixer_io()
        if data3:
            all_data.extend(data3)

        # 存储数据
        self.store_forex_data(all_data)

        self.logger.info(f"📊 Collected {len(all_data)} fiat exchange rates")

    def get_latest_fiat_rate(self, pair):
        """获取最新的法币汇率（多源平均）"""
        conn = sqlite3.connect(self.db_path)

        query = '''
            SELECT source, price, timestamp
            FROM exchange_rates
            WHERE pair = ?
            AND timestamp >= datetime('now', '-1 hour')
            ORDER BY timestamp DESC
        '''

        df = pd.read_sql_query(query, conn, params=(pair,))
        conn.close()

        if df.empty:
            return None

        # 多源平均
        avg_price = df['price'].mean()
        latest_timestamp = df['timestamp'].iloc[0]

        return {
            'pair': pair,
            'avg_price': avg_price,
            'sources': df['source'].tolist(),
            'timestamp': latest_timestamp,
            'confidence': len(df) / 3.0  # 数据源数量越多，置信度越高
        }


# ============================================
# 使用示例
# ============================================

if __name__ == "__main__":
    collector = FiatForexCollector()

    # 收集一次
    collector.collect_all_fiat_rates()

    # 查询最新汇率
    cny_usd = collector.get_latest_fiat_rate('CNY/USD')
    if cny_usd:
        print(f"\n📊 CNY/USD 最新汇率:")
        print(f"  价格: {cny_usd['avg_price']:.4f}")
        print(f"  数据源: {', '.join(cny_usd['sources'])}")
        print(f"  置信度: {cny_usd['confidence']:.2f}")
