/**
 * AdvancedStatsTab.jsx
 *
 * Renders a dedicated "Advanced Stats" tab that parses a Sierra Chart
 * ``TradeStatistics.txt`` export and displays 20 key metrics not already
 * shown on the Stats Overview tab.
 *
 * Features:
 *  - Drag-and-drop or file-picker upload
 *  - All / Longs Only / Shorts Only direction toggle
 *  - MFE vs MAE excursion split bar (direction-aware)
 *  - Consecutive streak comparison bars (direction-aware)
 *  - Metrics persisted to localStorage (survive page refresh)
 */

import { useState, useCallback, useRef } from 'react'
import StatCard from './StatCard'
import {
    TrendingUp, TrendingDown, AlertTriangle, Zap,
    BarChart2, Target, Award, Upload, RefreshCw,
    ChevronRight, Activity, DollarSign, Percent
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEY = 'advanced_stats_metrics_v2'

/**
 * Ordered display configuration for all 20 metrics.
 * [ internalKey, icon component, StatCard type ]
 */
const CARD_CONFIG = [
    // Row 1 — MFE / MAE excursion
    { key: 'mfe', Icon: TrendingUp, type: 'pnl' },
    { key: 'mae', Icon: TrendingDown, type: 'pnl' },
    { key: 'avg_mfe_winners', Icon: Award, type: 'pnl' },
    { key: 'avg_mae_losers', Icon: AlertTriangle, type: 'pnl' },
    // Row 2 — Equity curve
    { key: 'max_drawdown', Icon: TrendingDown, type: 'pnl' },
    { key: 'max_runup', Icon: TrendingUp, type: 'pnl' },
    { key: 'highest_cum_profit', Icon: TrendingUp, type: 'pnl' },
    { key: 'lowest_cum_loss', Icon: TrendingDown, type: 'pnl' },
    // Row 3 — Gross P&L breakdown
    { key: 'closed_profit', Icon: DollarSign, type: 'pnl' },
    { key: 'closed_loss', Icon: DollarSign, type: 'pnl' },
    { key: 'avg_trade_pl', Icon: Activity, type: 'pnl' },
    { key: 'avg_f2f_pl', Icon: Activity, type: 'pnl' },
    // Row 4 — FlatToFlat quality
    { key: 'avg_f2f_winning', Icon: TrendingUp, type: 'pnl' },
    { key: 'avg_f2f_losing', Icon: TrendingDown, type: 'pnl' },
    { key: 'f2f_win_rate', Icon: Target, type: 'winrate' },
    { key: 'f2f_profit_factor', Icon: Activity, type: 'neutral' },
    // Row 5 — Streaks & concentration
    { key: 'max_consecutive_winners', Icon: Award, type: 'neutral' },
    { key: 'max_consecutive_losers', Icon: BarChart2, type: 'neutral' },
    { key: 'largest_winner_pct', Icon: Percent, type: 'neutral' },
    { key: 'largest_loser_pct', Icon: Percent, type: 'neutral' },
]

/** Direction options for the toggle. */
const DIRECTIONS = [
    { key: 'all', label: 'All Trades' },
    { key: 'long', label: 'Longs Only' },
    { key: 'short', label: 'Shorts Only' },
]

// ---------------------------------------------------------------------------
// Helper: pick the right value & formatted string for a metric + direction
// ---------------------------------------------------------------------------

/**
 * Return { num, fmt } for the given metric and active direction.
 *
 * @param {object}  m    - metric sub-dict from the backend
 * @param {string}  dir  - 'all' | 'long' | 'short'
 */
function getDirected(m, dir) {
    if (!m) return { num: 0, fmt: '-' }
    return {
        num: m[dir] ?? m.all ?? 0,
        fmt: m[`fmt_${dir}`] ?? m.fmt_all ?? '-',
    }
}

/** Format a numeric value with the same rules used by the backend. */
function fmtSide(val, m) {
    if (val === undefined || val === null) return '-'
    if (m.is_currency) {
        const n = Number(val)
        return n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${Number(n).toFixed(2)}`
    }
    if (m.is_percent) return `${Number(val).toFixed(2)}%`
    if (m.is_count) return String(Math.round(val))
    return Number(val).toFixed(2)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Three-button direction toggle pill (All / Longs / Shorts).
 */
const DirectionToggle = ({ direction, onChange }) => (
    <div className="flex rounded-xl overflow-hidden border border-slate-700 w-fit">
        {DIRECTIONS.map(({ key, label }) => (
            <button
                key={key}
                id={`adv-dir-${key}`}
                onClick={() => onChange(key)}
                className={`
                    px-5 py-2 text-sm font-semibold transition-all duration-200
                    ${direction === key
                        ? 'bg-accent text-white'
                        : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                    }
                `}
            >
                {label}
            </button>
        ))}
    </div>
)

/**
 * MFE vs MAE excursion split bar — direction-aware.
 */
const ExcursionBar = ({ metrics, dir }) => {
    const mfe = getDirected(metrics?.mfe, dir).num
    const mae = Math.abs(getDirected(metrics?.mae, dir).num)
    if (!mfe && !mae) return null
    const total = mfe + mae || 1
    const mfePct = Math.round((mfe / total) * 100)

    return (
        <div className="card !p-5 col-span-1 md:col-span-2 lg:col-span-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-3">
                MFE vs MAE — Excursion Split
            </p>
            <div className="flex rounded-full overflow-hidden h-4 w-full">
                <div
                    className="h-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${mfePct}%` }}
                />
                <div
                    className="h-full bg-red-500 transition-all duration-700"
                    style={{ width: `${100 - mfePct}%` }}
                />
            </div>
            <div className="flex justify-between text-xs mt-2 font-mono">
                <span className="text-emerald-400">MFE ${mfe.toFixed(2)} ({mfePct}%)</span>
                <span className="text-red-400">MAE ${mae.toFixed(2)} ({100 - mfePct}%)</span>
            </div>
            <p className="text-slate-600 text-xs mt-2">
                Ratio MFE:MAE = {mae > 0 ? (mfe / mae).toFixed(2) : '∞'} — target &gt; 2.0
            </p>
        </div>
    )
}

