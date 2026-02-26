"""
SQLite database layer for the trading dashboard.

Provides persistent storage for trades, tags, and metadata.
The database file is stored in the project's ``data/`` directory
by default.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DB_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DB_PATH = _DB_DIR / "trades.db"


def _get_connection() -> sqlite3.Connection:
    """Return a new connection to the SQLite database."""
    _DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create tables if they do not already exist."""
    conn = _get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS trades (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol          TEXT    NOT NULL,
                base_symbol     TEXT    NOT NULL,
                direction       TEXT    NOT NULL,
                entry_datetime  TEXT    NOT NULL,
                exit_datetime   TEXT    NOT NULL,
                entry_price     REAL    NOT NULL DEFAULT 0.0,
                exit_price      REAL    NOT NULL DEFAULT 0.0,
                quantity        INTEGER NOT NULL DEFAULT 1,
                pnl             REAL    NOT NULL DEFAULT 0.0,
                commission      REAL    NOT NULL DEFAULT 0.0,
                net_pnl         REAL    NOT NULL DEFAULT 0.0,
                max_open_profit REAL    NOT NULL DEFAULT 0.0,
                max_open_loss   REAL    NOT NULL DEFAULT 0.0,
                duration_seconds REAL   NOT NULL DEFAULT 0.0,
                note            TEXT    NOT NULL DEFAULT '',
                fill_count      INTEGER NOT NULL DEFAULT 1,
                point_value     REAL    NOT NULL DEFAULT 1.0,
                tick_size       REAL    NOT NULL DEFAULT 0.01,
                tick_value      REAL    NOT NULL DEFAULT 0.01,
                import_hash     TEXT    NOT NULL DEFAULT '',
                is_merged       INTEGER NOT NULL DEFAULT 0,
                merge_source_ids TEXT   NOT NULL DEFAULT '',
                setup_tag       TEXT    NOT NULL DEFAULT '',
                additional_tag  TEXT    NOT NULL DEFAULT '',
                setup_rating    INTEGER,
                comments        TEXT    NOT NULL DEFAULT '',
                created_at      TEXT    NOT NULL
                                    DEFAULT (datetime('now')),
                updated_at      TEXT    NOT NULL
                                    DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_trades_import_hash
                ON trades(import_hash);

            CREATE INDEX IF NOT EXISTS idx_trades_entry_dt
                ON trades(entry_datetime);

            CREATE INDEX IF NOT EXISTS idx_trades_symbol
                ON trades(symbol);
        """)
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Import / Insert
# ---------------------------------------------------------------------------

def check_import_exists(import_hash: str) -> bool:
    """Return True if a trade with the given hash already exists."""
    conn = _get_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM trades WHERE import_hash = ? LIMIT 1",
            (import_hash,),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def insert_trades(
    trades: List[Dict[str, Any]],
    skip_duplicates: bool = True,
) -> Dict[str, Any]:
    """
    Insert a list of trade dicts into the database.

    Parameters
    ----------
    trades : list[dict]
        Trade dictionaries from the Sierra parser.
    skip_duplicates : bool
        If True, silently skip trades whose import_hash already exists.

    Returns
    -------
    dict
        Summary with ``inserted``, ``skipped``, and ``total`` counts.
    """
    conn = _get_connection()
    inserted = 0
    skipped = 0

    try:
        for trade in trades:
            imp_hash = trade.get("import_hash", "")

            if skip_duplicates and imp_hash:
                exists = conn.execute(
                    "SELECT 1 FROM trades WHERE import_hash = ? LIMIT 1",
                    (imp_hash,),
                ).fetchone()
                if exists:
                    skipped += 1
                    continue

            conn.execute("""
                INSERT INTO trades (
                    symbol, base_symbol, direction,
                    entry_datetime, exit_datetime,
                    entry_price, exit_price, quantity,
                    pnl, commission, net_pnl,
                    max_open_profit, max_open_loss,
                    duration_seconds, note, fill_count,
                    point_value, tick_size, tick_value,
                    import_hash
                ) VALUES (
                    :symbol, :base_symbol, :direction,
                    :entry_datetime, :exit_datetime,
                    :entry_price, :exit_price, :quantity,
                    :pnl, :commission, :net_pnl,
                    :max_open_profit, :max_open_loss,
                    :duration_seconds, :note, :fill_count,
                    :point_value, :tick_size, :tick_value,
                    :import_hash
                )
            """, trade)
            inserted += 1

        conn.commit()
    finally:
        conn.close()

    return {"inserted": inserted, "skipped": skipped,
            "total": inserted + skipped}


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

def get_all_trades() -> List[Dict[str, Any]]:
    """Return all trades as a list of dictionaries, ordered by entry time."""
    conn = _get_connection()
    try:
        rows = conn.execute("""
            SELECT * FROM trades
            ORDER BY entry_datetime ASC
        """).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_trade_by_id(trade_id: int) -> Optional[Dict[str, Any]]:
    """Return a single trade by its ID."""
    conn = _get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM trades WHERE id = ?", (trade_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def update_trade_tags(
    trade_id: int,
    setup_tag: Optional[str] = None,
    additional_tag: Optional[str] = None,
) -> bool:
    """Update tags for a specific trade. Returns True if updated."""
    conn = _get_connection()
    try:
        updates = []
        params: List[Any] = []

        if setup_tag is not None:
            updates.append("setup_tag = ?")
            params.append(setup_tag)
        if additional_tag is not None:
            updates.append("additional_tag = ?")
            params.append(additional_tag)

        if not updates:
            return False

        updates.append("updated_at = datetime('now')")
        params.append(trade_id)

        sql = f"UPDATE trades SET {', '.join(updates)} WHERE id = ?"
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def update_trade_metadata(
    trade_id: int,
    setup_rating: Optional[int] = None,
    comments: Optional[str] = None,
) -> bool:
    """Update metadata (rating, comments) for a specific trade."""
    conn = _get_connection()
    try:
        updates = []
        params: List[Any] = []

        if setup_rating is not None:
            updates.append("setup_rating = ?")
            params.append(setup_rating)
        if comments is not None:
            updates.append("comments = ?")
            params.append(comments)

        if not updates:
            return False

        updates.append("updated_at = datetime('now')")
        params.append(trade_id)

        sql = f"UPDATE trades SET {', '.join(updates)} WHERE id = ?"
        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

def merge_trades(trade_ids: List[int]) -> Optional[Dict[str, Any]]:
    """
    Merge multiple trades into one composite trade.

    The merged trade inherits the first trade's entry and the last
    trade's exit.  P/L, commissions, and sizes are summed.

    The original trades are deleted after merging.

    Returns the newly created merged trade dict, or None on failure.
    """
    if len(trade_ids) < 2:
        return None

    conn = _get_connection()
    try:
        placeholders = ",".join("?" for _ in trade_ids)
        rows = conn.execute(
            f"SELECT * FROM trades WHERE id IN ({placeholders}) "
            f"ORDER BY entry_datetime ASC",
            trade_ids,
        ).fetchall()

        if len(rows) < 2:
            return None

        trades = [dict(r) for r in rows]
        first = trades[0]
        last = trades[-1]

        merged = {
            "symbol": first["symbol"],
            "base_symbol": first["base_symbol"],
            "direction": first["direction"],
            "entry_datetime": first["entry_datetime"],
            "exit_datetime": last["exit_datetime"],
            "entry_price": first["entry_price"],
            "exit_price": last["exit_price"],
            "quantity": sum(t["quantity"] for t in trades),
            "pnl": round(sum(t["pnl"] for t in trades), 2),
            "commission": round(sum(t["commission"] for t in trades), 2),
            "net_pnl": round(sum(t["net_pnl"] for t in trades), 2),
            "max_open_profit": max(t["max_open_profit"] for t in trades),
            "max_open_loss": min(t["max_open_loss"] for t in trades),
            "duration_seconds": sum(
                t["duration_seconds"] for t in trades
            ),
            "note": " | ".join(
                t["note"] for t in trades if t["note"]
            ),
            "fill_count": sum(t["fill_count"] for t in trades),
            "point_value": first["point_value"],
            "tick_size": first["tick_size"],
            "tick_value": first["tick_value"],
            "import_hash": "",
            "is_merged": 1,
            "merge_source_ids": json.dumps(trade_ids),
            "setup_tag": ", ".join(
                t["setup_tag"] for t in trades if t["setup_tag"]
            ),
            "additional_tag": ", ".join(
                t["additional_tag"] for t in trades if t["additional_tag"]
            ),
            "setup_rating": first.get("setup_rating"),
            "comments": " | ".join(
                t["comments"] for t in trades if t["comments"]
            ),
        }

        # Insert merged trade
        cursor = conn.execute("""
            INSERT INTO trades (
                symbol, base_symbol, direction,
                entry_datetime, exit_datetime,
                entry_price, exit_price, quantity,
                pnl, commission, net_pnl,
                max_open_profit, max_open_loss,
                duration_seconds, note, fill_count,
                point_value, tick_size, tick_value,
                import_hash, is_merged, merge_source_ids,
                setup_tag, additional_tag,
                setup_rating, comments
            ) VALUES (
                :symbol, :base_symbol, :direction,
                :entry_datetime, :exit_datetime,
                :entry_price, :exit_price, :quantity,
                :pnl, :commission, :net_pnl,
                :max_open_profit, :max_open_loss,
                :duration_seconds, :note, :fill_count,
                :point_value, :tick_size, :tick_value,
                :import_hash, :is_merged, :merge_source_ids,
                :setup_tag, :additional_tag,
                :setup_rating, :comments
            )
        """, merged)

        new_id = cursor.lastrowid

        # Delete originals
        conn.execute(
            f"DELETE FROM trades WHERE id IN ({placeholders})",
            trade_ids,
        )
        conn.commit()

        merged["id"] = new_id
        return merged
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_trade(trade_id: int) -> bool:
    """Delete a trade by its ID. Returns True if deleted."""
    conn = _get_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM trades WHERE id = ?", (trade_id,)
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def delete_all_trades() -> int:
    """Delete all trades. Returns count of deleted rows."""
    conn = _get_connection()
    try:
        cursor = conn.execute("DELETE FROM trades")
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()
