"""
Parser for Sierra Chart ``TradeStatistics.txt`` export files.

The file is a tab-separated text document produced by Sierra Chart's
"Trade Statistics" window.  Each data row has the format:

    Metric Name<TAB>All Trades<TAB>Long Trades<TAB>Short Trades<TAB>Daily Trades

This module extracts the 20 most important metrics **not** already
displayed on the main Stats Overview tab (Tab 1), including MFE, MAE,
drawdown, consecutive streaks, concentration metrics, and F2F averages.
"""

from __future__ import annotations

import io
from typing import IO, Union


# ---------------------------------------------------------------------------
# Column indices (after metric label is stripped)
# ---------------------------------------------------------------------------

_COL_ALL = 0
_COL_LONG = 1
_COL_SHORT = 2


# ---------------------------------------------------------------------------
# Mapping: raw line label → internal key
# ---------------------------------------------------------------------------

#: All 20 metric labels to extract from the file.
_METRIC_KEYS: dict[str, str] = {
    # --- Excursion (MFE / MAE) ---
    "Maximum Trade Open Profit":          "mfe",
    "Maximum Trade Open Loss":            "mae",
    "Average Winning Trade Open Profit":  "avg_mfe_winners",
    "Average Losing Trade Open Loss":     "avg_mae_losers",

    # --- Equity curve ---
    "Maximum Drawdown":                   "max_drawdown",
    "Maximum Runup":                      "max_runup",
    "Highest Cumulative Profit":          "highest_cum_profit",
    "Lowest Cumulative Loss":             "lowest_cum_loss",

    # --- Gross P&L breakdown ---
    "Closed Trades Total Profit":         "closed_profit",
    "Closed Trades Total Loss":           "closed_loss",

    # --- Trade averages ---
    "Average Trade Profit/Loss":          "avg_trade_pl",
    "Average FlatToFlat Trade Profit/Loss": "avg_f2f_pl",
    "Average FlatToFlat Winning Trade":   "avg_f2f_winning",
    "Average FlatToFlat Losing Trade":    "avg_f2f_losing",

    # --- FlatToFlat quality ---
    "FlatToFlat Percent Profitable":      "f2f_win_rate",
    "Average FlatToFlat Profit Factor":   "f2f_profit_factor",

    # --- Consecutive streaks ---
    "Max Consecutive Winners":            "max_consecutive_winners",
    "Max Consecutive Losers":             "max_consecutive_losers",

    # --- Concentration risk ---
    "Largest Winner % of Profit":         "largest_winner_pct",
    "Largest Loser % of Loss":            "largest_loser_pct",
}

#: Human-readable display names for each internal key.
DISPLAY_NAMES: dict[str, str] = {
    "mfe":                    "Max Favorable Excursion (MFE)",
    "mae":                    "Max Adverse Excursion (MAE)",
    "avg_mfe_winners":        "Avg MFE — Winners",
    "avg_mae_losers":         "Avg MAE — Losers",
    "max_drawdown":           "Maximum Drawdown",
    "max_runup":              "Maximum Runup",
    "highest_cum_profit":     "Highest Cumulative Profit",
    "lowest_cum_loss":        "Lowest Cumulative Loss",
    "closed_profit":          "Total Gross Profit",
    "closed_loss":            "Total Gross Loss",
    "avg_trade_pl":           "Avg Trade P&L",
    "avg_f2f_pl":             "Avg FlatToFlat P&L",
    "avg_f2f_winning":        "Avg F2F Winning Trade",
    "avg_f2f_losing":         "Avg F2F Losing Trade",
    "f2f_win_rate":           "FlatToFlat Win Rate",
    "f2f_profit_factor":      "FlatToFlat Profit Factor",
    "max_consecutive_winners": "Max Consecutive Winners",
    "max_consecutive_losers":  "Max Consecutive Losers",
    "largest_winner_pct":     "Largest Winner % of Profit",
    "largest_loser_pct":      "Largest Loser % of Loss",
}

# ---------------------------------------------------------------------------
# Metric type sets
# ---------------------------------------------------------------------------

#: Dollar-denominated metrics.
_CURRENCY_KEYS = {
    "mfe", "mae", "avg_mfe_winners", "avg_mae_losers",
    "max_drawdown", "max_runup", "highest_cum_profit", "lowest_cum_loss",
    "closed_profit", "closed_loss",
    "avg_trade_pl", "avg_f2f_pl", "avg_f2f_winning", "avg_f2f_losing",
}

