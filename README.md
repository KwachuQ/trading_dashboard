# Trading Dashboard

A high-performance web dashboard for analyzing trading performance with precision. Built with a FastAPI backend (leveraging Polars for rapid data processing) and a modern React frontend with Tailwind CSS and Recharts. It is integrated to read .csv files exported from TopStepX trading platform.

Build with Google Antigravity.

## Core Features

- **Advanced Analytics Grid**: 16 key performance indicators organized into specialized rows (Performance, Averages, Records, and Durations).
- **Dynamic Date Range Filtering**: Real-time recalculation of all statistics and charts based on selected date ranges.
- **Enhanced Calendar Heatmap**:
    - High-visibility design.
    - Weekly PnL summaries and trade count rollups.
    - Color-coded daily performance tracking.
- **Statistical Analysis Charts**:
    - **Equity Curve & Daily Net PnL**: Standard performance tracking over time.
    - **Trade Duration Analysis**: Bucketed histogram identifying your trade frequency across duration ranges.
    - **Win Rate Analysis**: Specialized chart showing your edge/win-rate across different trade holding times.
- **Detailed Trade Log**: Sortable and paginated table of every individual trade with precise metrics.
- **Timestamp Accuracy**: Advanced backend logic that calculates exact trade durations from raw entry/exit timestamps, ensuring precision even with complex exports.
- **User-Friendly Upload**: Drag-and-drop or click-to-upload CSV mapping that handles varied column names (Fees, Commission, Net PnL, etc.).

## Prerequisites
- **Python**: 3.8+
- **Node.js**: v20.19+ or v22+ (Recommended for Vite v7)
- **Git**

## Quick Start

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Create and activate a virtual environment (optional but recommended):
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the backend server:
```bash
python main.py
```
The API will be available at `http://localhost:8000`.

### 2. Frontend Setup

Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## Local Testing & Verification

### Run Unit Tests (Backend)
To verify the CSV processing logic:
```bash
# From the root directory
python backend/test_processor.py
```

### Verify with Real Data
To test against a specific export file (e.g., `data/trades_export.csv`):
```bash
# From the root directory
python backend/verify_real_data.py
```

### Build Frontend
To check for production readiness:
```bash
cd frontend
npm run build
```

## License
MIT