/**
 * Consecutive streak comparison bars — direction-aware.
 */
const StreakVisual = ({ metrics, dir }) => {
    const winners = getDirected(metrics?.max_consecutive_winners, dir).num
    const losers = getDirected(metrics?.max_consecutive_losers, dir).num
    if (!winners && !losers) return null
    const max = Math.max(winners, losers, 1)

    return (
        <div className="card !p-5 col-span-1 md:col-span-2">
            <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-3">
                Streak Comparison
            </p>
            <div className="space-y-3">
                {[
                    { label: 'Win streak', val: winners, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                    { label: 'Loss streak', val: losers, color: 'bg-red-500', textColor: 'text-red-400' },
                ].map(({ label, val, color, textColor }) => (
                    <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className={`${textColor} font-mono`}>{label}</span>
                            <span className={`${textColor} font-bold`}>{Math.round(val)}</span>
                        </div>
                        <div className="w-full bg-slate-700/40 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full ${color} rounded-full transition-all duration-700`}
                                style={{ width: `${(val / max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AdvancedStatsTab = () => {
    // Rehydrate from localStorage on first render
    const [metrics, setMetrics] = useState(() => {
        const saved = localStorage.getItem(LS_KEY)
        if (saved) {
            try { return JSON.parse(saved) } catch { /* ignore */ }
        }
        return null
    })

    // Active direction: 'all' | 'long' | 'short'
    const [direction, setDirection] = useState('all')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [dragging, setDragging] = useState(false)
    const fileInputRef = useRef(null)

    /** Upload a File to the backend, store result in state + localStorage. */
    const uploadFile = useCallback(async (file) => {
        if (!file) return
        setLoading(true)
        setError(null)
        const fd = new FormData()
        fd.append('file', file)
        try {
            const res = await fetch('http://localhost:8000/trade-statistics', {
                method: 'POST',
                body: fd,
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.detail || 'Upload failed')
            setMetrics(json.metrics)
            localStorage.setItem(LS_KEY, JSON.stringify(json.metrics))
        } catch (err) {
            setError(err.message || 'Unknown error')
        } finally {
            setLoading(false)
        }
    }, [])

    const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
    const handleDragLeave = () => setDragging(false)
    const handleDrop = (e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) uploadFile(file)
    }
    const handleFileChange = (e) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
    }
    const handleClear = () => {
        setMetrics(null)
        setError(null)
        localStorage.removeItem(LS_KEY)
    }

    // -----------------------------------------------------------------------
    // Upload prompt (no data loaded yet)
    // -----------------------------------------------------------------------
    if (!metrics) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-16">
                <div
                    id="advanced-stats-dropzone"
                    className={`
                        relative border-2 border-dashed rounded-2xl p-16 w-full max-w-xl
                        flex flex-col items-center gap-4 transition-all duration-300 cursor-pointer
                        ${dragging
                            ? 'border-accent bg-accent/10 scale-[1.02]'
                            : 'border-slate-600 hover:border-accent hover:bg-accent/5'
                        }
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="p-5 rounded-full bg-accent/10">
                        <Zap size={40} className="text-accent" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-white mb-1">
                            Load TradeStatistics.txt
                        </p>
                        <p className="text-slate-400 text-sm max-w-xs">
                            Drag &amp; drop your Sierra Chart
                            <span className="font-mono text-accent"> TradeStatistics.txt </span>
                            file here, or click to browse.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-accent font-semibold">
                        <Upload size={18} />
                        Choose file
                    </div>
                    <input
                        ref={fileInputRef}
                        id="advanced-stats-file-input"
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>

                {error && (
                    <div className="card border border-red-500/40 !bg-red-500/10 text-red-300 text-sm max-w-xl w-full">
                        <AlertTriangle size={16} className="inline mr-2" />
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="flex items-center gap-3 text-slate-400">
                        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
                        Parsing…
                    </div>
                )}

                {/* Hint cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-xl w-full mt-4">
                    {[
                        { Icon: TrendingUp, label: 'MFE & MAE', desc: 'Excursion analysis per direction' },
                        { Icon: TrendingDown, label: 'Max Drawdown', desc: 'Worst peak-to-trough equity dip' },
                        { Icon: BarChart2, label: 'Streak Analysis', desc: 'Win / loss streaks by direction' },
                    ].map(({ Icon, label, desc }) => (
                        <div key={label} className="card !p-4 text-center opacity-60 hover:opacity-100 transition-opacity">
                            <Icon size={22} className="text-accent mx-auto mb-2" />
                            <p className="text-white text-sm font-bold">{label}</p>
                            <p className="text-slate-500 text-xs mt-1">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // -----------------------------------------------------------------------
    // Main metrics view
    // -----------------------------------------------------------------------

    /**
     * Render a single StatCard honouring the active direction.
     * The subtext shows the other two direction values for quick comparison.
     */
    const renderCard = ({ key, Icon, type }) => {
        const m = metrics[key]
        if (!m) return null

        const { fmt } = getDirected(m, direction)

        // Build subtext: the two directions NOT currently active
        const sides = DIRECTIONS
            .filter(d => d.key !== direction)
            .map(d => `${d.label.split(' ')[0]}: ${fmtSide(m[d.key], m)}`)
            .join('  |  ')

        // Gauge value for win-rate cards (0-100)
        const gaugeVal = (type === 'winrate' && typeof m[direction] === 'number')
            ? m[direction]
            : undefined

        return (
            <StatCard
                key={key}
                title={m.label}
                value={fmt}
                type={type}
                icon={Icon}
                gaugeValue={gaugeVal}
                subtext={sides}
            />
        )
    }

    return (
        <div className="animate-in fade-in duration-400 flex flex-col gap-5">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap size={20} className="text-accent" />
                        Advanced Stats
                        <span className="text-slate-500 text-sm font-normal">
                            — from TradeStatistics.txt
                        </span>
                    </h2>
                    <p className="text-slate-500 text-xs mt-0.5">
                        20 Sierra Chart metrics. Toggle to drill into long or short book.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Direction toggle */}
                    <DirectionToggle direction={direction} onChange={setDirection} />

                    {/* Reload button */}
                    <button
                        id="advanced-stats-reload-btn"
                        className="flex items-center gap-2 text-xs text-slate-400 hover:text-white border border-slate-700
                                   hover:border-accent rounded-lg px-3 py-2 transition-all"
                        onClick={handleClear}
                        title="Load a new TradeStatistics.txt"
                    >
                        <RefreshCw size={14} />
                        Load new file
                    </button>
                </div>
            </div>

            {error && (
                <div className="card border border-red-500/40 !bg-red-500/10 text-red-300 text-sm">
                    <AlertTriangle size={16} className="inline mr-2" />
                    {error}
                </div>
            )}

            {/* ── Row 1: MFE / MAE excursion ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {CARD_CONFIG.slice(0, 4).map(renderCard)}
            </div>

            {/* Excursion bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ExcursionBar metrics={metrics} dir={direction} />
            </div>

            {/* ── Row 2: Equity curve ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {CARD_CONFIG.slice(4, 8).map(renderCard)}
            </div>

            {/* ── Row 3: Gross P&L ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {CARD_CONFIG.slice(8, 12).map(renderCard)}
            </div>

            {/* ── Row 4: FlatToFlat quality ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {CARD_CONFIG.slice(12, 16).map(renderCard)}
            </div>

            {/* ── Row 5: Streaks & concentration ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Streak cards */}
                {CARD_CONFIG.slice(16, 18).map(renderCard)}
                {/* Concentration cards */}
                {CARD_CONFIG.slice(18, 20).map(renderCard)}
            </div>

            {/* Streak visual */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StreakVisual metrics={metrics} dir={direction} />
            </div>

            {/* ── Footnote ── */}
            <p className="text-slate-600 text-xs flex items-center gap-1 mt-2">
                <ChevronRight size={12} />
                Showing <span className="font-mono mx-1">{DIRECTIONS.find(d => d.key === direction)?.label}</span>
                values. Subtext shows the other directions for comparison.
            </p>
        </div>
    )
}

export default AdvancedStatsTab
