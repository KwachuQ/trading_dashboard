import sys
import os

# Add backend directory to path so we can import core
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from core.processor import process_csv

print("Starting debug of process_csv...")
with open('data/trades_export.csv', 'rb') as f:
    try:
        results = process_csv(f)
        print("Process completed.")
        stats = results.get('stats', {})
        duration = stats.get('duration', {})
        print(f"Avg Duration: {duration.get('avg_duration')}")
    except Exception as e:
        print(f"Process failed: {e}")
