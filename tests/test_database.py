"""
Unit tests for the SQLite database layer.

Uses a temporary in-memory approach by patching the DB path to
a temp file so tests don't interfere with production data.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Ensure backend modules are importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import core.database as db


# Sample trade data for testing
def _sample_trade(idx=1):
    return {
        "symbol": f"MNQH26",
        "base_symbol": "MNQ",
        "direction": "Long",
        "entry_datetime": f"2026-02-{10 + idx:02d} 14:09:50",
        "exit_datetime": f"2026-02-{10 + idx:02d} 14:11:17",
        "entry_price": 25293.25,
        "exit_price": 25291.50,
        "quantity": 4,
        "pnl": -14.0 * idx,
        "commission": 0.0,
        "net_pnl": -14.0 * idx,
        "max_open_profit": 62.0,
        "max_open_loss": -14.0,
        "duration_seconds": 86.0,
        "note": "Parent order",
        "fill_count": 4,
        "point_value": 2.0,
        "tick_size": 0.25,
        "tick_value": 0.50,
        "import_hash": f"hash_{idx}",
    }


class TestDatabase(unittest.TestCase):
    """Test the database layer with a temporary database file."""

    def setUp(self):
        """Create a temporary DB for each test."""
        self.tmp_dir = tempfile.mkdtemp()
        self.tmp_db = Path(self.tmp_dir) / "test_trades.db"
        # Patch the module-level DB path
        self._patcher_dir = patch.object(db, '_DB_DIR', Path(self.tmp_dir))
        self._patcher_path = patch.object(db, '_DB_PATH', self.tmp_db)
        self._patcher_dir.start()
        self._patcher_path.start()
        db.init_db()

    def tearDown(self):
        """Clean up the temp DB."""
        self._patcher_dir.stop()
        self._patcher_path.stop()
        if self.tmp_db.exists():
            os.remove(self.tmp_db)
        # Clean up WAL/SHM files
        for suffix in ["-wal", "-shm"]:
            wal = Path(str(self.tmp_db) + suffix)
            if wal.exists():
                os.remove(wal)
        os.rmdir(self.tmp_dir)

    def test_insert_and_retrieve(self):
        """Trades should round-trip through insert and get_all."""
        trades = [_sample_trade(1), _sample_trade(2)]
        result = db.insert_trades(trades)
        self.assertEqual(result["inserted"], 2)
        self.assertEqual(result["skipped"], 0)

        all_trades = db.get_all_trades()
        self.assertEqual(len(all_trades), 2)

    def test_duplicate_skipping(self):
        """Re-inserting the same trades should skip them."""
        trades = [_sample_trade(1)]
        db.insert_trades(trades)
        result = db.insert_trades(trades)
        self.assertEqual(result["inserted"], 0)
        self.assertEqual(result["skipped"], 1)

        all_trades = db.get_all_trades()
        self.assertEqual(len(all_trades), 1)

    def test_update_tags(self):
        """Tag updates should persist."""
        db.insert_trades([_sample_trade(1)])
        all_trades = db.get_all_trades()
        trade_id = all_trades[0]["id"]

        db.update_trade_tags(trade_id, setup_tag="Breakout")
        trade = db.get_trade_by_id(trade_id)
        self.assertEqual(trade["setup_tag"], "Breakout")

        db.update_trade_tags(trade_id, additional_tag="Scalp")
        trade = db.get_trade_by_id(trade_id)
        self.assertEqual(trade["additional_tag"], "Scalp")
        # Previous tag should still be there
        self.assertEqual(trade["setup_tag"], "Breakout")

    def test_update_metadata(self):
        """Metadata updates should persist."""
        db.insert_trades([_sample_trade(1)])
        all_trades = db.get_all_trades()
        trade_id = all_trades[0]["id"]

        db.update_trade_metadata(trade_id, setup_rating=5, comments="Good trade")
        trade = db.get_trade_by_id(trade_id)
        self.assertEqual(trade["setup_rating"], 5)
        self.assertEqual(trade["comments"], "Good trade")

    def test_merge(self):
        """Merging should create a new trade and delete originals."""
        db.insert_trades([_sample_trade(1), _sample_trade(2), _sample_trade(3)])
        all_trades = db.get_all_trades()
        self.assertEqual(len(all_trades), 3)

        ids = [all_trades[0]["id"], all_trades[1]["id"]]
        merged = db.merge_trades(ids)

        self.assertIsNotNone(merged)
        self.assertEqual(merged["is_merged"], 1)

        remaining = db.get_all_trades()
        self.assertEqual(len(remaining), 2)

        # P/L should be sum of merged trades
        expected_pnl = round(all_trades[0]["pnl"] + all_trades[1]["pnl"], 2)
        self.assertEqual(merged["pnl"], expected_pnl)

    def test_delete(self):
        """Deleted trades should no longer appear."""
        db.insert_trades([_sample_trade(1)])
        all_trades = db.get_all_trades()
        trade_id = all_trades[0]["id"]

        success = db.delete_trade(trade_id)
        self.assertTrue(success)
        self.assertEqual(len(db.get_all_trades()), 0)

    def test_delete_nonexistent(self):
        """Deleting a non-existent trade should return False."""
        success = db.delete_trade(99999)
        self.assertFalse(success)


if __name__ == "__main__":
    unittest.main()
