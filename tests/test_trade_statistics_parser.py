"""
Unit tests for core.trade_statistics_parser.

Run from the project root with:
    cd backend && python -m pytest ../tests/test_trade_statistics_parser.py -v
"""

import sys
import os

# Ensure the backend package is importable when running from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from core.trade_statistics_parser import parse_trade_statistics

# Path to the sample file shipped with the project
SAMPLE_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "TradeStatistics.txt"
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def parsed():
    """Parse the real TradeStatistics.txt once for all tests in this module."""
    with open(SAMPLE_FILE, "r", encoding="utf-8", errors="replace") as fh:
        return parse_trade_statistics(fh)


# ---------------------------------------------------------------------------
# Completeness
# ---------------------------------------------------------------------------

class TestAllKeysPresent:
    """All 20 expected keys must be present in the output."""

    EXPECTED_KEYS = [
        # Excursion
        "mfe", "mae", "avg_mfe_winners", "avg_mae_losers",
        # Equity curve
        "max_drawdown", "max_runup", "highest_cum_profit", "lowest_cum_loss",
        # Gross P&L
        "closed_profit", "closed_loss", "avg_trade_pl", "avg_f2f_pl",
        # FlatToFlat quality
        "avg_f2f_winning", "avg_f2f_losing", "f2f_win_rate", "f2f_profit_factor",
        # Streaks & concentration
        "max_consecutive_winners", "max_consecutive_losers",
        "largest_winner_pct", "largest_loser_pct",
    ]

    def test_all_keys_present(self, parsed):
        """Every expected key must appear in the parsed output."""
        for key in self.EXPECTED_KEYS:
            assert key in parsed, f"Missing key: {key}"

    def test_each_metric_has_required_fields(self, parsed):
        """Each metric sub-dict must carry all required fields."""
        required_fields = {
            "key", "label", "all", "long", "short",
            "fmt_all", "fmt_long", "fmt_short",
            "is_currency", "is_percent", "is_count",
        }
        for key, metric in parsed.items():
            missing = required_fields - set(metric.keys())
            assert not missing, f"Key '{key}' missing fields: {missing}"


# ---------------------------------------------------------------------------
# MFE / MAE
# ---------------------------------------------------------------------------

class TestMFEAndMAE:
    """Maximum excursion values from the 'All Trades' column."""

    def test_mfe_all(self, parsed):
        """MFE All Trades == 1200.0."""
        assert parsed["mfe"]["all"] == pytest.approx(1200.0)

    def test_mae_all(self, parsed):
        """MAE All Trades == -400.0."""
        assert parsed["mae"]["all"] == pytest.approx(-400.0)

    def test_mfe_is_currency(self, parsed):
        """MFE is currency-denominated."""
        assert parsed["mfe"]["is_currency"] is True

    def test_mae_fmt_all_negative(self, parsed):
        """MAE formatted string for All Trades starts with '-$'."""
        assert parsed["mae"]["fmt_all"].startswith("-$")

    def test_mae_long(self, parsed):
        """MAE Long Trades == -40.0."""
        assert parsed["mae"]["long"] == pytest.approx(-40.0)

    def test_mae_short(self, parsed):
        """MAE Short Trades == -400.0."""
        assert parsed["mae"]["short"] == pytest.approx(-400.0)


# ---------------------------------------------------------------------------
# Equity curve metrics
# ---------------------------------------------------------------------------

class TestEquityCurve:
    """Drawdown, runup, and cumulative extremes."""

    def test_max_drawdown(self, parsed):
        """Maximum Drawdown (All) == -750.5."""
        assert parsed["max_drawdown"]["all"] == pytest.approx(-750.5)

    def test_max_runup(self, parsed):
        """Maximum Runup (All) == 1200.0."""
        assert parsed["max_runup"]["all"] == pytest.approx(1200.0)

    def test_highest_cum_profit(self, parsed):
        """Highest Cumulative Profit (All) == 1200.0."""
        assert parsed["highest_cum_profit"]["all"] == pytest.approx(1200.0)

    def test_lowest_cum_loss(self, parsed):
        """Lowest Cumulative Loss (All) == 0.0."""
        assert parsed["lowest_cum_loss"]["all"] == pytest.approx(0.0)

    def test_drawdown_is_currency(self, parsed):
        """Max Drawdown is currency-denominated."""
        assert parsed["max_drawdown"]["is_currency"] is True


# ---------------------------------------------------------------------------
# Gross P&L
# ---------------------------------------------------------------------------

class TestGrossPL:
    """Closed profit, closed loss, and trade averages."""

    def test_closed_profit_all(self, parsed):
        """Closed Trades Total Profit (All) == 1674.5."""
        assert parsed["closed_profit"]["all"] == pytest.approx(1674.5)

    def test_closed_loss_all(self, parsed):
        """Closed Trades Total Loss (All) == -1182.0."""
        assert parsed["closed_loss"]["all"] == pytest.approx(-1182.0)

    def test_avg_trade_pl_all(self, parsed):
        """Average Trade P&L (All) == 11.19."""
        assert parsed["avg_trade_pl"]["all"] == pytest.approx(11.19)

    def test_avg_f2f_pl_all(self, parsed):
        """Average FlatToFlat Trade P&L (All) == 25.92."""
        assert parsed["avg_f2f_pl"]["all"] == pytest.approx(25.92)

    def test_closed_profit_fmt_positive(self, parsed):
        """Closed profit fmt_all should start with '$'."""
        assert parsed["closed_profit"]["fmt_all"].startswith("$")


