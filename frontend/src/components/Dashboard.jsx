import { useState, useMemo, useEffect } from 'react'
import StatCard from './StatCard'
import Charts from './Charts'
import CalendarView from './CalendarView'
import TransactionManager from './TransactionManager'
import TagAnalyticsPage from './TagAnalyticsPage'
import DateRangeFilter from './DateRangeFilter'
import useTradeStats from '../hooks/useTradeStats'
import {
    DollarSign, Activity, TrendingUp, Clock, Target,
    ArrowUp, ArrowDown, BarChart2, Calendar, TrendingDown, Timer,
    LayoutDashboard, List, Filter
} from 'lucide-react'

const Dashboard = ({ data }) => {
    const [activeTab, setActiveTab] = useState('stats') // 'stats' or 'trades'
    const [localTrades, setLocalTrades] = useState([])
    const [dateFilter, setDateFilter] = useState({ startDate: null, endDate: null })
    const [tagColors, setTagColors] = useState({
        'Breakout': '#6366f1',
        'Reversal': '#10b981',
        'Trend Following': '#f59e0b',
        'Range': '#94a3b8',
        'Scalp': '#ef4444',
        'Other': '#64748b'
    })

    // Initialize local trades when data changes
    useEffect(() => {
        if (data && data.data) {
            setLocalTrades(data.data)
        }
    }, [data])

    const handleUpdateTagColor = (tag, color) => {
        setTagColors(prev => ({ ...prev, [tag]: color }));
    };

    const handleUpdateTrades = (newTrades) => {
        // Automatically assign colors to new tags from both columns
        newTrades.forEach(t => {
            ['Setup Tag', 'Additional Tag'].forEach(field => {
                if (t[field]) {
                    const tags = t[field].split(',').map(s => s.trim());
                    tags.forEach(tag => {
                        if (tag && !tagColors[tag]) {
                            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                            setTagColors(prev => ({ ...prev, [tag]: randomColor }));
                        }
                    });
                }
            });
        });
        setLocalTrades(newTrades);
    };

    // Safety check for data structure
    if (!data || !data.stats || !data.charts || !data.data) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-red-400 font-mono">
                Error: Invalid Data Structure
            </div>
        )
    }

    // Filter data based on date range
    const filteredTrades = useMemo(() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return localTrades || [];
        return localTrades.filter(t => {
            const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date);
            if (dateFilter.startDate && dayKey < dateFilter.startDate) return false;
            if (dateFilter.endDate && dayKey > dateFilter.endDate) return false;
            return true;
        });
    }, [localTrades, dateFilter]);

    // Recalculate stats based on filtered trades
    // Use the custom hook for stats calculation
    const { stats: currentStats, direction } = useTradeStats(filteredTrades);

    // Prepare charts data based on localTrades
    const currentCharts = useMemo(() => {
        // Simple aggregation for chart (daily pnl)
        const dailyMap = {};
        localTrades.forEach(t => {
            const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date);
            const pnl = t.NetPnL !== undefined ? t.NetPnL : (t.PnL - (t.Fees || 0));
            if (!dailyMap[dayKey]) {
                dailyMap[dayKey] = { Date: dayKey, DailyPnL: 0, TradeCount: 0 };
            }
            dailyMap[dayKey].DailyPnL += pnl;
            dailyMap[dayKey].TradeCount += 1;
        });

        const sortedDays = Object.values(dailyMap).sort((a, b) => a.Date.localeCompare(b.Date));
        let cumulative = 0;
        const daily_pnl = sortedDays.map(d => {
            cumulative += d.DailyPnL;
            return { ...d, CumulativePnL: cumulative };
        });

        // Filter daily pnl for charts
        const filteredDaily = daily_pnl.filter(d => {
            if (dateFilter.startDate && d.Date < dateFilter.startDate) return false;
            if (dateFilter.endDate && d.Date > dateFilter.endDate) return false;
            return true;
        });

        return {
            ...data.charts,
            daily_pnl: filteredDaily
        };
    }, [localTrades, data.charts, dateFilter]);

    const {
        totalPnL, totalFees, winRate, totalTrades, ev,
        pf, pfValue, bestTrade, worstTrade,
        avgWin, avgLoss,
        avgDuration, avgWinDuration, avgLossDuration
    } = currentStats;

    const stats_daily = data.stats.daily || {};

    // Get min/max dates for filter from original charts data (static range)
    const minDate = data.data && data.data.length > 0 ? (data.data[0].Day || data.data[0].Date.split(' ')[0]) : '';
    const maxDate = data.data && data.data.length > 0 ? (data.data[data.data.length - 1].Day || data.data[data.data.length - 1].Date.split(' ')[0]) : '';

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
            </div>

            {activeTab === 'stats' ? (
                <>
                    {/* Date Range Filter */}
                    <DateRangeFilter
                        onFilterChange={setDateFilter}
                        minDate={minDate}
                        maxDate={maxDate}
                    />

                    {/* First row: total PnL, total trades, total fees, profit factor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total PnL"
                            value={`$${totalPnL}`}
                            type="pnl"
                            icon={DollarSign}
                        />
                        <StatCard
                            title="Total Trades"
                            value={totalTrades}
                            icon={BarChart2}
                            subtext={`${stats_daily.most_active_day_trades || 0} max daily volume`}
                        />
                        <StatCard
                            title="Total Fees"
                            value={`$${totalFees}`}
                            type="neutral"
                            icon={DollarSign}
                            subtext="Trading costs"
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

                    {/* Second row: avg win, avg loss, win/loss ratio, exp. value */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Avg Win"
                            value={`$${avgWin}`}
                            type="pnl"
                            icon={ArrowUp}
                        />
                        <StatCard
                            title="Avg Loss"
                            value={`$${avgLoss}`}
                            type="pnl"
                            icon={ArrowDown}
                        />
                        <StatCard
                            title="Win/Loss Ratio"
                            value={`${avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : 0}`}
                            type="neutral"
                            icon={Target}
                            subtext="Ratio w/l"
                        />
                        <StatCard
                            title="Expected Value"
                            value={`$${ev}`}
                            icon={TrendingUp}
                            type="pnl"
                        />
                    </div>

                    {/* Third row: best trade, worst trade, best day, worst day */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Best Trade"
                            value={`$${bestTrade}`}
                            type="pnl"
                            icon={TrendingUp}
                        />
                        <StatCard
                            title="Worst Trade"
                            value={`$${worstTrade}`}
                            type="pnl"
                            icon={TrendingDown}
                        />
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

                    {/* Fourth row: avg win duration, avg loss duration, avg duration, long/short */}
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

                    {/* Calendar View - Full Width */}
                    <div className="w-full">
                        <CalendarView dailyData={currentCharts.daily_pnl} />
                    </div>

                    {/* Charts - Full Width */}
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
                />
            ) : (
                <TagAnalyticsPage
                    trades={localTrades}
                    tagColors={tagColors}
                />
            )}
        </div>
    )
}

export default Dashboard
