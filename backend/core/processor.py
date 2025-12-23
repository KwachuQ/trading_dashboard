import polars as pl
from typing import Dict, Any, BinaryIO
import io

def process_csv(file: BinaryIO) -> Dict[str, Any]:
    try:
        # Read the file content into bytes
        content = file.read()
        
        # Try different encodings
        try:
            df = pl.read_csv(io.BytesIO(content), try_parse_dates=True)
        except:
            # Fallback for common encoding issues
            df = pl.read_csv(io.BytesIO(content), encoding='latin-1', try_parse_dates=True)

        # 1. Normalize Columns (Best Effort Mapping)
        # We need standard columns: Date, Symbol, PnL, Duration (optional), Direction (optional)
        # Map common names to standardized names
        # Logic: Look for specific keywords in columns and rename
        column_map = {}
        cols_lower = {c.lower(): c for c in df.columns}
        
        # Map PnL
        pnl_candidates = ['pnl', 'profit', 'net profit', 'net_profit', 'pl', 'amount']
        for c in pnl_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'PnL'
                break
        
        # Map Date (Exit Date usually for PnL attribution)
        date_candidates = ['date', 'exit date', 'close date', 'time', 'close time', 'exitedat', 'trade day', 'tradeday', 'enteredat']
        for c in date_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'Date'
                break
        
        # Map Symbol
        symbol_candidates = ['symbol', 'ticker', 'instrument', 'asset', 'contractname', 'contract']
        for c in symbol_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'Symbol'
                break
                
        # Map Duration (if exists)
        dur_candidates = ['duration', 'holding time', 'tradeduration', 'trade duration']
        for c in dur_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'Duration'
                break
                
        # Map Direction (Long/Short)
        dir_candidates = ['direction', 'type', 'side']
        for c in dir_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'Direction'
                break
        
        # Map Fees
        fees_candidates = ['fees', 'fee', 'commission', 'commissions', 'cost']
        for c in fees_candidates:
            if c in cols_lower:
                column_map[cols_lower[c]] = 'Fees'
                break
      # Identify Entry/Exit columns for Duration calculation before renaming/casting
        entered_candidates = ['enteredat', 'entered at', 'entry time', 'open time', 'formatted_entry_time']
        exited_candidates = ['exitedat', 'exited at', 'exit time', 'close time', 'formatted_exit_time']
        
        entered_col_raw = None
        exited_col_raw = None
        
        for c in entered_candidates:
            if c in cols_lower:
                entered_col_raw = cols_lower[c]
                break
                
        for c in exited_candidates:
            if c in cols_lower:
                exited_col_raw = cols_lower[c]
                break

        # Preserve raw columns for duration calc
        if entered_col_raw:
            df = df.with_columns(pl.col(entered_col_raw).alias('_EnteredRaw'))
        if exited_col_raw:
            df = df.with_columns(pl.col(exited_col_raw).alias('_ExitedRaw'))

        # Rename columns based on map
        if column_map:
            df = df.rename(column_map)
        
        if 'PnL' not in df.columns or 'Date' not in df.columns:
            # Fallback/Error if critical cols missing
             raise ValueError("CSV must contain at least 'Date' & 'Profit/PnL' columns.")

        # Ensure types
        # Handle formatting like "11/04/2025 16:47:10 +01:00"
        # Strategy: Split by space to get date part, then parse
        try:
             # Try custom parsing for known format "MM/DD/YYYY ..."
             df = df.with_columns(
                 pl.col('Date').str.split(" ").list.get(0).str.strptime(pl.Date, "%m/%d/%Y", strict=False).alias('Date_Parsed')
             )
             # If successful (not all null), use it. if all null, fallback to standard cast
             if df['Date_Parsed'].null_count() < len(df):
                 df = df.with_columns(pl.col('Date_Parsed').alias('Date')).drop('Date_Parsed')
             else:
                 # Fallback to direct cast (e.g. if it was already YYYY-MM-DD)
                 df = df.drop('Date_Parsed').with_columns(pl.col('Date').cast(pl.Date, strict=False))
        except:
             # Fallback
             df = df.with_columns(pl.col('Date').cast(pl.Date, strict=False))

        # Handle Fees column
        if 'Fees' in df.columns:
            df = df.with_columns([
                pl.col('Fees').cast(pl.Float64, strict=False).fill_null(0.0)
            ])
        else:
            df = df.with_columns(pl.lit(0.0).alias('Fees'))
        
        df = df.with_columns([
            pl.col('PnL').cast(pl.Float64, strict=False).fill_null(0.0)
        ]).drop_nulls(['Date']) # Drop rows where Date is invalid/null
        
        # Handle Duration - Calculate from timestamps if available
        if '_EnteredRaw' in df.columns and '_ExitedRaw' in df.columns:
            try:
                df_temp = df.with_columns([
                    pl.col('_EnteredRaw').str.strptime(pl.Datetime, '%m/%d/%Y %H:%M:%S %z', strict=False).alias('EnteredTime'),
                    pl.col('_ExitedRaw').str.strptime(pl.Datetime, '%m/%d/%Y %H:%M:%S %z', strict=False).alias('ExitedTime')
                ])
                df = df_temp.with_columns(
                    ((pl.col('ExitedTime') - pl.col('EnteredTime')).dt.total_seconds()).fill_null(0.0).alias('Duration')
                ).drop(['EnteredTime', 'ExitedTime'])
            except:
                pass
            
            # Remove raw columns
            df = df.drop(['_EnteredRaw', '_ExitedRaw'])
            
        if 'Duration' in df.columns and df.schema['Duration'] != pl.Float64:
            # If it's Time type (common from CSV imports of duration strings like HH:MM:SS)
            if df.schema['Duration'] == pl.Time:
                df = df.with_columns(
                    (pl.col("Duration").dt.hour() * 3600 + 
                     pl.col("Duration").dt.minute() * 60 + 
                     pl.col("Duration").dt.second() + 
                     pl.col("Duration").dt.nanosecond() / 1e9).cast(pl.Float64).alias("Duration")
                )
            # If it's String, try to parse to Time first then convert
            elif df.schema['Duration'] == pl.Utf8:
                try:
                    df = df.with_columns(
                        pl.col("Duration").str.strptime(pl.Time, "%H:%M:%S%.f", strict=False).alias("Duration_Time")
                    )
                    df = df.with_columns(
                         (pl.col("Duration_Time").dt.hour() * 3600 + 
                          pl.col("Duration_Time").dt.minute() * 60 + 
                          pl.col("Duration_Time").dt.second() + 
                          pl.col("Duration_Time").dt.nanosecond() / 1e9).fill_null(0.0).alias("Duration")
                    ).drop("Duration_Time")
                except:
                   df = df.with_columns(pl.lit(0.0).alias('Duration'))
            else:
                 # Ensure Float
                 df = df.with_columns(pl.col('Duration').cast(pl.Float64, strict=False).fill_null(0.0))
        elif 'Duration' not in df.columns:
            # If Duration missing entirely, default to 0
            df = df.with_columns(pl.lit(0.0).alias('Duration'))
        
        # Calculate Net PnL (PnL - Fees) for accurate total
        df = df.with_columns(
            (pl.col('PnL') - pl.col('Fees')).alias('NetPnL')
        )
        
        # If Direction missing, try to infer (Optional, simplified)
        if 'Direction' not in df.columns:
             df = df.with_columns(pl.lit('Unknown').alias('Direction'))

        # Calculate statistics
        stats = calculate_stats(df)
        
        # Prepare charts data
        charts = prepare_charts_data(df)
        
        return {
            "stats": stats,
            "charts": charts,
            "data": df.to_dicts(), # Return raw data rows
            "message": "File processed successfully"
        }
    except Exception as e:
        raise ValueError(f"Error processing CSV: {str(e)}")

