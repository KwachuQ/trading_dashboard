import io
import unittest
from core.processor import process_csv
import polars as pl
from datetime import date

class TestProcessor(unittest.TestCase):
    def test_basic_csv(self):
        csv_content = b"""Date,Symbol,Direction,Duration,PnL
2023-01-01,AAPL,Long,60,100.0
2023-01-02,GOOG,Short,120,-50.0
"""
        file_obj = io.BytesIO(csv_content)
        result = process_csv(file_obj)
        
        self.assertIn("stats", result)
        self.assertIn("charts", result)
        self.assertEqual(result["stats"]["summary"]["total_pnl"], 50.0)
        self.assertEqual(result["stats"]["summary"]["total_trades"], 2)
        self.assertEqual(result["stats"]["summary"]["win_rate"], 50.0)

    def test_column_mapping(self):
        # Time -> Date, Ticker -> Symbol, Type -> Direction, Profit -> PnL
        csv_content = b"""Time,Ticker,Type,Profit
2023-01-01,MSFT,Buy,200.0
"""
        file_obj = io.BytesIO(csv_content)
        result = process_csv(file_obj)
        
        self.assertEqual(result["stats"]["summary"]["total_pnl"], 200.0)
        self.assertEqual(result["stats"]["summary"]["total_trades"], 1)

    def test_missing_required_columns(self):
        csv_content = b"""Date,Symbol,Something
2023-01-01,AAPL,100
"""
        file_obj = io.BytesIO(csv_content)
        with self.assertRaisesRegex(ValueError, "must contain at least"):
            process_csv(file_obj)

if __name__ == '__main__':
    unittest.main()
