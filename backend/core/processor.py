import polars as pl
from typing import Dict, Any, BinaryIO
import io

def process_csv(file: BinaryIO) -> Dict[str, Any]:
    try:
        # Read the file content into bytes
        content = file.read()
        
        # Try different encodings
        try:
            df = pl.read_csv(io.BytesIO(content), try_parse_dates=False)
        except:
            # Fallback for common encoding issues
            df = pl.read_csv(io.BytesIO(content), encoding='latin-1', try_parse_dates=False)

        # 1. Normalize Columns
        cols_lower = {c.lower(): c for c in df.columns}
        
        # Identify standard indices
        pnl_candidates = ['pnl', 'profit', 'net profit', 'net_profit', 'pl', 'amount']
        date_candidates = ['date', 'exit date', 'close date', 'time', 'close time', 'exitedat', 'trade day', 'tradeday', 'enteredat']
        symbol_candidates = ['symbol', 'ticker', 'instrument', 'asset', 'contractname', 'contract']
        dur_candidates = ['duration', 'holding time', 'tradeduration', 'trade duration', 'trade_duration']
        dir_candidates = ['direction', 'type', 'side']
        fees_candidates = ['fees', 'fee', 'commission', 'commissions', 'cost']
        size_candidates = ['size', 'quantity', 'qty', 'volume', 'amount_pos', 'contracts', 'shares']
        entered_candidates = ['enteredat', 'entered at', 'entry time', 'open time', 'formatted_entry_time']
        exited_candidates = ['exitedat', 'exited at', 'exit time', 'close time', 'formatted_exit_time']

        found_cols = {}
        
        def find_best(candidates, exclude_cols=None):
            for c in candidates:
                if c in cols_lower:
                    actual = cols_lower[c]
                    if not exclude_cols or actual not in exclude_cols:
                        return actual
            return None

        # Priority mapping
        pnl_col = find_best(pnl_candidates)
        date_col = find_best(date_candidates)
        symbol_col = find_best(symbol_candidates)
        fees_col = find_best(fees_candidates)
        size_col = find_best(size_candidates, exclude_cols=[pnl_col] if pnl_col else [])
        duration_col = find_best(dur_candidates)
        direction_col = find_best(dir_candidates)
        entered_candidates = ['entered', 'entry date', 'entry_date', 'entry_time', 'open_time', 'open time', 'start_date', 'start date', 'entry', 'entrydate']
        exited_candidates = ['exited', 'exit date', 'exit_date', 'exit_time', 'close_time', 'close time', 'end_date', 'end date', 'exit', 'exitdate']
        strategy_candidates = ['strategy', 'strategy tag', 'strategy_tag', 'setup 2', 'tag 2', 'additional tag', 'type', 'additional_tag', 'additionaltag']

        entry_date_col = find_best(entered_candidates)
        exit_date_col = find_best(exited_candidates)
        strategy_tag_col = find_best(strategy_candidates)

        # Build transformations
        transforms = []
        if pnl_col: transforms.append(pl.col(pnl_col).alias('PnL'))
        if date_col: transforms.append(pl.col(date_col).alias('Date'))
        if symbol_col: transforms.append(pl.col(symbol_col).alias('Symbol'))
        if fees_col: transforms.append(pl.col(fees_col).alias('Fees'))
        if size_col: transforms.append(pl.col(size_col).alias('Size'))
        if direction_col: transforms.append(pl.col(direction_col).alias('Direction'))
        
        # Preserve original string for EntryDate/ExitDate to keep time if available
        # Strip timezone offset (e.g., +01:00) for cleaner display
        if entry_date_col: 
            transforms.append(pl.col(entry_date_col).cast(pl.Utf8).str.replace(r"\s*[\+\-]\d{2}:?\d{2}$", "").alias('EntryDate'))
        if exit_date_col: 
            transforms.append(pl.col(exit_date_col).cast(pl.Utf8).str.replace(r"\s*[\+\-]\d{2}:?\d{2}$", "").alias('ExitDate'))
        if duration_col: transforms.append(pl.col(duration_col).alias('Duration_Raw'))
        if strategy_tag_col: transforms.append(pl.col(strategy_tag_col).alias('Additional Tag'))

        # Add temporary columns for calculation
        if entry_date_col:
            transforms.append(pl.col(entry_date_col).alias('_EnteredRaw'))
        if exit_date_col:
            transforms.append(pl.col(exit_date_col).alias('_ExitedRaw'))

        df = df.with_columns(transforms)

        if 'PnL' not in df.columns or 'Date' not in df.columns:
             raise ValueError("CSV must contain at least 'Date' & 'Profit/PnL' columns.")

        # Handle Date Parsing
        # Common format: "MM/DD/YYYY ..." or "YYYY-MM-DD ..."
        df = df.with_columns([
            pl.col('Date').str.split(" ").list.get(0).str.strptime(pl.Date, "%m/%d/%Y", strict=False).alias('_Date_MDY'),
            pl.col('Date').str.split(" ").list.get(0).str.strptime(pl.Date, "%Y-%m-%d", strict=False).alias('_Date_YMD'),
        ])
        
        # Handle Date Parsing
        # Keep original 'Date' as string for display (preserving time)
        # Create a parsed date column for internal grouping/filtering
        df = df.with_columns([
            pl.col('Date').str.split(" ").list.get(0).str.strptime(pl.Date, "%m/%d/%Y", strict=False).alias('_Date_MDY'),
            pl.col('Date').str.split(" ").list.get(0).str.strptime(pl.Date, "%Y-%m-%d", strict=False).alias('_Date_YMD'),
        ])
        
        df = df.with_columns(
            pl.coalesce(['_Date_MDY', '_Date_YMD', 'Date']).cast(pl.Date, strict=False).alias('Date_Obj')
        ).drop(['_Date_MDY', '_Date_YMD'])

        # Ensure Date column itself is a string to prevent JSON stripping of time
        # Strip timezone offset (e.g., +01:00) for cleaner display
        df = df.with_columns(
            pl.col('Date').cast(pl.Utf8).str.replace(r"\s*[\+\-]\d{2}:?\d{2}$", "").alias('Date')
        )

        # Drop rows where Date is invalid/null
        df = df.drop_nulls(['Date'])

        # Numeric Columns
        df = df.with_columns([
            pl.col('PnL').cast(pl.Float64, strict=False).fill_null(0.0),
            pl.col('Fees').cast(pl.Float64, strict=False).fill_null(0.0) if 'Fees' in df.columns else pl.lit(0.0).alias('Fees'),
            pl.col('Size').cast(pl.Float64, strict=False).fill_null(0.0) if 'Size' in df.columns else pl.lit(0.0).alias('Size'),
        ])

        # Handle Duration Calculation
        # Format example: "10/01/2025 14:47:55 +01:00"
        # We need to parse this for entered/exited time to get seconds
        # Handle Duration Calculation
        if '_EnteredRaw' in df.columns and '_ExitedRaw' in df.columns:
            # Try multiple formats for datetime parsing
            date_formats = [
                '%m/%d/%Y %H:%M:%S %z',  # With seconds and timezone
                '%m/%d/%Y %H:%M:%S',     # With seconds
                '%m/%d/%Y %H:%M',        # Without seconds
                '%Y-%m-%d %H:%M:%S',     # ISO-like with seconds
                '%Y-%m-%d %H:%M',        # ISO-like without seconds
                '%Y/%m/%d %H:%M:%S',
            ]
            
            entered_dt = None
            exited_dt = None
            
            for fmt in date_formats:
                try:
                    # Check if we successfully parsed at least some rows
                    e_test = df['_EnteredRaw'].str.strptime(pl.Datetime, fmt, strict=False)
                    x_test = df['_ExitedRaw'].str.strptime(pl.Datetime, fmt, strict=False)
                    
                    if e_test.null_count() < len(df) * 0.5: # If more than 50% parsed
                        df = df.with_columns([
                            e_test.alias('_EntryDT'),
                            x_test.alias('_ExitDT')
                        ])
                        # Calculate duration in seconds
                        df = df.with_columns(
                            ((pl.col('_ExitDT') - pl.col('_EntryDT')).dt.total_seconds()).alias('Duration')
                        )
                        break
                except:
                    continue

        # Fallback for Duration from string column (like "0:00:36")
        if ('Duration' not in df.columns or df['Duration'].null_count() == len(df)) and 'Duration_Raw' in df.columns:
            try:
                def parse_hms(s):
                    if not s or not isinstance(s, str): return 0.0
                    parts = s.split(':')
                    try:
                        if len(parts) == 3:
                            return float(parts[0])*3600 + float(parts[1])*60 + float(parts[2])
                        elif len(parts) == 2:
                            return float(parts[0])*60 + float(parts[1])
                    except:
                        pass
                    return 0.0
                
                df = df.with_columns(
                    pl.col('Duration_Raw').map_elements(parse_hms, return_dtype=pl.Float64).alias('Duration')
                )
            except Exception as e:
                print(f"Fallback duration calculation failed: {e}")

        # Final Duration Cleanup
        if 'Duration' not in df.columns:
            df = df.with_columns(pl.lit(0.0).alias('Duration'))
        # Add internal helper columns for frontend aggregation
        df = df.with_columns(
            pl.col('Date_Obj').dt.to_string("%Y-%m-%d").alias('Day')
        ).with_row_index("_row_id")

        # Cleanup temporary columns
        cols_to_drop = ['_EnteredRaw', '_ExitedRaw', '_EntryDT', '_ExitDT', 'Duration_Raw']
        df = df.drop([c for c in cols_to_drop if c in df.columns])

        # Calculate Net PnL (PnL - Fees)
        df = df.with_columns(
            (pl.col('PnL') - pl.col('Fees')).alias('NetPnL')
        )
        
        # Ensure Direction (Long/Short) exists
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
    daily_df = df.group_by('Date_Obj').agg([
        pl.col('NetPnL').sum().alias('DailyPnL'),
        pl.col('PnL').count().alias('TradeCount'),
        (pl.col('PnL') > 0).sum().alias('WinCount')
    ]).rename({'Date_Obj': 'Date'}).sort('Date')
    
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
    daily_agg = df.group_by('Date_Obj').agg([
        pl.col('NetPnL').sum().alias('DailyPnL'),
        pl.col('PnL').count().alias('TradeCount')
    ]).rename({'Date_Obj': 'Date'}).sort('Date')
    
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