def calculate_stats(df: pl.DataFrame) -> Dict[str, Any]:
    # General
    total_trades = len(df)
    total_pnl = df['NetPnL'].sum()  # Use NetPnL (PnL - Fees)
    total_fees = df['Fees'].sum()
    gross_pnl = df['PnL'].sum()
    
    # Win/Loss (based on PnL before fees for trade classification)
    wins = df.filter(pl.col('PnL') > 0)
    losses = df.filter(pl.col('PnL') <= 0)
    
    win_count = len(wins)
    loss_count = len(losses)
    win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0.0
    
    avg_win = wins['PnL'].mean() if win_count > 0 else 0.0
    avg_loss = losses['PnL'].mean() if loss_count > 0 else 0.0
    
    gross_profit = wins['PnL'].sum()
    gross_loss = abs(losses['PnL'].sum())
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 0.0 # Avoid inf for JSON safety
    
    # Expected Value: (Win% * AvgWin) + (Loss% * AvgLoss) -> Avg PnL per trade
    expected_value = df['PnL'].mean() if total_trades > 0 else 0.0

    # Trade Info
    best_trade = df['PnL'].max()
    worst_trade = df['PnL'].min()
    best_trade_net = df['NetPnL'].max()
    worst_trade_net = df['NetPnL'].min()
    
    # Averages Duration (Assuming 'Duration' column might be seconds or minutes)
    # If duration is 0, these will be 0
    avg_duration = df['Duration'].mean()
    avg_win_duration = wins['Duration'].mean() if win_count > 0 else 0.0
    avg_loss_duration = losses['Duration'].mean() if loss_count > 0 else 0.0
    
    # Daily Aggregation (use NetPnL for accurate daily totals)
    daily_df = df.group_by('Date').agg([
        pl.col('NetPnL').sum().alias('DailyPnL'),
        pl.col('PnL').count().alias('TradeCount'),
        (pl.col('PnL') > 0).sum().alias('WinCount')
    ]).sort('Date')
    
    # Daily Stats
    daily_pnl = daily_df['DailyPnL']
    
    # Cumulative Sum for Balance Curve
    # Assuming starting balance is 0 or request input, for chart we just show PnL curve
    # But for stats like "Daily Account Balance" we ideally need starting balance. 
    # For now we'll do Cumulative PnL.
    daily_df = daily_df.with_columns(
        pl.col('DailyPnL').cum_sum().alias('CumulativePnL')
    )
    
    if len(daily_df) > 0:
        best_day = daily_pnl.max()
        worst_day = daily_pnl.min()
        most_active_day = daily_df['TradeCount'].max()
        
        # Day Win %
        winning_days = daily_df.filter(pl.col('DailyPnL') > 0)
        day_win_rate = (len(winning_days) / len(daily_df) * 100)
        
        # Best Day % of Total Profit
        best_day_pct = (best_day / total_pnl * 100) if total_pnl > 0 else 0.0
    else:
        best_day = 0.0
        worst_day = 0.0
        most_active_day = 0
        day_win_rate = 0.0
        best_day_pct = 0.0

    # Direction (Long/Short %)
    # Simple count if column exists
    direction_counts = df.group_by("Direction").len()
    longs = direction_counts.filter(pl.col("Direction").str.to_lowercase().str.contains("long|buy"))
    shorts = direction_counts.filter(pl.col("Direction").str.to_lowercase().str.contains("short|sell"))
    
    # Fallback to simple generic logic if standard names not found
    long_count = longs['len'].sum() if len(longs) > 0 else 0
    short_count = shorts['len'].sum() if len(shorts) > 0 else 0
    
    long_pct = (long_count / total_trades * 100) if total_trades > 0 else 0
    short_pct = (short_count / total_trades * 100) if total_trades > 0 else 0

    return {
        "summary": {
            "total_pnl": round(total_pnl or 0.0, 2),
            "gross_pnl": round(gross_pnl or 0.0, 2),
            "total_fees": round(total_fees or 0.0, 2),
            "win_rate": round(win_rate or 0.0, 2),
            "total_trades": total_trades,
            "profit_factor": round(profit_factor or 0.0, 2),
            "expected_value": round(expected_value or 0.0, 2),
            "avg_win": round(avg_win or 0.0, 2),
            "avg_loss": round(avg_loss or 0.0, 2),
            "best_trade": round(best_trade or 0.0, 2),
            "worst_trade": round(worst_trade or 0.0, 2),
            "best_trade_net": round(best_trade_net or 0.0, 2),
            "worst_trade_net": round(worst_trade_net or 0.0, 2),
        },
        "duration": {
            "avg_duration": round(avg_duration or 0.0, 2),
            "avg_win_duration": round(avg_win_duration or 0.0, 2),
            "avg_loss_duration": round(avg_loss_duration or 0.0, 2),
        },
        "daily": {
            "day_win_rate": round(day_win_rate or 0.0, 2),
            "best_day": round(best_day or 0.0, 2),
            "worst_day": round(worst_day or 0.0, 2),
            "most_active_day_trades": most_active_day,
            "best_day_pct_total": round(best_day_pct or 0.0, 2)
        },
        "direction": {
            "long_pct": round(long_pct or 0.0, 2),
            "short_pct": round(short_pct or 0.0, 2)
        }
    }

