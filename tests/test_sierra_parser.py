"""
Unit tests for the Sierra Chart TradesList parser.

Tests parsing, F2F aggregation, and edge cases using the actual
sample data file.
"""

import io
import os
import sys
import unittest
from pathlib import Path

# Ensure backend modules are importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.sierra_parser import (
    _clean_datetime,
    _clean_numeric,
    _extract_base_symbol,
    _parse_duration,
    parse_sierra_trades,
)


# Path to the sample Sierra Chart export
SAMPLE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "TradesList(sierra).txt"


class TestHelpers(unittest.TestCase):
    """Test internal helper functions."""

    def test_extract_base_symbol(self):
        self.assertEqual(_extract_base_symbol("MNQH26 (19850621)"), "MNQ")
        self.assertEqual(_extract_base_symbol("MNQH26"), "MNQ")
        self.assertEqual(_extract_base_symbol("NQH26 (19850621)"), "NQ")
        self.assertEqual(_extract_base_symbol("NQH26"), "NQ")
        self.assertEqual(_extract_base_symbol("ESZ25"), "ES")

    def test_clean_datetime(self):
        self.assertEqual(
            _clean_datetime("2026-02-10  14:09:50.516 BP"),
            "2026-02-10 14:09:50"
        )
        self.assertEqual(
            _clean_datetime("2026-02-10  14:11:17.343"),
            "2026-02-10 14:11:17"
        )
        self.assertEqual(
            _clean_datetime("2026-02-10  14:33:45.472 EP"),
            "2026-02-10 14:33:45"
        )

    def test_clean_numeric(self):
        self.assertEqual(_clean_numeric("1200.00 F"), 1200.0)
        self.assertEqual(_clean_numeric("-3.50"), -3.5)
        self.assertEqual(_clean_numeric(""), None)
        self.assertEqual(_clean_numeric("-14.00 F"), -14.0)

    def test_parse_duration(self):
        self.assertEqual(_parse_duration("00:01:26"), 86.0)
        self.assertEqual(_parse_duration("00:22:19"), 1339.0)
        self.assertEqual(_parse_duration(""), 0.0)


class TestParseSierraFile(unittest.TestCase):
    """Test parsing the actual sample file."""

    @unittest.skipUnless(SAMPLE_FILE.exists(), "Sample file not found")
    def test_parse_produces_trades(self):
        """Parser should return a non-empty list of trades."""
        trades = parse_sierra_trades(SAMPLE_FILE)
        self.assertGreater(len(trades), 0)

    @unittest.skipUnless(SAMPLE_FILE.exists(), "Sample file not found")
    def test_f2f_aggregation_count(self):
        """
        The sample file has F2F markers.  Verify that
        individual fills are aggregated into fewer F2F trades.
        """
        trades = parse_sierra_trades(SAMPLE_FILE)
        # The file has ~44 fill rows but should produce significantly
        # fewer F2F trades.  Count the 'F' markers in the file to
        # determine the expected count.
        with open(SAMPLE_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        # Count lines ending with 'F' in the F2F P/L column
        f2f_count = content.count(" F\t")
        # Each ' F\t' marks one F2F trade end (tabs follow the field)
        # Also count lines ending with ' F\r' for last columns
        f2f_count += content.count(" F\r")
        # Should be close to the number of trades
        self.assertGreaterEqual(f2f_count, len(trades) - 2)
        self.assertLessEqual(len(trades), f2f_count + 2)

    @unittest.skipUnless(SAMPLE_FILE.exists(), "Sample file not found")
    def test_trade_fields_present(self):
        """Each trade dict should contain all required fields."""
        trades = parse_sierra_trades(SAMPLE_FILE)
        required_keys = [
            "symbol", "direction", "entry_datetime", "exit_datetime",
            "entry_price", "exit_price", "quantity", "pnl",
            "commission", "duration_seconds", "import_hash",
        ]
        for trade in trades:
            for key in required_keys:
                self.assertIn(key, trade, f"Missing key '{key}' in trade")

    @unittest.skipUnless(SAMPLE_FILE.exists(), "Sample file not found")
    def test_both_instruments_present(self):
        """Both MNQ and NQ trades should be present."""
        trades = parse_sierra_trades(SAMPLE_FILE)
        symbols = {t["base_symbol"] for t in trades}
        self.assertIn("MNQ", symbols)
        self.assertIn("NQ", symbols)

    @unittest.skipUnless(SAMPLE_FILE.exists(), "Sample file not found")
    def test_import_hashes_unique(self):
        """Each F2F trade should have a unique import hash."""
        trades = parse_sierra_trades(SAMPLE_FILE)
        hashes = [t["import_hash"] for t in trades]
        self.assertEqual(len(hashes), len(set(hashes)))


class TestParseSierraEdgeCases(unittest.TestCase):
    """Test edge cases and error handling."""

    def test_empty_file(self):
        with self.assertRaises(ValueError):
            parse_sierra_trades(io.BytesIO(b""))

    def test_header_only(self):
        header = (
            "Symbol\tTrade Type\tEntry DateTime\tExit DateTime\t"
            "Entry Price\tExit Price\tTrade Quantity\tMax Open Quantity\t"
            "Max Closed Quantity\tProfit/Loss (C)\tCumulative Profit/Loss (C)\t"
            "FlatToFlat Profit/Loss (C)\tFlatToFlat Max Open Profit (C)\t"
            "FlatToFlat Max Open Loss (C)\tMax Open Profit (C)\t"
            "Max Open Loss (C)\tEntry Efficiency\tExit Efficiency\t"
            "Total Efficiency\tCommission (C)\tHigh Price While Open\t"
            "Low Price While Open\tNote\tOpen Position Quantity\t"
            "Close Position Quantity\tDuration\tAccount\t"
            "Highest Cumulative P/L (C)\tLowest Cumulative P/L (C)\t"
            "Maximum Runup (C)\tMaximum Drawdown (C)\r\n"
        )
        with self.assertRaises(ValueError):
            parse_sierra_trades(io.BytesIO(header.encode("utf-8")))

    def test_missing_columns(self):
        bad_header = "Symbol\tTrade Type\tSomething\r\n"
        with self.assertRaises(ValueError):
            parse_sierra_trades(io.BytesIO(bad_header.encode("utf-8")))


if __name__ == "__main__":
    unittest.main()
