"""
Trading Dashboard API — FastAPI backend.

Provides endpoints for:
    - Importing Sierra Chart TradesList files
    - Retrieving all persisted trades
    - Updating trade tags and metadata
    - Merging trades
    - Computing statistics and chart data
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from core.database import (
    delete_trade,
    get_all_trades,
    get_trade_by_id,
    init_db,
    insert_trades,
    merge_trades,
    recalculate_commissions,
    update_trade_metadata,
    update_trade_tags,
)
from core.sierra_parser import parse_sierra_trades
from core.stats import compute_stats, prepare_charts_data
from core.trade_statistics_parser import parse_trade_statistics


# ---------------------------------------------------------------------------
# Lifespan — initialise the database on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Initialise the SQLite database on application start."""
    init_db()
    # Ensure commissions are populated for any trades that have zero
    recalculate_commissions()
    yield


# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------

app = FastAPI(title="Trading Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------

class TagUpdateRequest(BaseModel):
    """Request body for updating trade tags."""
    setup_tag: Optional[str] = None
    additional_tag: Optional[str] = None


class MetadataUpdateRequest(BaseModel):
    """Request body for updating trade metadata."""
    setup_rating: Optional[int] = None
    comments: Optional[str] = None


class MergeRequest(BaseModel):
    """Request body for merging multiple trades."""
    trade_ids: List[int]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Trading Dashboard API is running"}


@app.post("/import")
async def import_file(file: UploadFile = File(...)):
    """
    Import a Sierra Chart TradesList export file.

    Accepts ``.txt`` or ``.csv`` files. Parses fills into flat-to-flat
    trades and inserts them into the database, skipping duplicates.
    """
    filename = file.filename or ""
    if not (filename.endswith(".txt") or filename.endswith(".csv")):
        raise HTTPException(
            status_code=400,
            detail="Only .txt or .csv files are accepted."
        )

    try:
        parsed_trades = parse_sierra_trades(file.file)
        result = insert_trades(parsed_trades, skip_duplicates=True)
        all_trades = get_all_trades()

        return {
            "message": (
                f"Imported {result['inserted']} trades "
                f"({result['skipped']} duplicates skipped)."
            ),
            "import_summary": result,
            "trades": _format_trades_for_frontend(all_trades),
            "stats": compute_stats(all_trades),
            "charts": prepare_charts_data(all_trades),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Server Error: {str(exc)}"
        )


@app.get("/trades")
async def list_trades():
    """
    Return all trades from the database with computed stats and chart data.

    This is the main endpoint called on frontend startup to load
    persisted data.
    """
    try:
        all_trades = get_all_trades()
        formatted = _format_trades_for_frontend(all_trades)
        return {
            "data": formatted,
            "stats": compute_stats(all_trades),
            "charts": prepare_charts_data(all_trades),
            "message": f"Loaded {len(all_trades)} trades from database.",
        }
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Server Error: {str(exc)}"
        )