def prepare_charts_data(df: pl.DataFrame) -> Dict[str, Any]:
    # 1. Daily/Cumulative PnL (Line & Bar) - Use NetPnL
    daily_agg = df.group_by('Date').agg([
        pl.col('NetPnL').sum().alias('DailyPnL'),
        pl.col('PnL').count().alias('TradeCount')
    ]).sort('Date')
    daily_agg = daily_agg.with_columns(pl.col('DailyPnL').cum_sum().alias('CumulativePnL'))
    
    # Convert dates to string for JSON serialization
    daily_pnl_data = daily_agg.select([
        pl.col('Date').dt.to_string("%Y-%m-%d").alias('Date'), 
        'DailyPnL', 
        'CumulativePnL',
        'TradeCount'
    ]).to_dicts()
    
    # 2. Trade Duration Distribution & Win Rate Analysis
    duration_buckets = [
        (0, 15, "Under 15 sec"),
        (15, 45, "15-45 sec"),
        (45, 60, "45 sec - 1 min"),
        (60, 120, "1 min - 2 min"),
        (120, 300, "2 min - 5 min"),
        (300, 600, "5 min - 10 min"),
        (600, 1800, "10 min - 30 min"),
        (1800, 3600, "30 min - 1 hour"),
        (3600, 7200, "1 hour - 2 hours"),
        (7200, 14400, "2 hours - 4 hours"),
        (14400, float('inf'), "4 hours and up")
    ]
    
    distribution_data = []
    for min_sec, max_sec, label in duration_buckets:
        subset = df.filter(
            (pl.col('Duration') >= min_sec) & 
            (pl.col('Duration') < max_sec)
        )
        count = len(subset)
        if count > 0:
            wins = len(subset.filter(pl.col('NetPnL') > 0))
            win_rate = (wins / count) * 100
        else:
            win_rate = 0.0
            
        distribution_data.append({
            "range": label,
            "count": count,
            "win_rate": round(win_rate, 1)
        })

    # Legacy scatter data for completeness
    duration_scatter = df.filter(
        (pl.col('Duration') > 0) & (pl.col('Duration') < 86400)
    ).select(['Duration', 'NetPnL']).to_dicts()

    return {
        "daily_pnl": daily_pnl_data,
        "duration_scatter": duration_scatter,
        "duration_distribution": distribution_data
    }
