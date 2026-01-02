import { useMemo } from 'react';

/**
 * Custom hook to calculate trading statistics from filtered trades
 * @param {Array} filteredTrades - Array of trade objects
 * @returns {Object} Calculated statistics including PnL, win rate, averages, etc.
 */
const useTradeStats = (filteredTrades) => {
    const stats = useMemo(() => {
        if (!filteredTrades || filteredTrades.length === 0) {
            return {
                totalPnL: 0,
                totalFees: 0,
                winRate: 0,
                totalTrades: 0,
                ev: 0,
                pf: 0,
                pfValue: 0,
                bestTrade: 0,
                worstTrade: 0,
                avgWin: 0,
                avgLoss: 0,
                winBarPct: 50,
                avgDuration: 0,
                avgWinDuration: 0,
                avgLossDuration: 0
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
            const pnl = parseFloat(t.NetPnL !== undefined ? t.NetPnL : (t.PnL - (t.Fees || 0))) || 0;
            const fees = parseFloat(t.Fees) || 0;
            const duration = parseFloat(t.Duration) || 0;

            totalPnL += pnl;
            totalFees += fees;
            totalDuration += duration;

            if (pnl > 0) {
                wins++;
                grossWin += pnl;
                maxWin = Math.max(maxWin, pnl);
                totalWinDuration += duration;
            } else {
                losses++;
                grossLoss += Math.abs(pnl);
                maxLoss = Math.min(maxLoss, pnl);
                totalLossDuration += duration;
            }
        });

        const totalTrades = filteredTrades.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
        const avgWin = wins > 0 ? grossWin / wins : 0;
        const avgLoss = losses > 0 ? -grossLoss / losses : 0;
        const totalAvg = Math.abs(avgWin) + Math.abs(avgLoss);
        const winBarPct = totalAvg > 0 ? (Math.abs(avgWin) / totalAvg) * 100 : 50;
        const ev = totalTrades > 0 ? totalPnL / totalTrades : 0;

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

    // Calculate direction percentages
    const direction = useMemo(() => {
        if (!filteredTrades || filteredTrades.length === 0) {
            return { long_pct: 0, short_pct: 0 };
        }
        const longs = filteredTrades.filter(t => t.Direction?.toLowerCase().includes('long') || t.Direction?.toLowerCase().includes('buy')).length;
        const shorts = filteredTrades.filter(t => t.Direction?.toLowerCase().includes('short') || t.Direction?.toLowerCase().includes('sell')).length;
        return {
            long_pct: ((longs / filteredTrades.length) * 100).toFixed(1),
            short_pct: ((shorts / filteredTrades.length) * 100).toFixed(1)
        };
    }, [filteredTrades]);

    return { stats, direction };
};

export default useTradeStats;
