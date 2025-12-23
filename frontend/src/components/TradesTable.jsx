import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

const TradesTable = ({ trades }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'Date', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;

    const sortedTrades = useMemo(() => {
        let sortable = [...trades];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                // Parse numbers for PnL, Price
                if (['PnL', 'EntryPrice', 'ExitPrice', 'Duration'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal);
                    bVal = parseFloat(bVal);
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [trades, sortConfig]);

    const paginatedTrades = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return sortedTrades.slice(start, start + rowsPerPage);
    }, [sortedTrades, currentPage]);

    const totalPages = Math.ceil(trades.length / rowsPerPage);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <ArrowUpDown size={14} className="opacity-30" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-accent" /> : <ArrowDown size={14} className="text-accent" />;
    };

    const formatPrice = (p) => p ? parseFloat(p).toFixed(2) : '-';

    // Duration formatter (seconds to MM:SS)
    const formatDuration = (s) => {
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}m ${sec}s`;
    }

    return (
        <div className="card w-full p-0 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-card)]">
                <h3 className="font-bold text-lg">Trade Log</h3>
            </div>

            <div className="table-container flex-grow">
                <table>
                    <thead>
                        <tr>
                            {['Date', 'Symbol', 'Direction', 'EntryPrice', 'ExitPrice', 'Duration', 'PnL'].map(col => (
                                <th key={col} onClick={() => handleSort(col)} className="cursor-pointer hover:text-white transition-colors select-none">
                                    <div className="flex items-center gap-2">
                                        {col === 'EntryPrice' ? 'Entry' : col === 'ExitPrice' ? 'Exit' : col}
                                        <SortIcon column={col} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedTrades.map((trade, idx) => (
                            <tr key={idx} className="group">
                                <td className="font-mono text-secondary">{trade.Date}</td>
                                <td className="font-bold text-white">{trade.Symbol}</td>
                                <td>
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${trade.Direction.toLowerCase().includes('long')
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {trade.Direction.toUpperCase()}
                                    </span>
                                </td>
                                <td className="font-mono">{formatPrice(trade.EntryPrice)}</td>
                                <td className="font-mono">{formatPrice(trade.ExitPrice)}</td>
                                <td className="text-secondary">{formatDuration(trade.Duration)}</td>
                                <td className={`font-mono font-bold ${trade.PnL > 0 ? 'text-success' : 'text-danger'}`}>
                                    {trade.PnL > 0 ? '+' : ''}{parseFloat(trade.PnL).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-[var(--card-border)] flex justify-between items-center text-sm">
                <span className="text-secondary">
                    Showing {paginatedTrades.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, trades.length)} of {trades.length} trades
                </span>
                <div className="flex gap-2">
                    <button
                        className="btn-primary !py-1 !px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Prev
                    </button>
                    <button
                        className="btn-primary !py-1 !px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    )
}

export default TradesTable
