import { useState, useMemo, useEffect } from 'react';
import StatCard from './StatCard';
import TagFilter from './TagFilter';
import useTradeStats from '../hooks/useTradeStats';
import {
    DollarSign, Activity, TrendingUp, Clock, Target,
    ArrowUp, ArrowDown, BarChart2, TrendingDown, Timer,
    Filter
} from 'lucide-react';

/**
 * TagAnalyticsPage - Display statistics for trades filtered by selected tags
 * Supports both AND logic (all tags) and OR logic (any tag)
 */
const TagAnalyticsPage = ({ trades = [], tagColors = {} }) => {
    const [selectedTags, setSelectedTags] = useState([]);
    const [filterMode, setFilterMode] = useState('AND'); // 'AND' or 'OR'

    // Load selected tags and filter mode from localStorage on mount
    useEffect(() => {
        const savedTags = localStorage.getItem('tagAnalytics_selectedTags');
        const savedMode = localStorage.getItem('tagAnalytics_filterMode');

        if (savedTags) {
            try {
                setSelectedTags(JSON.parse(savedTags));
            } catch (e) {
                console.error('Failed to load saved tag filters:', e);
            }
        }

        if (savedMode && (savedMode === 'AND' || savedMode === 'OR')) {
            setFilterMode(savedMode);
        }
    }, []);

    // Save selected tags to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('tagAnalytics_selectedTags', JSON.stringify(selectedTags));
    }, [selectedTags]);

    // Save filter mode to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('tagAnalytics_filterMode', filterMode);
    }, [filterMode]);

    // Extract all unique tags from both Setup Tag and Additional Tag columns
    const allTags = useMemo(() => {
        const tagSet = new Set();
        trades.forEach(trade => {
            // Process Setup Tag
            if (trade['Setup Tag']) {
                trade['Setup Tag'].split(',').forEach(tag => {
                    const trimmed = tag.trim();
                    if (trimmed) tagSet.add(trimmed);
                });
            }
            // Process Additional Tag
            if (trade['Additional Tag']) {
                trade['Additional Tag'].split(',').forEach(tag => {
                    const trimmed = tag.trim();
                    if (trimmed) tagSet.add(trimmed);
                });
            }
        });
        return Array.from(tagSet).sort();
    }, [trades]);

    // Filter trades using AND or OR logic based on filterMode
    const filteredTrades = useMemo(() => {
        if (selectedTags.length === 0) return trades;

        return trades.filter(trade => {
            // Collect all tags from this trade
            const tradeTags = new Set();
            if (trade['Setup Tag']) {
                trade['Setup Tag'].split(',').forEach(tag => {
                    const trimmed = tag.trim();
                    if (trimmed) tradeTags.add(trimmed);
                });
            }
            if (trade['Additional Tag']) {
                trade['Additional Tag'].split(',').forEach(tag => {
                    const trimmed = tag.trim();
                    if (trimmed) tradeTags.add(trimmed);
                });
            }

            // Apply filter based on mode
            if (filterMode === 'AND') {
                // Trade must have ALL selected tags
                return selectedTags.every(selectedTag => tradeTags.has(selectedTag));
            } else {
                // Trade must have ANY of the selected tags (OR logic)
                return selectedTags.some(selectedTag => tradeTags.has(selectedTag));
            }
        });
    }, [trades, selectedTags, filterMode]);

    // Calculate statistics using the custom hook
    const { stats, direction } = useTradeStats(filteredTrades);

    const {
        totalPnL, totalFees, winRate, totalTrades, ev,
        pf, pfValue, bestTrade, worstTrade,
        avgWin, avgLoss,
        avgDuration, avgWinDuration, avgLossDuration
    } = stats;

    return (
        <div className="animate-in fade-in duration-500 slide-in-from-bottom-4 flex flex-col gap-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Filter size={28} className="text-accent" />
                    <h2 className="text-2xl font-bold">Tag Analytics</h2>
                    <span className="text-secondary text-sm">
                        {selectedTags.length > 0
                            ? `Showing ${filteredTrades.length} of ${trades.length} trades`
                            : `${trades.length} total trades`
                        }
                    </span>
                </div>

                {/* AND/OR Toggle */}
                {selectedTags.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary">Filter Mode:</span>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setFilterMode('AND')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${filterMode === 'AND'
                                    ? 'bg-accent text-white shadow-lg'
                                    : 'text-secondary hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                AND
                            </button>
                            <button
                                onClick={() => setFilterMode('OR')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${filterMode === 'OR'
                                    ? 'bg-accent text-white shadow-lg'
                                    : 'text-secondary hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                OR
                            </button>
                        </div>
                        <span className="text-xs text-secondary/70 max-w-[200px]">
                            {filterMode === 'AND' ? 'Trades with ALL tags' : 'Trades with ANY tag'}
                        </span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Left Sidebar - Tag Filter */}
                <div className="lg:col-span-1">
                    <TagFilter
                        allTags={allTags}
                        selectedTags={selectedTags}
                        onTagsChange={setSelectedTags}
                        tagColors={tagColors}
                    />
                </div>

                {/* Right Content - Statistics Grid */}
                <div className="lg:col-span-3">
                    {selectedTags.length === 0 ? (
                        <div className="card h-full flex flex-col items-center justify-center text-center p-12">
                            <Filter size={64} className="text-secondary/30 mb-4" />
                            <h3 className="text-xl font-bold mb-2">Select Tags to Analyze</h3>
                            <p className="text-secondary max-w-md">
                                Choose one or more tags from the filter panel to view statistics. Use the toggle to switch between AND (all tags) or OR (any tag) logic.
                            </p>
                        </div>
                    ) : filteredTrades.length === 0 ? (
                        <div className="card h-full flex flex-col items-center justify-center text-center p-12">
                            <TrendingDown size={64} className="text-danger/50 mb-4" />
                            <h3 className="text-xl font-bold mb-2">No Matching Trades</h3>
                            <p className="text-secondary max-w-md">
                                No trades have <strong>{filterMode === 'AND' ? 'all' : 'any'}</strong> of the selected tags.
                                {filterMode === 'AND'
                                    ? ' Try selecting fewer tags or switch to OR mode.'
                                    : ' Try selecting different tags or switch to AND mode.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Row 1: Total PnL, Total Trades, Total Fees, Profit Factor */}
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

                            {/* Row 2: Avg Win, Avg Loss, Win/Loss Ratio, Expected Value */}
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

                            {/* Row 3: Best Trade, Worst Trade, Best Day, Worst Day */}
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
                                    title="Win Rate"
                                    value={`${winRate}%`}
                                    type="winrate"
                                    icon={Target}
                                    gaugeValue={parseFloat(winRate)}
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

                            {/* Row 4: Avg Win Duration, Avg Loss Duration, Avg Duration, placeholder */}
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
                                    title="Avg PnL per Trade"
                                    value={`$${(parseFloat(totalPnL) / totalTrades).toFixed(2)}`}
                                    type="pnl"
                                    icon={DollarSign}
                                    subtext="Per trade average"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TagAnalyticsPage;
