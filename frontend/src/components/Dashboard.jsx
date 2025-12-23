import { useState, useMemo } from 'react'
import StatCard from './StatCard'
import Charts from './Charts'
import CalendarView from './CalendarView'
import TradesTable from './TradesTable'
import DateRangeFilter from './DateRangeFilter'
import {
    DollarSign, Activity, TrendingUp, Clock, Target,
    ArrowUp, ArrowDown, BarChart2, Calendar, TrendingDown, Timer
} from 'lucide-react'

const Dashboard = ({ data }) => {
    // console.log("Dashboard received data:", data); 
    const [dateFilter, setDateFilter] = useState({ startDate: null, endDate: null })

    // Safety check for data structure
    if (!data || !data.stats || !data.charts || !data.data) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-red-400 font-mono">
                Error: Invalid Data Structure
            </div>
        )
    }

    const { stats, charts, data: rawTrades } = data

    // Get min/max dates for filter
    const minDate = charts.daily_pnl && charts.daily_pnl.length > 0 ? charts.daily_pnl[0].Date : '';
    const maxDate = charts.daily_pnl && charts.daily_pnl.length > 0 ? charts.daily_pnl[charts.daily_pnl.length - 1].Date : '';

    // Filter data based on date range
    const filteredDailyData = useMemo(() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return charts.daily_pnl || [];
        return charts.daily_pnl.filter(d => {
            const date = d.Date;
            if (dateFilter.startDate && date < dateFilter.startDate) return false;
            if (dateFilter.endDate && date > dateFilter.endDate) return false;
            return true;
        });
    }, [charts.daily_pnl, dateFilter]);

    const filteredTrades = useMemo(() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return rawTrades || [];
        return rawTrades.filter(t => {
            const date = t.Date;
            if (dateFilter.startDate && date < dateFilter.startDate) return false;
            if (dateFilter.endDate && date > dateFilter.endDate) return false;
            return true;
        });
    }, [rawTrades, dateFilter]);

    // Recalculate stats based on filtered trades
    const currentStats = useMemo(() => {
        if (!filteredTrades || filteredTrades.length === 0) {
            return {
                totalPnL: 0, totalFees: 0, winRate: 0, totalTrades: 0,
                ev: 0, pf: 0, pfValue: 0,
                bestTrade: 0, worstTrade: 0,
                avgWin: 0, avgLoss: 0, winBarPct: 50,
                avgDuration: 0, avgWinDuration: 0, avgLossDuration: 0
            };
        }

        let totalPnL = 0;
        let totalFees = 0;
        let grossWin = 0;
        let grossLoss = 0;
        let wins = 0;
        let losses = 0;
        let maxWin = -Infinity;
        let maxLoss = Infinity;
        let totalDuration = 0;
        let totalWinDuration = 0;
        let totalLossDuration = 0;

        filteredTrades.forEach(t => {
            const pnl = t.NetPnL !== undefined ? t.NetPnL : (t.PnL - (t.Fees || 0));
            const fees = t.Fees || 0;
            const duration = t.Duration || 0;

            totalPnL += pnl;
            totalFees += fees;
            totalDuration += duration;

            if (pnl > 0) {
                wins++;
                grossWin += pnl;
                maxWin = Math.max(maxWin, pnl);
                totalWinDuration += duration;
            } else {
                losses++; // Break-even counts as loss or separate? Using strict > 0 for win
                grossLoss += Math.abs(pnl);
                maxLoss = Math.min(maxLoss, pnl);
                totalLossDuration += duration;
            }
        });

        const totalTrades = filteredTrades.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
        const avgWin = wins > 0 ? grossWin / wins : 0;
        const avgLoss = losses > 0 ? -grossLoss / losses : 0; // Negative value
        const totalAvg = Math.abs(avgWin) + Math.abs(avgLoss);
        const winBarPct = totalAvg > 0 ? (Math.abs(avgWin) / totalAvg) * 100 : 50;
        const ev = totalTrades > 0 ? totalPnL / totalTrades : 0;

        // Reset best/worst if no data
        if (maxWin === -Infinity) maxWin = 0;
        if (maxLoss === Infinity) maxLoss = 0;

        return {
            totalPnL: totalPnL.toFixed(2),
            totalFees: totalFees.toFixed(2),
            winRate: winRate.toFixed(1),
            totalTrades,
            ev: ev.toFixed(2),
            pf: pf.toFixed(2),
            pfValue: Math.min(pf * 20, 100),
            bestTrade: maxWin.toFixed(2),
            worstTrade: maxLoss.toFixed(2),
            avgWin: avgWin.toFixed(2),
            avgLoss: avgLoss.toFixed(2),
            winBarPct,
            avgDuration: totalTrades > 0 ? Math.round(totalDuration / totalTrades) : 0,
            avgWinDuration: wins > 0 ? Math.round(totalWinDuration / wins) : 0,
            avgLossDuration: losses > 0 ? Math.round(totalLossDuration / losses) : 0
        };
    }, [filteredTrades]);

    const {
        totalPnL, totalFees, winRate, totalTrades, ev,
        pf, pfValue, bestTrade, worstTrade,
        avgWin, avgLoss, winBarPct,
        avgDuration, avgWinDuration, avgLossDuration
    } = currentStats;

    // Default empty objects if any stat group is missing
    const summary = stats.summary || {}
    const duration = stats.duration || {}
    const daily = stats.daily || {}
    const direction = stats.direction || {}

    // We override summary stats with our calculated currentStats
    // but keep daily/direction if needed (though direction should also be recalculated ideally)


    return (
        <div className="animate-in fade-in duration-500 slide-in-from-bottom-4 flex flex-col gap-5 pb-10">
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
                    subtext={`${daily.most_active_day_trades || 0} max daily volume`}
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
                    value={`$${(daily.best_day || 0).toFixed(2)}`}
                    type="pnl"
                    icon={TrendingUp}
                />
                <StatCard
                    title="Worst Day"
                    value={`$${(daily.worst_day || 0).toFixed(2)}`}
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
                            <span className="text-emerald-400">{direction.long_pct || 0}%</span>
                            <span className="text-slate-600 mx-1">/</span>
                            <span className="text-red-400">{direction.short_pct || 0}%</span>
                        </span>
                    }
                    icon={TrendingUp}
                    type="neutral"
                    subtext="Direction bias"
                />
            </div>

            {/* Calendar View - Full Width */}
            <div className="w-full">
                <CalendarView dailyData={filteredDailyData} />
            </div>

            {/* Charts - Full Width */}
            <div className="w-full">
                <Charts chartsData={charts} />
            </div>

            {/* Bottom Section: Trades Table */}
            <div className="w-full">
                <TradesTable trades={filteredTrades || []} />
            </div>
        </div>
    )
}

export default Dashboard
