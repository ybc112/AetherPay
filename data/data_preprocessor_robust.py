import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sqlite3
import logging
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.decomposition import PCA
import ta

class RobustDataPreprocessor:
    def __init__(self, db_path='aether_oracle.db'):
        self.db_path = db_path
        self.scaler = StandardScaler()
        self.price_scaler = MinMaxScaler()
        self.logger = logging.getLogger(__name__)

    def load_training_data(self, pair, days=30):
        conn = sqlite3.connect(self.db_path)
        
        start_time = datetime.now() - timedelta(days=days)
        
        # Load exchange rate data
        rate_query = '''
            SELECT pair, source, price, volume, timestamp 
            FROM exchange_rates 
            WHERE pair = ? AND timestamp >= ?
            ORDER BY timestamp ASC
        '''
        rates_df = pd.read_sql_query(rate_query, conn, params=(pair, start_time))
        
        # Load market data
        market_query = '''
            SELECT pair, high, low, volatility, spread, liquidity, timestamp
            FROM market_data
            WHERE pair = ? AND timestamp >= ?
            ORDER BY timestamp ASC
        '''
        market_df = pd.read_sql_query(market_query, conn, params=(pair, start_time))
        
        conn.close()
        
        return rates_df, market_df

    def create_basic_features(self, rates_df, market_df):
        """Create minimal features that don't require large windows."""
        # Convert timestamp to datetime with mixed format
        rates_df['timestamp'] = pd.to_datetime(rates_df['timestamp'], format='mixed')
        market_df['timestamp'] = pd.to_datetime(market_df['timestamp'], format='mixed')
        
        # If only one source, use the data directly
        if len(rates_df['source'].unique()) == 1:
            # Use rates_df directly without pivot
            rates_df.set_index('timestamp', inplace=True)
            rates_df['avg_price'] = rates_df['price']
            rates_df['price_spread'] = 0  # No spread with single source
            
            # Merge with market data
            market_df.set_index('timestamp', inplace=True)
            combined_df = pd.merge(rates_df[['avg_price', 'price_spread', 'volume']], 
                                  market_df, 
                                  left_index=True, 
                                  right_index=True, 
                                  how='inner')
        else:
            # Original pivot logic for multiple sources
            rates_pivot = rates_df.pivot_table(
                index='timestamp',
                columns='source',
                values='price',
                aggfunc='mean'
            ).ffill()

            # Merge with market data
            market_df.set_index('timestamp', inplace=True)

            # Calculate avg_price and price_spread from all sources
            price_cols = [col for col in rates_pivot.columns if col in ['binance', 'coingecko', 'coinbase', 'okx']]
            if len(price_cols) > 0:
                avg_price = rates_pivot[price_cols].mean(axis=1)
                price_spread = rates_pivot[price_cols].std(axis=1)
            else:
                avg_price = rates_pivot.mean(axis=1)
                price_spread = rates_pivot.std(axis=1)

            # Create combined_df with only avg_price and price_spread (不包含各个数据源的列)
            combined_df = pd.DataFrame({
                'avg_price': avg_price,
                'price_spread': price_spread
            }, index=rates_pivot.index)

            # Merge with market data
            combined_df = pd.merge(combined_df, market_df, left_index=True, right_index=True, how='outer')

            # Add aggregated volume if available (避免重复索引)
            if 'volume' in rates_df.columns:
                volume_agg = rates_df.groupby('timestamp')['volume'].mean()
                if 'volume' not in combined_df.columns:
                    combined_df['volume'] = volume_agg
                else:
                    combined_df['volume'] = combined_df['volume'].fillna(volume_agg)
        
        # Fill missing values
        combined_df = combined_df.ffill().bfill()
        
        # Create time-based features
        combined_df['hour'] = combined_df.index.hour
        combined_df['day_of_week'] = combined_df.index.dayofweek
        combined_df['is_weekend'] = (combined_df.index.dayofweek >= 5).astype(int)
        
        # Basic price features that don't require much history
        if 'avg_price' in combined_df.columns:
            combined_df['price_return'] = combined_df['avg_price'].pct_change()
            
            # Use smaller windows for limited data
            min_window_3 = min(3, len(combined_df))
            min_window_5 = min(5, len(combined_df))
            
            if min_window_3 > 1:
                combined_df['price_sma_3'] = combined_df['avg_price'].rolling(min_window_3).mean()
                combined_df['price_std_3'] = combined_df['avg_price'].rolling(min_window_3).std()
            
            if min_window_5 > 1:
                combined_df['price_sma_5'] = combined_df['avg_price'].rolling(min_window_5).mean()
                combined_df['price_ema_5'] = combined_df['avg_price'].ewm(span=min_window_5).mean()
        
        # Volume features with adaptive windows
        if 'volume' in combined_df.columns and len(combined_df) > 3:
            combined_df['volume_sma'] = combined_df['volume'].rolling(min(5, len(combined_df))).mean()
            combined_df['volume_ratio'] = combined_df['volume'] / combined_df['volume_sma'].fillna(combined_df['volume'].mean())
        
        # Volatility features
        if 'volatility' in combined_df.columns and len(combined_df) > 3:
            combined_df['volatility_sma'] = combined_df['volatility'].rolling(min(5, len(combined_df))).mean()
            combined_df['volatility_ratio'] = combined_df['volatility'] / combined_df['volatility_sma'].fillna(combined_df['volatility'].mean())
        
        # Simple lag features
        for lag in [1, 2, 3]:
            if lag < len(combined_df):
                combined_df[f'price_lag_{lag}'] = combined_df['avg_price'].shift(lag)
                combined_df[f'return_lag_{lag}'] = combined_df['price_return'].shift(lag)
        
        # Fill NaN values with forward fill, then backward fill, then mean
        numeric_cols = combined_df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if combined_df[col].isnull().all():
                combined_df[col] = 0
            else:
                combined_df[col] = combined_df[col].ffill().bfill().fillna(combined_df[col].mean())
        
        return combined_df

    def create_features(self, rates_df, market_df):
        """Create features with adaptive window sizes based on available data."""
        combined_df = self.create_basic_features(rates_df, market_df)
        
        # Add advanced features only if we have enough data
        if len(combined_df) >= 20 and 'avg_price' in combined_df.columns:
            # Longer moving averages
            combined_df['price_sma_10'] = combined_df['avg_price'].rolling(10).mean()
            combined_df['price_sma_20'] = combined_df['avg_price'].rolling(20).mean()
            
            # RSI with smaller window
            delta = combined_df['avg_price'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=min(14, len(combined_df)//2)).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=min(14, len(combined_df)//2)).mean()
            rs = gain / (loss + 1e-10)  # Add small value to avoid division by zero
            combined_df['rsi'] = 100 - (100 / (1 + rs))
            
            # Simple Bollinger Bands
            combined_df['bb_middle'] = combined_df['avg_price'].rolling(min(20, len(combined_df)//2)).mean()
            bb_std = combined_df['avg_price'].rolling(min(20, len(combined_df)//2)).std()
            combined_df['bb_upper'] = combined_df['bb_middle'] + (bb_std * 2)
            combined_df['bb_lower'] = combined_df['bb_middle'] - (bb_std * 2)
            combined_df['bb_position'] = (combined_df['avg_price'] - combined_df['bb_lower']) / (combined_df['bb_upper'] - combined_df['bb_lower'] + 1e-10)
        
        # Final cleanup - fill any remaining NaN values
        numeric_cols = combined_df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if combined_df[col].isnull().any():
                combined_df[col] = combined_df[col].fillna(combined_df[col].mean())
        
        # Drop rows only if they have NaN in critical columns
        critical_cols = ['avg_price', 'volume']
        critical_cols = [col for col in critical_cols if col in combined_df.columns]
        if critical_cols:
            # Only drop rows where critical columns have NaN
            mask = combined_df[critical_cols].isnull().any(axis=1)
            combined_df = combined_df[~mask]
        
        return combined_df

    def prepare_ml_data(self, df, target_col='avg_price', lookback=12, lookahead=6):
        """
        准备机器学习数据（优化版）

        优化说明：
        - lookback默认值从24h改为12h（减少特征维度，加速训练）
        - 对于6小时预测任务，12小时历史数据已足够

        Args:
            df: 特征数据框
            target_col: 目标列名
            lookback: 回看窗口（小时），默认12（vs 原来24）
            lookahead: 预测提前量（小时），默认6
        """
        features = []
        targets = []
        timestamps = []

        # Adjust lookback based on available data
        actual_lookback = min(lookback, len(df) // 2)
        
        # Exclude non-numeric columns and the target column
        exclude_cols = ['pair', target_col, 'timestamp', 'source']
        numeric_dtypes = ['float64', 'int64', 'float32', 'int32', 'float16', 'int16', 'int8', 'uint8']
        feature_cols = []
        
        for col in df.columns:
            if col not in exclude_cols and df[col].dtype.name in numeric_dtypes:
                # Additional check to ensure all values are numeric
                if df[col].apply(lambda x: isinstance(x, (int, float, np.number)) or pd.isna(x)).all():
                    feature_cols.append(col)
        
        # Ensure we have enough data
        min_required = actual_lookback + lookahead + 1
        if len(df) < min_required:
            self.logger.warning(f"Insufficient data: have {len(df)} rows, need at least {min_required}")
            return np.array([]), np.array([]), [], feature_cols
        
        for i in range(actual_lookback, len(df) - lookahead):
            # Features: previous 'lookback' hours
            feature_window = df.iloc[i-actual_lookback:i][feature_cols].values.flatten()
            
            # Handle any remaining NaN values
            feature_window = np.nan_to_num(feature_window, nan=0.0)
            
            features.append(feature_window)
            
            # Target: price after 'lookahead' hours
            target_price = df.iloc[i + lookahead][target_col]
            targets.append(target_price)
            
            timestamps.append(df.index[i])
        
        features = np.array(features)
        targets = np.array(targets)
        
        # Only scale if we have features
        if len(features) > 0:
            features_scaled = self.scaler.fit_transform(features)
        else:
            features_scaled = features
        
        return features_scaled, targets, timestamps, feature_cols

    def add_external_features(self, df):
        """Add external features with proper error handling."""
        if df.empty:
            return df
            
        # Market sentiment indicators (placeholder)
        df['market_sentiment'] = np.random.normal(0, 1, len(df))  # Replace with real data
        
        # Global market indicators
        df['vix_proxy'] = df['volatility'] * 100 if 'volatility' in df.columns else 50
        
        # Liquidity conditions
        if 'liquidity' in df.columns and len(df) >= 30:
            df['liquidity_z_score'] = (df['liquidity'] - df['liquidity'].rolling(min(30, len(df))).mean()) / (df['liquidity'].rolling(min(30, len(df))).std() + 1e-10)
        
        # Time decay features - handle empty dataframe
        if len(df) > 0:
            df['time_since_start'] = (df.index - df.index[0]).total_seconds() / 3600
            df['time_sin'] = np.sin(2 * np.pi * df['hour'] / 24) if 'hour' in df.columns else 0
            df['time_cos'] = np.cos(2 * np.pi * df['hour'] / 24) if 'hour' in df.columns else 1
        
        return df