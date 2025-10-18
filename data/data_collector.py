import os
import time
import json
import sqlite3
import redis
import requests
import ccxt
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging
import sys

# Add parent directory to path to import fiat_forex_collector
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv('./config/.env')

# Configure logging at module level (before class definition)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class DataCollector:
    def __init__(self):
        self.binance_key = os.getenv('BINANCE_API_KEY')
        self.binance_secret = os.getenv('BINANCE_API_SECRET')
        self.coingecko_key = os.getenv('COINGECKO_API_KEY')
        self.coinbase_key = os.getenv('COINBASE_API_KEY', '5e05b320-09e0-4a90-bc03-730d555c69b1')
        self.coinbase_secret = os.getenv('COINBASE_API_SECRET', 'DHyiHelYBN7IKFYDVB3UnD6OXzBUhGFh')
        self.okx_key = os.getenv('OKX_API_KEY')
        self.okx_secret = os.getenv('OKX_API_SECRET')
        self.okx_passphrase = os.getenv('OKX_PASSPHRASE')

        # Initialize exchanges
        # 使用公共客户端，仅调用公开行情接口，避免触发账户端点
        self.binance = ccxt.binance({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'spot'
            }
        })

        # Initialize Coinbase (公开API，无需认证)
        try:
            # 使用公开模式获取市场数据
            self.coinbase = ccxt.coinbase({
                'enableRateLimit': True
            })
            logging.info("Coinbase public exchange initialized")
        except Exception as e:
            logging.warning(f"Coinbase initialization failed: {e}")
            self.coinbase = None

        # Initialize OKX (欧意) - 使用公开API
        try:
            # 先尝试公开模式（OKX公开API无需认证）
            self.okx = ccxt.okx({
                'enableRateLimit': True
            })
            logging.info("OKX public exchange initialized")
        except Exception as e:
            logging.warning(f"OKX initialization failed: {e}")
            self.okx = None

        # Initialize database
        self.db_path = 'aether_oracle.db'
        self.init_database()

        # Initialize Redis
        try:
            self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
            self.redis_client.ping()
        except:
            self.redis_client = None
            logging.warning("Redis not available, using SQLite only")

        # 仅跟踪Binance上存在的加密交易对，法币对由其他数据源处理（后续可扩展）
        self.currency_pairs = [
            # 主流加密货币
            'BTC/USDT',
            'ETH/USDT',

            # 重要！稳定币对（用于跨境支付）
            'USDC/USDT',  # 最重要的稳定币对
            'USDT/DAI',   # DeFi常用
            'DAI/USDC',   # 三角套利检测

            # 其他主流币（可选）
            'BNB/USDT',
            'SOL/USDT',
            'ADA/USDT'
        ]

        self.logger = logging.getLogger(__name__)

    def init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exchange_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pair VARCHAR(10) NOT NULL,
                source VARCHAR(20) NOT NULL,
                price DECIMAL(18,8) NOT NULL,
                volume DECIMAL(18,8),
                timestamp DATETIME NOT NULL,
                raw_data TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS market_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pair VARCHAR(10) NOT NULL,
                high DECIMAL(18,8),
                low DECIMAL(18,8),
                volatility DECIMAL(10,6),
                spread DECIMAL(10,6),
                liquidity DECIMAL(18,8),
                timestamp DATETIME NOT NULL
            )
        ''')
        
        conn.commit()
        conn.close()

    def fetch_binance_data(self, symbol):
        try:
            ticker = self.binance.fetch_ticker(symbol)
            ohlcv = self.binance.fetch_ohlcv(symbol, '1m', limit=100)
            
            return {
                'source': 'binance',
                'pair': symbol,
                'price': ticker['last'],
                'volume': ticker['baseVolume'],
                'high': ticker['high'],
                'low': ticker['low'],
                'spread': (ticker['ask'] - ticker['bid']) / ticker['last'] * 100,
                'ohlcv': ohlcv,
                'timestamp': datetime.now()
            }
        except Exception as e:
            self.logger.error(f"Binance fetch error for {symbol}: {str(e)}")
            return None

    def fetch_coingecko_data(self, coin_id):
        try:
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
            headers = {"X-CG-API-KEY": self.coingecko_key}
            params = {"vs_currency": "usd", "days": "1", "interval": "hourly"}

            response = requests.get(url, headers=headers, params=params)
            data = response.json()

            if 'prices' in data:
                latest_price = data['prices'][-1][1]
                return {
                    'source': 'coingecko',
                    'pair': f"{coin_id.upper()}/USD",
                    'price': latest_price,
                    'volume': data.get('total_volumes', [[0, 0]])[-1][1],
                    'timestamp': datetime.now(),
                    'raw_data': json.dumps(data)
                }
        except Exception as e:
            self.logger.error(f"CoinGecko fetch error for {coin_id}: {str(e)}")
            return None

    def fetch_coinbase_data(self, symbol):
        """从Coinbase获取实时数据"""
        if not self.coinbase:
            return None

        try:
            # Coinbase使用不同的交易对格式
            if 'USDT' in symbol:
                coinbase_symbol = symbol.replace('/USDT', '-USD')
            else:
                coinbase_symbol = symbol.replace('/', '-')

            ticker = self.coinbase.fetch_ticker(coinbase_symbol)

            return {
                'source': 'coinbase',
                'pair': symbol,
                'price': ticker['last'],
                'volume': ticker['baseVolume'],
                'high': ticker['high'],
                'low': ticker['low'],
                'spread': (ticker['ask'] - ticker['bid']) / ticker['last'] * 100 if ticker.get('ask') and ticker.get('bid') else 0,
                'timestamp': datetime.now()
            }
        except Exception as e:
            self.logger.error(f"Coinbase fetch error for {symbol}: {str(e)}")
            return None

    def fetch_okx_data(self, symbol):
        """从OKX获取实时数据"""
        if not self.okx:
            return None

        try:
            ticker = self.okx.fetch_ticker(symbol)
            ohlcv = self.okx.fetch_ohlcv(symbol, '1m', limit=100)

            return {
                'source': 'okx',
                'pair': symbol,
                'price': ticker['last'],
                'volume': ticker['baseVolume'],
                'high': ticker['high'],
                'low': ticker['low'],
                'spread': (ticker['ask'] - ticker['bid']) / ticker['last'] * 100 if ticker.get('ask') and ticker.get('bid') else 0,
                'ohlcv': ohlcv,
                'timestamp': datetime.now()
            }
        except Exception as e:
            self.logger.error(f"OKX fetch error for {symbol}: {str(e)}")
            return None

    def calculate_technical_indicators(self, ohlcv_data):
        df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # Simple moving averages
        df['sma_20'] = df['close'].rolling(window=20).mean()
        df['sma_50'] = df['close'].rolling(window=50).mean()
        
        # Volatility (standard deviation of returns)
        df['returns'] = df['close'].pct_change()
        volatility = df['returns'].std() * (60 ** 0.5)  # 1-minute to hourly
        
        # Liquidity proxy (volume-weighted average)
        liquidity = (df['volume'] * df['close']).sum() / df['volume'].sum()
        
        return {
            'volatility': volatility,
            'liquidity': liquidity,
            'sma_20': df['sma_20'].iloc[-1] if len(df) >= 20 else None,
            'sma_50': df['sma_50'].iloc[-1] if len(df) >= 50 else None
        }

    def store_data(self, data):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Store exchange rate data
        cursor.execute('''
            INSERT INTO exchange_rates (pair, source, price, volume, timestamp, raw_data)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data['pair'], data['source'], data['price'], 
            data.get('volume'), data['timestamp'], 
            data.get('raw_data', '')
        ))
        
        # Store market data if available
        if 'ohlcv' in data and data['ohlcv']:
            indicators = self.calculate_technical_indicators(data['ohlcv'])
            cursor.execute('''
                INSERT INTO market_data (pair, high, low, volatility, spread, liquidity, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['pair'], data.get('high'), data.get('low'),
                indicators['volatility'], data.get('spread'),
                indicators['liquidity'], data['timestamp']
            ))
        
        conn.commit()
        conn.close()
        
        # Cache in Redis
        if self.redis_client:
            cache_key = f"rate:{data['pair']}:{data['source']}"
            cache_data = {
                'price': data['price'],
                'timestamp': data['timestamp'].isoformat(),
                'volume': data.get('volume', 0)
            }
            self.redis_client.setex(cache_key, 300, json.dumps(cache_data))

    def collect_all_data(self):
        self.logger.info("Starting data collection...")

        # Collect from Binance
        for pair in self.currency_pairs:
            if '/' in pair:
                binance_data = self.fetch_binance_data(pair)
                if binance_data:
                    self.store_data(binance_data)
                    self.logger.info(f"Stored Binance data for {pair}")

                time.sleep(0.1)  # Rate limiting

        # Collect from Coinbase
        if self.coinbase:
            for pair in self.currency_pairs:
                coinbase_data = self.fetch_coinbase_data(pair)
                if coinbase_data:
                    self.store_data(coinbase_data)
                    self.logger.info(f"Stored Coinbase data for {pair}")

                time.sleep(0.2)  # Rate limiting

        # Collect from OKX
        if self.okx:
            for pair in self.currency_pairs:
                okx_data = self.fetch_okx_data(pair)
                if okx_data:
                    self.store_data(okx_data)
                    self.logger.info(f"Stored OKX data for {pair}")

                time.sleep(0.2)  # Rate limiting

        # Collect from CoinGecko
        coingecko_coins = ['bitcoin', 'ethereum']
        for coin in coingecko_coins:
            cg_data = self.fetch_coingecko_data(coin)
            if cg_data:
                self.store_data(cg_data)
                self.logger.info(f"Stored CoinGecko data for {coin}")

            time.sleep(1)  # CoinGecko rate limiting

        # Collect fiat forex rates
        try:
            from fiat_forex_collector import FiatForexCollector
            fiat_collector = FiatForexCollector()
            fiat_collector.collect_all_fiat_rates()
            self.logger.info("✅ Collected fiat forex rates")
        except Exception as e:
            self.logger.warning(f"⚠️ Fiat forex collection failed: {e}")

        self.logger.info("Data collection completed")

    def get_latest_rates(self, pair=None):
        conn = sqlite3.connect(self.db_path)
        
        if pair:
            query = '''
                SELECT * FROM exchange_rates 
                WHERE pair = ? 
                ORDER BY timestamp DESC 
                LIMIT 10
            '''
            df = pd.read_sql_query(query, conn, params=(pair,))
        else:
            query = '''
                SELECT * FROM exchange_rates 
                ORDER BY timestamp DESC 
                LIMIT 100
            '''
            df = pd.read_sql_query(query, conn)
        
        conn.close()
        return df

    def get_market_data(self, pair, hours=24):
        conn = sqlite3.connect(self.db_path)
        
        start_time = datetime.now() - timedelta(hours=hours)
        query = '''
            SELECT * FROM market_data 
            WHERE pair = ? AND timestamp >= ?
            ORDER BY timestamp DESC
        '''
        df = pd.read_sql_query(query, conn, params=(pair, start_time))
        
        conn.close()
        return df

if __name__ == "__main__":
    collector = DataCollector()
    collector.collect_all_data()