@app.put("/trades/{trade_id}/tags")
async def update_tags(trade_id: int, body: TagUpdateRequest):
    """Update Setup Tag and/or Additional Tag for a trade."""
    success = update_trade_tags(
        trade_id,
        setup_tag=body.setup_tag,
        additional_tag=body.additional_tag,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Trade not found.")
    return {"message": "Tags updated.", "trade_id": trade_id}


@app.put("/trades/{trade_id}/metadata")
async def update_metadata(trade_id: int, body: MetadataUpdateRequest):
    """Update setup rating and/or comments for a trade."""
    success = update_trade_metadata(
        trade_id,
        setup_rating=body.setup_rating,
        comments=body.comments,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Trade not found.")
    return {"message": "Metadata updated.", "trade_id": trade_id}


@app.post("/trades/merge")
async def merge(body: MergeRequest):
    """Merge multiple trades into a single composite trade."""
    if len(body.trade_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 trade IDs are required for merging."
        )

    merged = merge_trades(body.trade_ids)
    if merged is None:
        raise HTTPException(
            status_code=400,
            detail="Could not merge — trades not found."
        )

    # Return the full updated dataset
    all_trades = get_all_trades()
    return {
        "message": "Trades merged successfully.",
        "merged_trade": _format_single_trade(merged),
        "trades": _format_trades_for_frontend(all_trades),
        "stats": compute_stats(all_trades),
        "charts": prepare_charts_data(all_trades),
    }


@app.delete("/trades/{trade_id}")
async def remove_trade(trade_id: int):
    """
    Delete a trade by ID.

    Returns the full refreshed dataset so the frontend can update all
    derived state (stats, charts) in a single round-trip.
    """
    success = delete_trade(trade_id)
    if not success:
        raise HTTPException(status_code=404, detail="Trade not found.")
    all_trades = get_all_trades()
    return {
        "message": "Trade deleted.",
        "trade_id": trade_id,
        "trades": _format_trades_for_frontend(all_trades),
        "stats": compute_stats(all_trades),
        "charts": prepare_charts_data(all_trades),
    }


@app.post("/trade-statistics")
async def import_trade_statistics(file: UploadFile = File(...)):
    """
    Parse a Sierra Chart ``TradeStatistics.txt`` export and return the
    10 most important advanced metrics.

    The response is a flat dict whose keys are the internal metric names
    and whose values are sub-dicts with ``label``, ``all``, ``long``,
    ``short``, ``formatted``, ``is_currency``, ``is_percent`` and
    ``is_count`` fields.
    """
    filename = file.filename or ""
    if not filename.endswith(".txt"):
        raise HTTPException(
            status_code=400,
            detail="Only .txt files are accepted for trade statistics."
        )

    try:
        content = await file.read()
        metrics = parse_trade_statistics(content)
        return {"metrics": metrics, "message": "Trade statistics parsed successfully."}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Server Error: {str(exc)}"
        )


@app.post("/recalculate-commissions")
async def recalc_commissions():
    """
    Recalculate commissions for all trades with zero commission.

    Uses per-instrument rates (e.g. $0.52/side for MNQ) and updates
    net_pnl accordingly.  Returns the full refreshed dataset.
    """
    try:
        result = recalculate_commissions()
        all_trades = get_all_trades()
        return {
            "message": f"Recalculated commissions for {result['updated']} trades.",
            "updated": result["updated"],
            "data": _format_trades_for_frontend(all_trades),
            "stats": compute_stats(all_trades),
            "charts": prepare_charts_data(all_trades),
        }
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Server Error: {str(exc)}"
        )


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

def _format_trades_for_frontend(
    trades: List[dict],
) -> List[dict]:
    """
    Transform database trade dicts into the shape expected by the
    frontend components.

    The frontend expects fields like 'EntryDate', 'ExitDate', 'PnL',
    'NetPnL', 'Direction', 'Size', 'Symbol', 'Duration', 'Day',
    'Setup Tag', 'Additional Tag', 'Setup Rating', 'Comments', etc.
    """
    return [_format_single_trade(t) for t in trades]


def _format_single_trade(t: dict) -> dict:
    """Map a single database row to the frontend trade shape."""
    entry_dt = t.get("entry_datetime", "")
    day = entry_dt.split(" ")[0] if entry_dt else ""

    return {
        "_row_id": t.get("id"),
        "id": t.get("id"),
        "Symbol": t.get("symbol", ""),
        "Direction": t.get("direction", ""),
        "Date": entry_dt,
        "EntryDate": entry_dt,
        "ExitDate": t.get("exit_datetime", ""),
        "EntryPrice": t.get("entry_price", 0.0),
        "ExitPrice": t.get("exit_price", 0.0),
        "PnL": t.get("pnl", 0.0),
        "NetPnL": t.get("net_pnl", 0.0),
        "Fees": t.get("commission", 0.0),
        "Size": t.get("quantity", 1),
        "Duration": t.get("duration_seconds", 0.0),
        "Day": day,
        "Setup Tag": t.get("setup_tag", ""),
        "Additional Tag": t.get("additional_tag", ""),
        "Setup Rating": t.get("setup_rating") or "",
        "Comments": t.get("comments", ""),
        "Note": t.get("note", ""),
        "FillCount": t.get("fill_count", 1),
        "MaxOpenProfit": t.get("max_open_profit", 0.0),
        "MaxOpenLoss": t.get("max_open_loss", 0.0),
        "PointValue": t.get("point_value", 1.0),
        "TickSize": t.get("tick_size", 0.01),
        "TickValue": t.get("tick_value", 0.01),
        "isMerged": bool(t.get("is_merged", 0)),
        "Date_Obj": day,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
