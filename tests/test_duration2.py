import polars as pl
from datetime import datetime

df = pl.read_csv('data/trades_export.csv')

# Parse EnteredAt and ExitedAt
df_times = df.with_columns([
    pl.col('EnteredAt').str.strptime(pl.Datetime, '%m/%d/%Y %H:%M:%S %z', strict=False).alias('Enter'),
    pl.col('ExitedAt').str.strptime(pl.Datetime, '%m/%d/%Y %H:%M:%S %z', strict=False).alias('Exit')
])

# Calculate duration in seconds
df_calc = df_times.with_columns(
    ((pl.col('Exit') - pl.col('Enter')).dt.total_seconds()).alias('CalcDuration')
)

avg_calc = df_calc['CalcDuration'].mean()
print(f'Calculated duration from timestamps: {avg_calc:.2f}s = {int(avg_calc//60)}m {int(avg_calc%60)}s')

# Compare with TradeDuration column
dur = df.select(pl.col('TradeDuration').str.strptime(pl.Time, '%H:%M:%S%.f', strict=False).alias('Time'))
dur_sec = dur.with_columns(
    (pl.col('Time').dt.hour() * 3600 + 
     pl.col('Time').dt.minute() * 60 + 
     pl.col('Time').dt.second() + 
     pl.col('Time').dt.nanosecond() / 1e9).alias('Seconds')
)
avg_column = dur_sec['Seconds'].mean()
print(f'TradeDuration column average: {avg_column:.2f}s = {int(avg_column//60)}m {int(avg_column%60)}s')

print(f'\nDifference: {avg_calc - avg_column:.2f}s')