# ---------------------------------------------------------------------------
# FlatToFlat quality
# ---------------------------------------------------------------------------

class TestFlatToFlat:
    """FlatToFlat win rate, profit factor, and averages."""

    def test_f2f_win_rate_all(self, parsed):
        """FlatToFlat Win Rate (All) == 36.84."""
        assert parsed["f2f_win_rate"]["all"] == pytest.approx(36.84)

    def test_f2f_win_rate_is_percent(self, parsed):
        """FlatToFlat Win Rate is a percentage metric."""
        assert parsed["f2f_win_rate"]["is_percent"] is True

    def test_f2f_win_rate_fmt(self, parsed):
        """FlatToFlat Win Rate formatted value ends with '%'."""
        assert parsed["f2f_win_rate"]["fmt_all"].endswith("%")

    def test_avg_f2f_winning(self, parsed):
        """Average F2F Winning Trade (All) == 233.5."""
        assert parsed["avg_f2f_winning"]["all"] == pytest.approx(233.5)

    def test_avg_f2f_losing(self, parsed):
        """Average F2F Losing Trade (All) == -95.17."""
        assert parsed["avg_f2f_losing"]["all"] == pytest.approx(-95.17)


# ---------------------------------------------------------------------------
# Consecutive streaks
# ---------------------------------------------------------------------------

class TestConsecutiveStreaks:
    """Max consecutive winners / losers."""

    def test_max_consecutive_losers(self, parsed):
        """Max Consecutive Losers (All) == 17."""
        assert int(parsed["max_consecutive_losers"]["all"]) == 17

    def test_max_consecutive_winners(self, parsed):
        """Max Consecutive Winners (All) == 3."""
        assert int(parsed["max_consecutive_winners"]["all"]) == 3

    def test_consecutive_is_count(self, parsed):
        """Consecutive streak metrics are flagged as counts."""
        assert parsed["max_consecutive_losers"]["is_count"] is True
        assert parsed["max_consecutive_winners"]["is_count"] is True

    def test_consecutive_fmt_is_integer_string(self, parsed):
        """Consecutive metrics render as plain integers (no decimal)."""
        assert "." not in parsed["max_consecutive_losers"]["fmt_all"]


# ---------------------------------------------------------------------------
# Concentration risk
# ---------------------------------------------------------------------------

class TestConcentrationRisk:
    """Largest winner / loser as percentage of total P&L."""

    def test_largest_winner_pct_all(self, parsed):
        """Largest Winner % of Profit (All) == 71.66."""
        assert parsed["largest_winner_pct"]["all"] == pytest.approx(71.66)

    def test_largest_loser_pct_all(self, parsed):
        """Largest Loser % of Loss (All) == 33.84."""
        assert parsed["largest_loser_pct"]["all"] == pytest.approx(33.84)

    def test_largest_winner_is_percent(self, parsed):
        """Largest winner and loser metrics are percentage metrics."""
        assert parsed["largest_winner_pct"]["is_percent"] is True
        assert parsed["largest_loser_pct"]["is_percent"] is True


# ---------------------------------------------------------------------------
# Direction columns (long / short)
# ---------------------------------------------------------------------------

class TestDirectionColumns:
    """Verify long and short column values are correctly extracted."""

    def test_mfe_long(self, parsed):
        """MFE Long Trades == 94.5."""
        assert parsed["mfe"]["long"] == pytest.approx(94.5)

    def test_mfe_short(self, parsed):
        """MFE Short Trades == 1200.0."""
        assert parsed["mfe"]["short"] == pytest.approx(1200.0)

    def test_f2f_win_rate_long(self, parsed):
        """FlatToFlat Win Rate Long Trades == 12.5."""
        assert parsed["f2f_win_rate"]["long"] == pytest.approx(12.5)

    def test_f2f_win_rate_short(self, parsed):
        """FlatToFlat Win Rate Short Trades == 54.55."""
        assert parsed["f2f_win_rate"]["short"] == pytest.approx(54.55)

    def test_fmt_long_and_short_present(self, parsed):
        """fmt_long and fmt_short fields must be non-empty strings."""
        for key, m in parsed.items():
            assert isinstance(m["fmt_long"],  str) and m["fmt_long"],  \
                f"{key}.fmt_long is empty"
            assert isinstance(m["fmt_short"], str) and m["fmt_short"], \
                f"{key}.fmt_short is empty"


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestInvalidFile:
    """Parser must raise ValueError on unrecognised content."""

    def test_invalid_file_raises(self):
        """A random string raises ValueError (no header)."""
        with pytest.raises(ValueError, match="does not appear to be"):
            parse_trade_statistics("totally unrelated content\nno header here")

    def test_empty_file_raises(self):
        """An empty string raises ValueError."""
        with pytest.raises(ValueError):
            parse_trade_statistics("")

    def test_bytes_input_accepted(self):
        """Parser accepts raw bytes input without raising."""
        with open(SAMPLE_FILE, "rb") as fh:
            result = parse_trade_statistics(fh.read())
        assert "mfe" in result
