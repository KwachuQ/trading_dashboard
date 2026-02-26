![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![NodeJS](https://img.shields.io/badge/NodeJS-v22+-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.127+-yellow.svg)
![SQLite](https://img.shields.io/badge/SQLite-3-lightblue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

# Trading Dashboard

A persistent local trade journal for Sierra Chart exports. Import your
`TradesList.txt` after each session, tag trades, track stats,
and review performance — all data saved locally in SQLite.

Built with Google Antigravity.

## Core Features

- **Sierra Chart Import**: Parses `TradesList.txt` directly. Multiple
  fills are automatically aggregated into flat-to-flat trades.
- **Persistent Database**: Trades, tags, ratings, and comments are stored in
  `data/trades.db` (SQLite). Loads instantly on next startup.
- **Safe Incremental Imports**: Re-importing the same file never creates
  duplicates. Only new trades are added, existing entries stay untouched.
- **Multi-Instrument Support**: MNQ, NQ, MES, ES, MCL, CL — CME contract
  specs (point value, tick size) applied automatically per instrument.

### Stats Overview Tab

- **16 KPI Stat Cards**: Total P&L, win rate, profit factor, avg win/loss,
  best/worst trade, avg hold duration, direction bias, and more.
- **Direction Toggle**: Switch between **All Trades**, **Longs Only**, and
  **Shorts Only** — stat cards, charts, and the calendar all update instantly.
- **Dynamic Date Range Filtering**: Compose with the direction toggle to drill
  into any window of longs or shorts.
- **Calendar Heatmap**: Daily P&L and trade counts with weekly rollup column.
- **Charts**: Equity curve, daily net P&L bar chart, duration histogram, win
  rate by duration bucket.

### Advanced Stats Tab

- **20 Sierra Chart Metrics**: Loaded from `TradeStatistics.txt` — metrics not
  shown on the overview tab, covering MFE/MAE, drawdown, equity curve extremes,
  gross P&L breakdown, FlatToFlat quality, consecutive streaks, and
  concentration risk.
- **Direction Toggle**: Same All / Longs / Shorts pill toggle — each card's
  value and the MFE vs MAE excursion bar and streak comparison bars all update
  dynamically.
- **Drag-and-Drop Upload**: Drop `TradeStatistics.txt` directly onto the tab.
  Metrics are persisted to `localStorage` and survive page refreshes.

### Trades Table Tab

- **Trade Merges**: Merge related trades into one composite entry (persisted).
- **Undo / Redo**: Full undo/redo history for tag edits in the current session.
- **CSV Export**: Export visible trades as CSV from the trade table.
- **Tag & Rating Editor**: Inline tag assignment, star rating, and free-text
  comments, all persisted to SQLite.

### Tag Analytics Tab

- **Multi-tag filtering**: AND/OR logic across Setup Tag and Additional Tag.
- **Per-tag analytics**: Win rate, avg P&L, trade count, and equity curve by
  tag — with colour-coded labels and a per-tag colour picker.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11 + |
| Node.js | v20 + |

---

## First-Time Setup (run once)

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend

```powershell
cd frontend
npm install
```

---

## Running the App (every session)

You need **two terminals** — one for the backend, one for the frontend.

### Terminal 1 — Backend

```powershell
cd backend
.\venv\Scripts\activate   # skip if not using a venv
python main.py
```

Backend runs at **http://localhost:8000**

### Terminal 2 — Frontend

```powershell
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

> **Tip:** Use the `start.ps1` script in the project root to launch
> both servers with a single double-click (see below).

---

## One-Click Launch (`start.ps1`)

From the project root, right-click `start.ps1` → **Run with PowerShell**.
It opens both the backend and frontend in separate windows automatically,
then opens the dashboard in your default browser.

---

## Daily Workflow

1. Finish your trading session in Sierra Chart.
2. Export trades: **Trade Activity → File → Save log as** → save as `TradesList.txt`.
3. Export statistics: **Trade Activity → Trade Statistics** → save as `TradeStatistics.txt`.
4. Start the app (or it may already be running).
5. Click **Import Trades** and drag `TradesList.txt` onto the upload zone.
   Only new trades are added — duplicates are silently skipped.
6. Open the **Advanced Stats** tab and drop `TradeStatistics.txt` to load
   the 20 advanced metrics. Stats are cached and persist across sessions.
7. Tag, rate, and comment on trades in the **Trades Table** tab.

---

## Running Tests

```powershell
# Activate backend venv first, then from the project root:
cd backend
.\venv\Scripts\python.exe -m pytest ..\tests\ -v
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/import` | Import `TradesList.txt` |
| `GET` | `/trades` | List all trades with stats |
| `PUT` | `/trades/{id}/tags` | Update Setup / Additional tag |
| `PUT` | `/trades/{id}/metadata` | Update rating and comments |
| `POST` | `/trades/merge` | Merge multiple trades |
| `DELETE` | `/trades/{id}` | Delete a trade |
| `POST` | `/trade-statistics` | Parse `TradeStatistics.txt` |

---

## Project Structure

```
trading_dashboard/
├── backend/
│   ├── core/
│   │   ├── sierra_parser.py          # TradesList.txt parser + F2F aggregation
│   │   ├── trade_statistics_parser.py # TradeStatistics.txt parser (20 metrics)
│   │   ├── database.py               # SQLite layer (insert, update, merge, delete)
│   │   └── stats.py                  # Stats + chart-data computation
│   ├── main.py                       # FastAPI app + all endpoints
│   └── requirements.txt
├── data/
│   ├── TradesList.txt                # Sierra Chart trades export (not tracked)
│   ├── TradeStatistics.txt           # Sierra Chart statistics export (not tracked)
│   └── trades.db                    # SQLite database (auto-created, not tracked)
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── Dashboard.jsx         # Tab layout + direction filter logic
│       │   ├── AdvancedStatsTab.jsx  # 20-metric tab with direction toggle
│       │   ├── StatCard.jsx
│       │   ├── Charts.jsx
│       │   ├── CalendarView.jsx
│       │   ├── TransactionManager.jsx
│       │   ├── TagAnalyticsPage.jsx
│       │   └── ...
│       └── hooks/
│           └── useTradeStats.js
├── tests/
│   ├── test_sierra_parser.py
│   ├── test_database.py
│   └── test_trade_statistics_parser.py
├── start.ps1                         # One-click launcher
└── README.md
```

---

## License
MIT