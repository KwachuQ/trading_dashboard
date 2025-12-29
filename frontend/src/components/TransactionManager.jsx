import { useState, useMemo, useCallback, useEffect } from 'react'
import {
    ArrowUpDown, ArrowUp, ArrowDown,
    Trash2, GitMerge, RotateCcw, RotateCw,
    Download, CheckSquare, Square, Edit2,
    Calendar, Palette, X, Plus
} from 'lucide-react'
import DateRangeFilter from './DateRangeFilter'

const TransactionManager = ({
    trades = [],
    filteredTrades = [],
    onUpdateTrades = () => { },
    tagColors = {},
    onUpdateTagColor = () => { },
    dateFilter = { startDate: null, endDate: null },
    onDateFilterChange = () => { }
}) => {
    const [sortConfig, setSortConfig] = useState({ key: 'Date', direction: 'desc' });
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [history, setHistory] = useState([trades]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [activeColorTag, setActiveColorTag] = useState(null);
    const [editingTradeId, setEditingTradeId] = useState(null);
    const [editingField, setEditingField] = useState(null); // 'Setup Tag' or 'Additional Tag'
    const [newTagValue, setNewTagValue] = useState('');

    const presetColors = [
        '#ff4d4d', // Red
        '#00e676', // Green
        '#2979ff', // Blue
        '#ffea00', // Yellow
        '#d500f9', // Purple
        '#ff9100', // Orange
        '#ffffff', // White
        '#ff4081', // Pink
        '#bcaaa4', // Bronze
        '#00e5ff'  // Cyan
    ];

    // Sorting logic
    const displayedTrades = useMemo(() => {
        let sortable = [...filteredTrades];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (['PnL', 'NetPnL', 'EntryPrice', 'ExitPrice', 'Duration', 'Size', 'Fees'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredTrades, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleRow = (idx) => {
        const next = new Set(selectedRows);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedRows(next);
    };

    const toggleAll = () => {
        if (selectedRows.size === filteredTrades.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredTrades.map((_, i) => i)));
        }
    };

    const updateHistory = (newTrades) => {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push(newTrades);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
        onUpdateTrades(newTrades);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const nextIdx = historyIndex - 1;
            setHistoryIndex(nextIdx);
            onUpdateTrades(history[nextIdx]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextIdx = historyIndex + 1;
            setHistoryIndex(nextIdx);
            onUpdateTrades(history[nextIdx]);
        }
    };

    const handleMerge = () => {
        if (selectedRows.size < 2) return;

        const indices = Array.from(selectedRows).sort((a, b) => a - b);
        const selectedTrades = indices.map(idx => filteredTrades[idx]);

        const mergedTrade = {
            ...selectedTrades[0],
            isMerged: true,
            mergeId: Date.now()
        };

        mergedTrade.PnL = selectedTrades.reduce((sum, t) => sum + (parseFloat(t.PnL) || 0), 0);
        mergedTrade.NetPnL = selectedTrades.reduce((sum, t) => sum + (parseFloat(t.NetPnL) || (parseFloat(t.PnL) - (parseFloat(t.Fees) || 0))), 0);
        mergedTrade.Size = selectedTrades.reduce((sum, t) => sum + (parseFloat(t.Size) || 0), 0);
        mergedTrade.Fees = selectedTrades.reduce((sum, t) => sum + (parseFloat(t.Fees) || 0), 0);

        const allEntryDates = selectedTrades.map(t => t.EntryDate || t.Date).filter(Boolean).sort();
        const allExitDates = selectedTrades.map(t => t.ExitDate || t.Date).filter(Boolean).sort();

        mergedTrade.Date = allEntryDates[0];
        mergedTrade.EntryDate = allEntryDates[0];
        mergedTrade.ExitDate = allExitDates[allExitDates.length - 1];

        mergedTrade['Setup Tag'] = selectedTrades.map(t => t['Setup Tag']).filter(Boolean).join(', ');
        mergedTrade['Additional Tag'] = selectedTrades.map(t => t['Additional Tag']).filter(Boolean).join(', ');
        mergedTrade['Comments'] = selectedTrades.map(t => t['Comments']).filter(Boolean).join(' | ');

        const selectedSet = new Set(selectedTrades);
        const newTrades = [mergedTrade, ...trades.filter(t => !selectedSet.has(t))];

        setSelectedRows(new Set());
        updateHistory(newTrades);
    };

    const handleEdit = (trade, key, value) => {
        const newTrades = trades.map(t => {
            if (t === trade || (t.mergeId && t.mergeId === trade.mergeId)) return { ...t, [key]: value };
            return t;
        });
        updateHistory(newTrades);
    };

    const handleAddTag = (trade, field, tagToAdd) => {
        const val = tagToAdd || newTagValue;
        if (!val.trim()) {
            setEditingTradeId(null);
            setEditingField(null);
            setNewTagValue('');
            return;
        }

        const currentVal = trade[field] || '';
        const tags = currentVal.split(',').map(s => s.trim()).filter(Boolean);

        // If it's Additional Tag and empty, we might want to include Direction, 
        // but if the user is explicitly adding a tag, maybe they want to start fresh?
        // Let's stick to appending.

        if (!tags.includes(val.trim()) && tags.length < 5) {
            const newVal = [...tags, val.trim()].join(', ');
            handleEdit(trade, field, newVal);
        }

        setNewTagValue('');
        setEditingTradeId(null);
        setEditingField(null);
    };

    const handleRemoveTag = (trade, field, tagToRemove) => {
        const currentVal = trade[field] || '';
        const tags = currentVal.split(',').map(s => s.trim()).filter(Boolean);
        const newVal = tags.filter(t => t !== tagToRemove).join(', ');
        handleEdit(trade, field, newVal);
    };

    const exportToCSV = () => {
        if (!trades.length) return;
        const headers = Object.keys(trades[0]).filter(h => !h.startsWith('_') && h !== 'Date_Obj');
        const csvRows = [
            headers.join(','),
            ...trades.map(row => headers.map(header => {
                const val = row[header];
                return `"${val === undefined || val === null ? '' : val}"`;
            }).join(','))
        ];

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `trades_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const existingTags = useMemo(() => {
        const tags = new Set();
        trades.forEach(t => {
            if (t['Setup Tag']) t['Setup Tag'].split(',').forEach(s => tags.add(s.trim()));
            if (t['Additional Tag']) t['Additional Tag'].split(',').forEach(s => tags.add(s.trim()));
        });
        return Array.from(tags).sort();
    }, [trades]);

    const renderTags = (trade, field, tradeId) => {
        const currentTagsRaw = trade[field] || '';
        let tags = currentTagsRaw.split(',').map(s => s.trim()).filter(Boolean);

        // Filter out redundant tags (Long/Short) if they match Direction
        if (field === 'Additional Tag' && trade.Direction) {
            const dir = trade.Direction.toLowerCase();
            tags = tags.filter(t => t.toLowerCase() !== dir && t.toLowerCase() !== 'long' && t.toLowerCase() !== 'short');
        }

        const isEditing = editingTradeId === tradeId && editingField === field;

        return (
            <div className="flex flex-wrap gap-2 items-center">
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="tag-badge relative overflow-visible flex items-center gap-2 group/tag"
                        style={{
                            backgroundColor: (tagColors[tag] || '#64748b') + '20',
                            color: tagColors[tag] || '#94a3b8',
                            border: `1px solid ${tagColors[tag] || '#94a3b8'}40`,
                            padding: '0.4rem 0.8rem'
                        }}
                    >
                        {tag}
                        <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-1.5 opacity-40 group-hover/tag:opacity-100 transition-opacity">
                            <button
                                className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform"
                                style={{ backgroundColor: tagColors[tag] || '#94a3b8' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const key = `${tradeId}-${tag}`;
                                    setActiveColorTag(activeColorTag === key ? null : key);
                                }}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(trade, field, tag); }}
                                className="hover:text-red-400 transition-colors p-0.5"
                            >
                                <X size={12} />
                            </button>
                        </div>

                        {activeColorTag === `${tradeId}-${tag}` && (
                            <div className="color-picker-popover" onClick={e => e.stopPropagation()}>
                                <div className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-3 border-b border-white/5 pb-2">
                                    Pick Color
                                </div>
                                <div className="grid grid-cols-5 gap-3">
                                    {presetColors.map(color => (
                                        <div
                                            key={color}
                                            className="color-swatch"
                                            style={{ backgroundColor: color }}
                                            onClick={() => {
                                                onUpdateTagColor(tag, color);
                                                setActiveColorTag(null);
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </span>
                ))}

                {isEditing ? (
                    <div className="flex items-center gap-1">
                        <input
                            autoFocus
                            list="setup-tags-list"
                            className="bg-white/10 border border-accent/50 p-2 rounded outline-none focus:border-accent transition-all text-sm w-36"
                            placeholder="Type and Enter..."
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTag(trade, field);
                                if (e.key === 'Escape') {
                                    setEditingTradeId(null);
                                    setEditingField(null);
                                    setNewTagValue('');
                                }
                            }}
                            onBlur={(e) => {
                                // Add if they typed something, otherwise just close
                                setTimeout(() => {
                                    if (editingTradeId === tradeId) {
                                        if (newTagValue.trim()) {
                                            handleAddTag(trade, field);
                                        } else {
                                            setEditingTradeId(null);
                                            setEditingField(null);
                                            setNewTagValue('');
                                        }
                                    }
                                }, 250);
                            }}
                        />
                    </div>
                ) : (
                    tags.length < 5 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingTradeId(tradeId);
                                setEditingField(field);
                                setNewTagValue('');
                            }}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-accent/20 hover:text-accent flex items-center justify-center transition-all border border-white/10"
                            title="Add Tag"
                        >
                            <Plus size={16} />
                        </button>
                    )
                )}
            </div>
        );
    };

    return (
        <div className="card w-full p-0 overflow-hidden flex flex-col min-h-[600px]">
            <datalist id="setup-tags-list">
                {existingTags.map(tag => (
                    <option key={tag} value={tag} />
                ))}
            </datalist>

            <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-card)] flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-6">
                    <h3 className="font-bold text-xl">Transaction Manager</h3>
                    <DateRangeFilter filter={dateFilter} onFilterChange={onDateFilterChange} compact />
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white/5 rounded-lg p-1 mr-2 border border-white/5">
                        <button className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30" onClick={undo} disabled={historyIndex === 0} title="Undo"><RotateCcw size={20} /></button>
                        <button className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><RotateCw size={20} /></button>
                    </div>
                    <button className={`btn-primary flex items-center gap-2 !py-2 !px-4 ${selectedRows.size < 2 ? 'opacity-50 cursor-not-allowed' : 'bg-accent border-accent'}`} onClick={handleMerge} disabled={selectedRows.size < 2}><GitMerge size={20} /> Merge ({selectedRows.size})</button>
                    <button className="btn-primary flex items-center gap-2 !py-2 !px-4 bg-white/5 hover:bg-white/10 border border-white/10" onClick={exportToCSV}><Download size={20} /> Export CSV</button>
                </div>
            </div>

            <div className="table-container flex-grow overflow-auto max-h-[75vh]">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                        <tr>
                            <th className="w-10 px-4">
                                <button onClick={toggleAll} className="text-secondary hover:text-white">
                                    {selectedRows.size === displayedTrades.length && displayedTrades.length > 0 ? <CheckSquare size={22} /> : <Square size={22} />}
                                </button>
                            </th>
                            {['EntryDate', 'ExitDate', 'Symbol', 'PnL', 'Direction', 'Size', 'Setup Tag', 'Additional Tag', 'Setup Rating', 'Comments'].map(col => (
                                <th key={col} onClick={() => handleSort(col)} className="cursor-pointer hover:text-white py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="uppercase tracking-wider text-xs whitespace-nowrap">{col}</span>
                                        {sortConfig.key === col && (sortConfig.direction === 'asc' ? <ArrowUp size={16} className="text-accent" /> : <ArrowDown size={16} className="text-accent" />)}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--card-border)]">
                        {displayedTrades.map((trade, idx) => {
                            const isSelected = selectedRows.has(idx);
                            const tradeId = trade._row_id || trade.mergeId || `trade-${idx}`;

                            return (
                                <tr key={tradeId} className={`group hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-accent/5' : ''} ${trade.isMerged ? 'merge-highlight' : ''}`}>
                                    <td className="px-4">
                                        <button onClick={() => toggleRow(idx)} className={`${isSelected ? 'text-accent' : 'text-secondary/50'} hover:text-accent`}>
                                            {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
                                        </button>
                                    </td>
                                    <td className="font-mono text-secondary text-base min-w-[240px] whitespace-nowrap py-4">
                                        {trade.EntryDate || trade.Date}
                                    </td>
                                    <td className="font-mono text-secondary text-base min-w-[240px] whitespace-nowrap py-4">
                                        {trade.ExitDate || trade.Date}
                                    </td>
                                    <td className="font-bold text-white text-base py-4">{trade.Symbol}</td>
                                    <td className={`font-mono font-bold text-base py-4 ${parseFloat(trade.PnL) > 0 ? 'text-success' : 'text-danger'}`}>
                                        {parseFloat(trade.PnL) > 0 ? '+' : ''}{parseFloat(trade.PnL).toFixed(2)}
                                    </td>
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${trade.Direction?.toLowerCase().includes('long')
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                            {trade.Direction}
                                        </span>
                                    </td>
                                    <td className="font-mono text-secondary text-base py-4">{trade.Size || '-'}</td>
                                    <td className="min-w-[280px] py-4">{renderTags(trade, 'Setup Tag', tradeId)}</td>
                                    <td className="min-w-[280px] py-4">{renderTags(trade, 'Additional Tag', tradeId)}</td>
                                    <td className="py-4">
                                        <select className="bg-transparent border border-transparent hover:border-white/10 p-2 rounded w-full outline-none focus:border-accent transition-all text-sm" value={trade['Setup Rating'] || ''} onChange={(e) => handleEdit(trade, 'Setup Rating', e.target.value)}>
                                            <option value="" className="bg-[var(--bg-card)]">-</option>
                                            {['5', '4', '3', '2', '1'].map(v => <option key={v} value={v} className="bg-[var(--bg-card)]">{v}</option>)}
                                        </select>
                                    </td>
                                    <td className="py-4">
                                        <input type="text" className="bg-transparent border border-transparent hover:border-white/10 p-2 rounded w-full outline-none focus:border-accent transition-all placeholder:opacity-20 text-sm" placeholder="Add comments..." value={trade['Comments'] || ''} onChange={(e) => handleEdit(trade, 'Comments', e.target.value)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-[var(--card-border)] bg-black/10 flex justify-between items-center text-sm text-secondary">
                <div className="flex gap-4">
                    <span>* Multi-tags (max 5) appends to list</span>
                    <span className="text-accent/80 font-medium">| Showing raw timestamps from CSV file</span>
                </div>
                <span className="italic">Highlighted rows are recent merges</span>
            </div>
        </div>
    );
};

export default TransactionManager;
