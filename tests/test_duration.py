import polars as pl

df = pl.read_csv('data/trades_export.csv')
dur = df.select(pl.col('TradeDuration').str.strptime(pl.Time, '%H:%M:%S%.f', strict=False).alias('Time'))
dur_sec = dur.with_columns(
    (pl.col('Time').dt.hour() * 3600 + 
     pl.col('Time').dt.minute() * 60 + 
     pl.col('Time').dt.second() + 
     pl.col('Time').dt.nanosecond() / 1e9).alias('Seconds')
)

filtered = dur_sec.filter(pl.col('Seconds') > 0)
avg_all = dur_sec['Seconds'].mean()
avg_filtered = filtered['Seconds'].mean()
median = dur_sec['Seconds'].median()

print(f'Mean (all): {avg_all:.2f}s = {int(avg_all//60)}m {int(avg_all%60)}s')
print(f'Mean (positive only): {avg_filtered:.2f}s = {int(avg_filtered//60)}m {int(avg_filtered%60)}s')
print(f'Median: {median:.2f}s = {int(median//60)}m {int(median%60)}s')
print(f'\nNegative durations: {len(dur_sec.filter(pl.col("Seconds") < 0))}')
print(f'Positive durations: {len(filtered)}')
print(f'Total: {len(dur_sec)}')
