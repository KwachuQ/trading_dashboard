import { useState, useMemo, useEffect, useCallback } from 'react'
import StatCard from './StatCard'
import Charts from './Charts'
import CalendarView from './CalendarView'
import TransactionManager from './TransactionManager'
import TagAnalyticsPage from './TagAnalyticsPage'
import AdvancedStatsTab from './AdvancedStatsTab'
import DateRangeFilter from './DateRangeFilter'
import useTradeStats from '../hooks/useTradeStats'
import {
    DollarSign, Activity, TrendingUp, Clock, Target,
    ArrowUp, ArrowDown, BarChart2, Calendar, TrendingDown, Timer,
    LayoutDashboard, List, Filter, Zap
} from 'lucide-react'

/**
 * Main dashboard component.
 *
 * Displays stats, charts, calendar, trade table, and tag analytics.
 * Receives ``data`` (containing ``data``, ``stats``, ``charts``) and
 * an ``onRefresh`` callback to reload from the database after mutations.
 */
const Dashboard = ({ data, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('stats')
    const [localTrades, setLocalTrades] = useState([])
    const [dateFilter, setDateFilter] = useState({ startDate: null, endDate: null })
    // Direction filter for the Stats Overview tab: 'all' | 'long' | 'short'
    const [directionFilter, setDirectionFilter] = useState('all')
    // R-value in dollars per 1R (default $80, persisted to localStorage)
    const [rValue, setRValue] = useState(() => {
        const saved = localStorage.getItem('dashboard_rValue')
        return saved ? parseFloat(saved) || 80 : 80
    })
    const [tagColors, setTagColors] = useState(() => {
        // Load persisted tag colors from localStorage
        const saved = localStorage.getItem('dashboard_tagColors')
        if (saved) {
            try { return JSON.parse(saved) } catch { /* ignore */ }
        }
        return {
            'Breakout': '#6366f1',
            'Reversal': '#10b981',
            'Trend Following': '#f59e0b',
            'Range': '#94a3b8',
            'Scalp': '#ef4444',
            'Other': '#64748b'
        }
    })

    // Initialise local trades when data changes
    useEffect(() => {
        if (data && data.data) {
            setLocalTrades(data.data)
        }
    }, [data])

    // Persist tag colors to localStorage
    useEffect(() => {
        localStorage.setItem('dashboard_tagColors', JSON.stringify(tagColors))
    }, [tagColors])

    // Persist R-value to localStorage
    useEffect(() => {
        localStorage.setItem('dashboard_rValue', String(rValue))
    }, [rValue])

    const handleUpdateTagColor = useCallback((tag, color) => {
        setTagColors(prev => ({ ...prev, [tag]: color }))
    }, [])

    const handleUpdateTrades = useCallback((newTrades) => {
        // Auto-assign colours to new tags
        const nextColors = { ...tagColors }
        let changed = false
        newTrades.forEach(t => {
            ['Setup Tag', 'Additional Tag'].forEach(field => {
                if (t[field]) {
                    t[field].split(',').map(s => s.trim()).forEach(tag => {
                        if (tag && !nextColors[tag]) {
                            nextColors[tag] = '#' + Math.floor(
                                Math.random() * 16777215
                            ).toString(16).padStart(6, '0')
                            changed = true
                        }
                    })
                }
            })
        })
        if (changed) setTagColors(nextColors)
        setLocalTrades(newTrades)
    }, [tagColors])

    // Safety check
    if (!data || !data.stats || !data.charts || !data.data) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-red-400 font-mono">
                Error: Invalid Data Structure
            </div>
        )
    }

    // Filter by date range
    const filteredTrades = useMemo(() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return localTrades || []
        return localTrades.filter(t => {
            const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date)
            if (dateFilter.startDate && dayKey < dateFilter.startDate) return false
            if (dateFilter.endDate && dayKey > dateFilter.endDate) return false
            return true
        })
    }, [localTrades, dateFilter])

    /**
     * Apply the direction filter on top of the date-filtered trades.
     * Used for stat cards, charts, and the calendar on the Stats Overview tab.
     */
    const directionFilteredTrades = useMemo(() => {
        if (directionFilter === 'all') return filteredTrades
        return filteredTrades.filter(t => {
            const dir = (t.Direction || '').toLowerCase()
            if (directionFilter === 'long') return dir.includes('long') || dir.includes('buy')
            if (directionFilter === 'short') return dir.includes('short') || dir.includes('sell')
            return true
        })
    }, [filteredTrades, directionFilter])

    // Recalculate stats from direction-filtered trades
    const { stats: currentStats, direction } = useTradeStats(directionFilteredTrades)

    // Charts data from direction-filtered trades
    const currentCharts = useMemo(() => {
        const dailyMap = {}
        directionFilteredTrades.forEach(t => {
            const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date)
            const pnl = t.NetPnL !== undefined ? t.NetPnL : (t.PnL - (t.Fees || 0))
            if (!dailyMap[dayKey]) {
                dailyMap[dayKey] = { Date: dayKey, DailyPnL: 0, TradeCount: 0 }
            }
            dailyMap[dayKey].DailyPnL += pnl
            dailyMap[dayKey].TradeCount += 1
        })

        const sortedDays = Object.values(dailyMap).sort(
            (a, b) => a.Date.localeCompare(b.Date)
        )
        let cumulative = 0
        const daily_pnl = sortedDays.map(d => {
            cumulative += d.DailyPnL
            return { ...d, CumulativePnL: cumulative }
        })

        const filteredDaily = daily_pnl.filter(d => {
            if (dateFilter.startDate && d.Date < dateFilter.startDate) return false
            if (dateFilter.endDate && d.Date > dateFilter.endDate) return false
            return true
        })

        return {
            ...data.charts,
            daily_pnl: filteredDaily,
        }
    }, [directionFilteredTrades, data.charts, dateFilter])

    const {
        totalPnL, grossPnL, totalFees, commissionPerTrade,
        winRate, totalTrades, ev,
        pf, pfValue, bestTrade, worstTrade,
        avgWin, avgLoss,
        avgDuration, avgWinDuration, avgLossDuration,
        tradingDays
    } = currentStats

    // Compute max drawdown from the daily CumulativePnL series so it
    // always matches the equity curve chart (end-of-day granularity).
    const maxDrawdown = useMemo(() => {
        const series = currentCharts.daily_pnl
        if (!series || series.length === 0) return '0.00'
        let peak = -Infinity
        let dd = 0
        for (const d of series) {
            const cum = d.CumulativePnL ?? 0
            if (cum > peak) peak = cum
            const drop = peak - cum
            if (drop > dd) dd = drop
        }
        return dd.toFixed(2)
    }, [currentCharts.daily_pnl])

    const stats_daily = data.stats.daily || {}

    // Date range bounds
    const minDate = data.data && data.data.length > 0
        ? (data.data[0].Day || data.data[0].Date.split(' ')[0]) : ''
    const maxDate = data.data && data.data.length > 0
        ? (data.data[data.data.length - 1].Day || data.data[data.data.length - 1].Date.split(' ')[0]) : ''

    return (
        <div className="animate-in fade-in duration-500 slide-in-from-bottom-4 flex flex-col gap-5 pb-10">
            {/* Tabs Header */}
            <div className="flex border-b border-[var(--card-border)] mb-4">
                <button
                    className={`flex items-center gap-3 px-8 py-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'stats' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-white'}`}
                    onClick={() => setActiveTab('stats')}
                >
                    <LayoutDashboard size={22} />
                    Stats overview
                </button>
                <button
                    className={`flex items-center gap-3 px-8 py-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'trades' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-white'}`}
                    onClick={() => setActiveTab('trades')}
                >
                    <List size={22} />
                    Trades table
                </button>
                <button
                    className={`flex items-center gap-3 px-8 py-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'tags' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-white'}`}
                    onClick={() => setActiveTab('tags')}
                >
                    <Filter size={22} />
                    Tag Analytics
                </button>
                <button
                    id="tab-advanced-stats"
                    className={`flex items-center gap-3 px-8 py-4 text-lg font-bold transition-all border-b-2 ${activeTab === 'advanced' ? 'border-accent text-accent' : 'border-transparent text-secondary hover:text-white'}`}
                    onClick={() => setActiveTab('advanced')}
                >
                    <Zap size={22} />
                    Advanced Stats
                </button>
            </div>

            {activeTab === 'stats' ? (
                <>
                    {/* Date Range Filter */}
                    <DateRangeFilter
                        onFilterChange={setDateFilter}
                        minDate={minDate}
                        maxDate={maxDate}
                    />

                    {/* Direction + R-value controls */}
                    <div className="flex items-center gap-5 flex-wrap">
                        {/* Direction toggle */}
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">Direction</span>
                            <div className="flex rounded-xl overflow-hidden border border-slate-700 w-fit">
                                {[
                                    { key: 'all', label: 'All Trades' },
                                    { key: 'long', label: 'Longs Only' },
                                    { key: 'short', label: 'Shorts Only' },
                                ].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        id={`stats-dir-${key}`}
                                        onClick={() => setDirectionFilter(key)}
                                        className={`
                                            px-5 py-2 text-sm font-semibold transition-all duration-200
                                            ${directionFilter === key
                                                ? 'bg-accent text-white'
                                                : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {directionFilter !== 'all' && (
                                <span className="text-xs text-accent font-mono">
                                    {directionFilteredTrades.length} trade{directionFilteredTrades.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* R-value input */}
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs uppercase tracking-wider font-bold">1R =</span>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    id="r-value-input"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={rValue}
                                    onChange={e => setRValue(Math.max(1, parseFloat(e.target.value) || 1))}
                                    className="
                                        pl-7 pr-3 py-2 w-24 rounded-xl border border-slate-700
                                        bg-slate-800/60 text-white text-sm font-mono font-semibold
                                        focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                                        transition-all duration-200
                                    "
                                />
                            </div>
                            <span className="text-slate-600 text-xs">per trade</span>
                        </div>
                    </div>

                    {/* Row 1: total PnL, total trades, total commission, win rate, profit factor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard
                            title="Net PnL"
                            value={`$${totalPnL}`}
                            type="pnl"
                            icon={DollarSign}
                            subtext={`Gross: $${grossPnL}`}
                        />
                        <StatCard
                            title="Total Trades"
                            value={totalTrades}
                            icon={BarChart2}
                            subtext={`${stats_daily.most_active_day_trades || 0} max daily volume`}
                        />
                        <StatCard
                            title="Total Commission"
                            value={`$${totalFees}`}
                            type="neutral"
                            icon={DollarSign}
                            subtext={`$${commissionPerTrade} / trade`}
                        />
                        <StatCard
                            title="Win Rate"
                            value={`${winRate}%`}
                            type="winrate"
                            icon={Target}
                            gaugeValue={parseFloat(winRate)}
                        />
                        <StatCard
                            title="Profit Factor"
                            value={pf}
                            type="winrate"
                            icon={Activity}
                            gaugeValue={pfValue}
                            subtext="Target > 1.5"
                        />
                    </div>

                    {/* Row 2: avg win, avg loss, win/loss ratio, exp. value */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Avg Win" value={`$${avgWin}`} type="pnl" icon={ArrowUp} />
                        <StatCard title="Avg Loss" value={`$${avgLoss}`} type="pnl" icon={ArrowDown} />
                        <StatCard
                            title="Win/Loss Ratio"
                            value={`${avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : 0}`}
                            type="neutral"
                            icon={Target}
                            subtext="Ratio w/l"
                        />
                        <StatCard title="Expected Value" value={`$${ev}`} icon={TrendingUp} type="pnl" />
                    </div>

                    {/* Row 3: best trade, worst trade, best day, worst day */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard title="Best Trade" value={`$${bestTrade}`} type="pnl" icon={TrendingUp} />
                        <StatCard title="Worst Trade" value={`$${worstTrade}`} type="pnl" icon={TrendingDown} />
                        <StatCard
                            title="Best Day"
                            value={`$${Math.max(...currentCharts.daily_pnl.map(d => d.DailyPnL), 0).toFixed(2)}`}
                            type="pnl"
                            icon={TrendingUp}
                        />
                        <StatCard
                            title="Worst Day"
                            value={`$${Math.min(...currentCharts.daily_pnl.map(d => d.DailyPnL), 0).toFixed(2)}`}
                            type="pnl"
                            icon={TrendingDown}
                        />
                    </div>

                    {/* Row 4: avg win duration, avg loss duration, avg duration, long/short */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Avg Win Duration"
                            value={`${Math.floor(avgWinDuration / 60)}m ${Math.floor(avgWinDuration % 60)}s`}
                            icon={Timer}
                            subtext="Winning trades"
                        />
                        <StatCard
                            title="Avg Loss Duration"
                            value={`${Math.floor(avgLossDuration / 60)}m ${Math.floor(avgLossDuration % 60)}s`}
                            icon={Timer}
                            subtext="Losing trades"
                        />
                        <StatCard
                            title="Avg Duration"
                            value={`${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s`}
                            icon={Timer}
                            subtext="Overall avg"
                        />
                        <StatCard
                            title="Long / Short"
                            value={
                                <span className="font-mono">
                                    <span className="text-emerald-400">{direction.long_pct}%</span>
                                    <span className="text-slate-600 mx-1">/</span>
                                    <span className="text-red-400">{direction.short_pct}%</span>
                                </span>
                            }
                            icon={TrendingUp}
                            type="neutral"
                            subtext="Direction bias"
                        />
                    </div>

                    {/* Row 5: Total R, Avg R/Day, Reward:Risk, Max Drawdown */}
                    {(() => {
                        // Calculate R-based metrics inline using the rValue input
                        const rv = rValue > 0 ? rValue : 80
                        const totalR = (parseFloat(totalPnL) / rv).toFixed(2)
                        const avgRPerDay = tradingDays > 0
                            ? (parseFloat(totalPnL) / rv / tradingDays).toFixed(2)
                            : '0.00'
                        const avgWinNum = parseFloat(avgWin)
                        const avgLossNum = Math.abs(parseFloat(avgLoss))
                        const rrRatio = avgLossNum > 0
                            ? `${(avgWinNum / avgLossNum).toFixed(2)} : 1`
                            : '— : 1'
                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard
                                    title="Total R"
                                    value={`${totalR}R`}
                                    type="pnl"
                                    icon={TrendingUp}
                                    subtext={`1R = $${rv}`}
                                />
                                <StatCard
                                    title="Avg R / Day"
                                    value={`${avgRPerDay}R`}
                                    type="pnl"
                                    icon={Calendar}
                                    subtext={`${tradingDays} trading day${tradingDays !== 1 ? 's' : ''}`}
                                />
                                <StatCard
                                    title="Reward : Risk"
                                    value={rrRatio}
                                    type="neutral"
                                    icon={Target}
                                    subtext="Avg win / avg loss"
                                />
                                <StatCard
                                    title="Max Drawdown"
                                    value={`-$${maxDrawdown}`}
                                    type="pnl"
                                    icon={TrendingDown}
                                    subtext="Peak-to-trough"
                                />
                            </div>
                        )
                    })()}

                    {/* Calendar View */}
                    <div className="w-full">
                        <CalendarView dailyData={currentCharts.daily_pnl} />
                    </div>

                    {/* Charts */}
                    <div className="w-full">
                        <Charts chartsData={currentCharts} />
                    </div>
                </>
            ) : activeTab === 'trades' ? (
                <TransactionManager
                    trades={localTrades}
                    filteredTrades={filteredTrades}
                    onUpdateTrades={handleUpdateTrades}
                    tagColors={tagColors}
                    onUpdateTagColor={handleUpdateTagColor}
                    dateFilter={dateFilter}
                    onDateFilterChange={setDateFilter}
                    onRefresh={onRefresh}
                />
            ) : activeTab === 'tags' ? (
                <TagAnalyticsPage
                    trades={localTrades}
                    tagColors={tagColors}
                />
            ) : (
                <AdvancedStatsTab />
            )}
        </div>
    )
}

export default Dashboard