#: Percentage metrics.
_PERCENT_KEYS = {
    "f2f_win_rate",
    "largest_winner_pct",
    "largest_loser_pct",
}

#: Integer count metrics.
_COUNT_KEYS = {
    "max_consecutive_winners",
    "max_consecutive_losers",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_value(raw: str) -> float | str:
    """
    Try to convert a raw cell string to a float.

    Strips ``%``, commas, and surrounding whitespace.  Returns the raw
    string unchanged when conversion fails.
    """
    if not raw:
        return 0.0
    cleaned = raw.strip().replace("%", "").replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return raw.strip()


def _fmt(val: float | str, key: str) -> str:
    """
    Format a parsed value for display.

    Parameters
    ----------
    val:
        Numeric value (or raw string fallback).
    key:
        Internal metric key — determines formatting rules.
    """
    if isinstance(val, str):
        return val

    if key in _CURRENCY_KEYS:
        return f"-${abs(val):.2f}" if val < 0 else f"${val:.2f}"
    if key in _PERCENT_KEYS:
        return f"{val:.2f}%"
    if key in _COUNT_KEYS:
        return str(int(val))
    return f"{val:.2f}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_trade_statistics(
    file_obj: Union[IO[bytes], IO[str], str, bytes],
) -> dict[str, dict]:
    """
    Parse a Sierra Chart ``TradeStatistics.txt`` file and return a
    structured dict with the 20 selected metrics.

    Parameters
    ----------
    file_obj:
        A file-like object, raw ``bytes``, or ``str`` containing the
        contents of ``TradeStatistics.txt``.

    Returns
    -------
    dict
        Keyed by internal metric name.  Each value is a sub-dict with:

        - ``key``         — internal key
        - ``label``       — human-readable display name
        - ``all``         — float for "All Trades" column
        - ``long``        — float for "Long Trades" column
        - ``short``       — float for "Short Trades" column
        - ``fmt_all``     — pre-formatted string for ``all``
        - ``fmt_long``    — pre-formatted string for ``long``
        - ``fmt_short``   — pre-formatted string for ``short``
        - ``is_currency`` — True for dollar-denominated metrics
        - ``is_percent``  — True for percentage metrics
        - ``is_count``    — True for integer-count metrics

    Raises
    ------
    ValueError
        If the file cannot be recognised as a ``TradeStatistics.txt``
        export (missing header line).
    """
    # ------------------------------------------------------------------ #
    # Normalise input to an iterable of str lines
    # ------------------------------------------------------------------ #
    if isinstance(file_obj, (bytes, bytearray)):
        lines: IO[str] = io.TextIOWrapper(
            io.BytesIO(file_obj), encoding="utf-8", errors="replace"
        )
    elif isinstance(file_obj, str):
        lines = io.StringIO(file_obj)
    else:
        try:
            raw = file_obj.read()
        except Exception as exc:
            raise ValueError(f"Cannot read file object: {exc}") from exc
        if isinstance(raw, bytes):
            lines = io.TextIOWrapper(
                io.BytesIO(raw), encoding="utf-8", errors="replace"
            )
        else:
            lines = io.StringIO(raw)

    result: dict[str, dict] = {}
    header_found = False

    for line in lines:
        line = line.rstrip("\r\n")

        # Detect the expected header
        if "Trade Statistics" in line and "Num Fills Filtered" in line:
            header_found = True
            continue

        parts = line.split("\t")
        if len(parts) < 2:
            continue

        metric_label = parts[0].strip()
        if metric_label not in _METRIC_KEYS:
            continue

        key = _METRIC_KEYS[metric_label]

        val_all   = _parse_value(parts[1]) if len(parts) > 1 else 0.0
        val_long  = _parse_value(parts[2]) if len(parts) > 2 else 0.0
        val_short = _parse_value(parts[3]) if len(parts) > 3 else 0.0

        result[key] = {
            "key":         key,
            "label":       DISPLAY_NAMES[key],
            "all":         val_all,
            "long":        val_long,
            "short":       val_short,
            "fmt_all":     _fmt(val_all,   key),
            "fmt_long":    _fmt(val_long,  key),
            "fmt_short":   _fmt(val_short, key),
            "is_currency": key in _CURRENCY_KEYS,
            "is_percent":  key in _PERCENT_KEYS,
            "is_count":    key in _COUNT_KEYS,
        }

    if not header_found:
        raise ValueError(
            "File does not appear to be a Sierra Chart TradeStatistics.txt export "
            "(missing 'Trade Statistics' header line)."
        )

    return result
