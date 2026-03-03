import { useState, useMemo, useCallback, useRef } from 'react'
import {
    ArrowUp, ArrowDown,
    GitMerge, RotateCcw, RotateCw,
    Download, CheckSquare, Square,
    X, Plus, Loader2, Trash2, Filter, ChevronDown, ChevronUp
} from 'lucide-react'

const API_BASE = 'http://localhost:8000'

/**
 * Transaction Manager — trade table with inline editing.
 *
 * Supports:
 *   - Tag/rating/comment editing persisted to the database
 *   - Undo/redo for local state
 *   - Trade merging via API
 *   - Trade deletion with confirmation and stats refresh
 *   - Column filtering (symbol, direction, size, date, tags, rating)
 *   - Comment hover tooltip showing full text
 *   - CSV export
 */
const TransactionManager = ({
    trades = [],
    filteredTrades = [],
    onUpdateTrades = () => { },
    tagColors = {},
    onUpdateTagColor = () => { },
    dateFilter = { startDate: null, endDate: null },
    onDateFilterChange = () => { },
    onRefresh = () => { }
}) => {
    // ---------------------------------------------------------------
    // Sorting state
    // ---------------------------------------------------------------
    const [sortConfig, setSortConfig] = useState({ key: 'Date', direction: 'desc' })

    // ---------------------------------------------------------------
    // Selection state (for merge)
    // ---------------------------------------------------------------
    const [selectedRows, setSelectedRows] = useState(new Set())

    // ---------------------------------------------------------------
    // Undo/redo history
    // ---------------------------------------------------------------
    const [history, setHistory] = useState([trades])
    const [historyIndex, setHistoryIndex] = useState(0)

    // ---------------------------------------------------------------
    // Tag editing state
    // ---------------------------------------------------------------
    const [activeColorTag, setActiveColorTag] = useState(null)
    const [editingTradeId, setEditingTradeId] = useState(null)
    const [editingField, setEditingField] = useState(null)
    const [newTagValue, setNewTagValue] = useState('')

    // ---------------------------------------------------------------
    // Loading states
    // ---------------------------------------------------------------
    const [saving, setSaving] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    // ---------------------------------------------------------------
    // Filter panel state
    // ---------------------------------------------------------------
    const [showFilters, setShowFilters] = useState(false)
    const [filterSymbol, setFilterSymbol] = useState('')
    const [filterDirection, setFilterDirection] = useState('all')
    const [filterSizeMin, setFilterSizeMin] = useState('')
    const [filterSizeMax, setFilterSizeMax] = useState('')
    const [filterDateStart, setFilterDateStart] = useState('')
    const [filterDateEnd, setFilterDateEnd] = useState('')
    const [filterSetupTag, setFilterSetupTag] = useState('')
    const [filterAdditionalTag, setFilterAdditionalTag] = useState('')
    const [filterRating, setFilterRating] = useState('')

    // Debounce timer ref for comment saves
    const saveTimerRef = useRef({})

    const presetColors = [
        '#ff4d4d', '#00e676', '#2979ff', '#ffea00', '#d500f9',
        '#ff9100', '#ffffff', '#ff4081', '#bcaaa4', '#00e5ff'
    ]

    // ---------------------------------------------------------------
    // Filter application — runs on top of filteredTrades (date-filtered)
    // ---------------------------------------------------------------
    const tableFilteredTrades = useMemo(() => {
        let result = [...filteredTrades]

        // Symbol filter (case-insensitive partial match)
        if (filterSymbol.trim()) {
            const sym = filterSymbol.trim().toLowerCase()
            result = result.filter(t =>
                (t.Symbol || '').toLowerCase().includes(sym)
            )
        }

        // Direction filter
        if (filterDirection !== 'all') {
            result = result.filter(t => {
                const dir = (t.Direction || '').toLowerCase()
                if (filterDirection === 'long') return dir.includes('long') || dir.includes('buy')
                if (filterDirection === 'short') return dir.includes('short') || dir.includes('sell')
                return true
            })
        }

        // Position size min/max
        if (filterSizeMin !== '') {
            result = result.filter(t => (parseFloat(t.Size) || 0) >= parseFloat(filterSizeMin))
        }
        if (filterSizeMax !== '') {
            result = result.filter(t => (parseFloat(t.Size) || 0) <= parseFloat(filterSizeMax))
        }

        // Date start/end (trade entry date)
        if (filterDateStart) {
            result = result.filter(t => {
                const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date)
                return dayKey >= filterDateStart
            })
        }
        if (filterDateEnd) {
            result = result.filter(t => {
                const dayKey = t.Day || (t.Date && t.Date.includes(' ') ? t.Date.split(' ')[0] : t.Date)
                return dayKey <= filterDateEnd
            })
        }

        // Setup Tag filter (exact match within comma-separated list)
        if (filterSetupTag) {
            result = result.filter(t => {
                const tags = (t['Setup Tag'] || '').split(',').map(s => s.trim())
                return tags.includes(filterSetupTag)
            })
        }

        // Additional Tag filter
        if (filterAdditionalTag) {
            result = result.filter(t => {
                const tags = (t['Additional Tag'] || '').split(',').map(s => s.trim())
                return tags.includes(filterAdditionalTag)
            })
        }

        // Setup Rating filter
        if (filterRating) {
            result = result.filter(t => String(t['Setup Rating']) === filterRating)
        }

        return result
    }, [
        filteredTrades,
        filterSymbol, filterDirection, filterSizeMin, filterSizeMax,
        filterDateStart, filterDateEnd, filterSetupTag, filterAdditionalTag, filterRating
    ])

    // Check whether any filter is active
    const isFilterActive = filterSymbol || filterDirection !== 'all' || filterSizeMin !== '' ||
        filterSizeMax !== '' || filterDateStart || filterDateEnd ||
        filterSetupTag || filterAdditionalTag || filterRating

    /** Reset all column filters to defaults. */
    const clearFilters = useCallback(() => {
        setFilterSymbol('')
        setFilterDirection('all')
        setFilterSizeMin('')
        setFilterSizeMax('')
        setFilterDateStart('')
        setFilterDateEnd('')
        setFilterSetupTag('')
        setFilterAdditionalTag('')
        setFilterRating('')
    }, [])

    // ---------------------------------------------------------------
    // Sorting
    // ---------------------------------------------------------------
    const displayedTrades = useMemo(() => {
        let sortable = [...tableFilteredTrades]
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let aVal = a[sortConfig.key]
                let bVal = b[sortConfig.key]

                if (['PnL', 'NetPnL', 'EntryPrice', 'ExitPrice', 'Duration', 'Size', 'Fees'].includes(sortConfig.key)) {
                    aVal = parseFloat(aVal) || 0
                    bVal = parseFloat(bVal) || 0
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }
        return sortable
    }, [tableFilteredTrades, sortConfig])

    const handleSort = (key) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    // ---------------------------------------------------------------
    // Row selection (for merge)
    // ---------------------------------------------------------------
    const toggleRow = (idx) => {
        const next = new Set(selectedRows)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        setSelectedRows(next)
    }

    const toggleAll = () => {
        if (selectedRows.size === displayedTrades.length) {
            setSelectedRows(new Set())
        } else {
            setSelectedRows(new Set(displayedTrades.map((_, i) => i)))
        }
    }

    // ---------------------------------------------------------------
    // Undo / redo
    // ---------------------------------------------------------------
    const updateHistory = useCallback((newTrades) => {
        const nextHistory = history.slice(0, historyIndex + 1)
        nextHistory.push(newTrades)
        setHistory(nextHistory)
        setHistoryIndex(nextHistory.length - 1)
        onUpdateTrades(newTrades)
    }, [history, historyIndex, onUpdateTrades])

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const nextIdx = historyIndex - 1
            setHistoryIndex(nextIdx)
            onUpdateTrades(history[nextIdx])
        }
    }, [historyIndex, history, onUpdateTrades])

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIdx = historyIndex + 1
            setHistoryIndex(nextIdx)
            onUpdateTrades(history[nextIdx])
        }
    }, [historyIndex, history, onUpdateTrades])

    // ---------------------------------------------------------------
    // Backend persistence helpers
    // ---------------------------------------------------------------

    /** Persist tag update to the database. */
    const persistTags = useCallback(async (tradeId, setupTag, additionalTag) => {
        if (!tradeId) return
        try {
            await fetch(`${API_BASE}/trades/${tradeId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    setup_tag: setupTag ?? null,
                    additional_tag: additionalTag ?? null,
                }),
            })
        } catch (err) {
            console.error('Failed to persist tags:', err)
        }
    }, [])

    /** Persist metadata (rating, comments) to the database. */
    const persistMetadata = useCallback(async (tradeId, rating, comments) => {
        if (!tradeId) return
        try {
            await fetch(`${API_BASE}/trades/${tradeId}/metadata`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    setup_rating: rating !== undefined ? rating : null,
                    comments: comments !== undefined ? comments : null,
                }),
            })
        } catch (err) {
            console.error('Failed to persist metadata:', err)
        }
    }, [])

    // ---------------------------------------------------------------
    // Delete trade — with confirmation and full stats refresh
    // ---------------------------------------------------------------

    /**
     * Delete a trade by ID.
     *
     * Shows a native confirmation dialog, then calls the backend DELETE
     * endpoint which returns refreshed trades, stats, and charts.
     * Calls onUpdateTrades so Dashboard re-derives stats via useTradeStats.
     */
    const handleDelete = useCallback(async (trade) => {
        const tradeId = trade.id || trade._row_id
        if (!tradeId) return

        const confirmed = window.confirm(
            `Delete trade #${tradeId} (${trade.Symbol || ''} ${trade.Direction || ''}, PnL: ${parseFloat(trade.PnL).toFixed(2)})?\n\nThis action cannot be undone.`
        )
        if (!confirmed) return

        setDeletingId(tradeId)
        try {
            const resp = await fetch(`${API_BASE}/trades/${tradeId}`, {
                method: 'DELETE',
            })
            if (!resp.ok) {
                const errData = await resp.json()
                console.error('Delete failed:', errData)
                return
            }
            const data = await resp.json()
            // Update parent state with the refreshed list — Dashboard's
            // useTradeStats hook will automatically recompute all stats.
            onUpdateTrades(data.trades)
            // Also clear any selection that referenced the deleted row
            setSelectedRows(new Set())
        } catch (err) {
            console.error('Delete request failed:', err)
        } finally {
            setDeletingId(null)
        }
    }, [onUpdateTrades])

    // ---------------------------------------------------------------
    // Merge — persistent
    // ---------------------------------------------------------------

    const handleMerge = useCallback(async () => {
        if (selectedRows.size < 2) return

        const indices = Array.from(selectedRows).sort((a, b) => a - b)
        const selectedTrades = indices.map(idx => displayedTrades[idx])
        const tradeIds = selectedTrades.map(t => t.id).filter(Boolean)

        if (tradeIds.length < 2) return

        setSaving(true)
        try {
            const resp = await fetch(`${API_BASE}/trades/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trade_ids: tradeIds }),
            })
            if (!resp.ok) {
                const err = await resp.json()
                console.error('Merge failed:', err)
                return
            }

            const data = await resp.json()
            setSelectedRows(new Set())
            onUpdateTrades(data.trades)
        } catch (err) {
            console.error('Merge request failed:', err)
        } finally {
            setSaving(false)
        }
    }, [selectedRows, displayedTrades, onUpdateTrades])

    // ---------------------------------------------------------------
    // Edit handlers — with DB persistence
    // ---------------------------------------------------------------

    const handleEdit = useCallback((trade, key, value) => {
        const newTrades = trades.map(t => {
            if (t === trade || t.id === trade.id) return { ...t, [key]: value }
            return t
        })
        updateHistory(newTrades)

        const tradeId = trade.id || trade._row_id
        if (key === 'Setup Tag' || key === 'Additional Tag') {
            const updatedTrade = newTrades.find(t => t.id === trade.id)
            persistTags(
                tradeId,
                key === 'Setup Tag' ? value : updatedTrade?.['Setup Tag'],
                key === 'Additional Tag' ? value : updatedTrade?.['Additional Tag']
            )
        } else if (key === 'Setup Rating') {
            persistMetadata(tradeId, value ? parseInt(value) : null, undefined)
        } else if (key === 'Comments') {
            // Debounce comment saves — user types continuously
            if (saveTimerRef.current[tradeId]) {
                clearTimeout(saveTimerRef.current[tradeId])
            }
            saveTimerRef.current[tradeId] = setTimeout(() => {
                persistMetadata(tradeId, undefined, value)
            }, 600)
        }
    }, [trades, updateHistory, persistTags, persistMetadata])

    const handleAddTag = useCallback((trade, field, tagToAdd) => {
        const val = tagToAdd || newTagValue
        if (!val.trim()) {
            setEditingTradeId(null)
            setEditingField(null)
            setNewTagValue('')
            return
        }

        const currentVal = trade[field] || ''
        const tags = currentVal.split(',').map(s => s.trim()).filter(Boolean)

        if (!tags.includes(val.trim()) && tags.length < 10) {
            const newVal = [...tags, val.trim()].join(', ')
            handleEdit(trade, field, newVal)
        }

        setNewTagValue('')
        setEditingTradeId(null)
        setEditingField(null)
    }, [newTagValue, handleEdit])

    const handleRemoveTag = useCallback((trade, field, tagToRemove) => {
        const currentVal = trade[field] || ''
        const tags = currentVal.split(',').map(s => s.trim()).filter(Boolean)
        const newVal = tags.filter(t => t !== tagToRemove).join(', ')
        handleEdit(trade, field, newVal)
    }, [handleEdit])

    // ---------------------------------------------------------------
    // CSV Export
    // ---------------------------------------------------------------

    const exportToCSV = () => {
        if (!trades.length) return
        const headers = Object.keys(trades[0]).filter(
            h => !h.startsWith('_') && h !== 'Date_Obj'
        )
        const csvRows = [
            headers.join(','),
            ...trades.map(row => headers.map(header => {
                const val = row[header]
                return `"${val === undefined || val === null ? '' : val}"`
            }).join(','))
        ]
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `trades_export_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // ---------------------------------------------------------------
    // Derived values for filter dropdowns
    // ---------------------------------------------------------------

    const existingTags = useMemo(() => {
        const tags = new Set()
        trades.forEach(t => {
            if (t['Setup Tag']) t['Setup Tag'].split(',').forEach(s => tags.add(s.trim()))
            if (t['Additional Tag']) t['Additional Tag'].split(',').forEach(s => tags.add(s.trim()))
        })
        return Array.from(tags).filter(Boolean).sort()
    }, [trades])

    const existingSymbols = useMemo(() => {
        const syms = new Set(trades.map(t => t.Symbol).filter(Boolean))
        return Array.from(syms).sort()
    }, [trades])

    // ---------------------------------------------------------------
    // Tag rendering with color picker
    // ---------------------------------------------------------------

    const renderTags = (trade, field, tradeId) => {
        const currentTagsRaw = trade[field] || ''
        const tags = currentTagsRaw.split(',').map(s => s.trim()).filter(Boolean)

        const isEditing = editingTradeId === tradeId && editingField === field

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
                                    e.stopPropagation()
                                    const key = `${tradeId}-${tag}`
                                    setActiveColorTag(activeColorTag === key ? null : key)
                                }}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTag(trade, field, tag) }}
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
                                                onUpdateTagColor(tag, color)
                                                setActiveColorTag(null)
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
                                if (e.key === 'Enter') handleAddTag(trade, field)
                                if (e.key === 'Escape') {
                                    setEditingTradeId(null)
                                    setEditingField(null)
                                    setNewTagValue('')
                                }
                            }}
                            onBlur={() => {
                                setTimeout(() => {
                                    if (editingTradeId === tradeId) {
                                        if (newTagValue.trim()) {
                                            handleAddTag(trade, field)
                                        } else {
                                            setEditingTradeId(null)
                                            setEditingField(null)
                                            setNewTagValue('')
                                        }
                                    }
                                }, 250)
                            }}
                        />
                    </div>
                ) : (
                    tags.length < 10 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setEditingTradeId(tradeId)
                                setEditingField(field)
                                setNewTagValue('')
                            }}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-accent/20 hover:text-accent flex items-center justify-center transition-all border border-white/10"
                            title="Add Tag"
                        >
                            <Plus size={16} />
                        </button>
                    )
                )}
            </div>
        )
    }

    // ---------------------------------------------------------------
    // Comment tooltip rendering
    // ---------------------------------------------------------------

    /**
     * Render a comment cell with a hover tooltip.
     *
     * The full comment text appears in an absolutely-positioned popup
     * on hover so that users can read long comments without the cell
     * expanding the column.
     */
    const renderComment = (trade) => {
        const text = trade['Comments'] || ''
        return (
            <div className="comment-tooltip-wrapper">
                <input
                    type="text"
                    className="bg-transparent border border-transparent hover:border-white/10 p-2 rounded w-full outline-none focus:border-accent transition-all placeholder:opacity-20 text-sm"
                    placeholder="Add comments..."
                    value={text}
                    onChange={(e) => handleEdit(trade, 'Comments', e.target.value)}
                />
                {text && (
                    <div className="comment-tooltip">
                        {text}
                    </div>
                )}
            </div>
        )
    }

    // ---------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------

    return (
        <div className="card w-full p-0 overflow-hidden flex flex-col min-h-[600px]">
            <datalist id="setup-tags-list">
                {existingTags.map(tag => (
                    <option key={tag} value={tag} />
                ))}
            </datalist>

            {/* ---- Header toolbar ---- */}
            <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-card)] flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-6">
                    <h3 className="font-bold text-xl">Transaction Manager</h3>
                    <span className="text-sm text-secondary bg-white/5 px-3 py-1 rounded-full border border-white/10">
                        {displayedTrades.length} trades
                        {displayedTrades.length !== trades.length && ` (filtered from ${trades.length})`}
                    </span>
                    {/* Filter toggle button */}
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${isFilterActive
                            ? 'bg-accent/20 border-accent/50 text-accent'
                            : 'bg-white/5 border-white/10 text-secondary hover:text-white hover:bg-white/10'
                            }`}
                        title="Toggle filters"
                    >
                        <Filter size={16} />
                        Filters
                        {isFilterActive && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-bold">
                                ON
                            </span>
                        )}
                        {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {saving && (
                        <Loader2 size={18} className="animate-spin text-accent mr-2" />
                    )}
                    <div className="flex items-center bg-white/5 rounded-lg p-1 mr-2 border border-white/5">
                        <button className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30" onClick={undo} disabled={historyIndex === 0} title="Undo"><RotateCcw size={20} /></button>
                        <button className="p-1.5 hover:bg-white/10 rounded disabled:opacity-30" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><RotateCw size={20} /></button>
                    </div>
                    <button
                        className={`btn-primary flex items-center gap-2 !py-2 !px-4 ${selectedRows.size < 2 ? 'opacity-50 cursor-not-allowed' : 'bg-accent border-accent'}`}
                        onClick={handleMerge}
                        disabled={selectedRows.size < 2}
                    >
                        <GitMerge size={20} /> Merge ({selectedRows.size})
                    </button>
                    <button
                        className="btn-primary flex items-center gap-2 !py-2 !px-4 bg-white/5 hover:bg-white/10 border border-white/10"
                        onClick={exportToCSV}
                    >
                        <Download size={20} /> Export CSV
                    </button>
                </div>
            </div>

            {/* ---- Filter panel ---- */}
            {showFilters && (
                <div className="p-4 border-b border-[var(--card-border)] bg-[var(--bg-darker)] flex flex-wrap gap-4 items-end">

                    {/* Symbol */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Symbol</label>
                        <input
                            type="text"
                            list="filter-symbols-list"
                            className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-32 transition-all"
                            placeholder="e.g. MNQH25"
                            value={filterSymbol}
                            onChange={e => setFilterSymbol(e.target.value)}
                        />
                        <datalist id="filter-symbols-list">
                            {existingSymbols.map(s => <option key={s} value={s} />)}
                        </datalist>
                    </div>

                    {/* Direction */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Direction</label>
                        <select
                            className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-32 transition-all"
                            value={filterDirection}
                            onChange={e => setFilterDirection(e.target.value)}
                        >
                            <option value="all" className="bg-[var(--bg-card)]">All</option>
                            <option value="long" className="bg-[var(--bg-card)]">Long</option>
                            <option value="short" className="bg-[var(--bg-card)]">Short</option>
                        </select>
                    </div>

                    {/* Position size range */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Size (min – max)</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min="0"
                                className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-20 transition-all"
                                placeholder="Min"
                                value={filterSizeMin}
                                onChange={e => setFilterSizeMin(e.target.value)}
                            />
                            <span className="text-secondary text-xs">–</span>
                            <input
                                type="number"
                                min="0"
                                className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-20 transition-all"
                                placeholder="Max"
                                value={filterSizeMax}
                                onChange={e => setFilterSizeMax(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Date (from – to)</label>
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm transition-all"
                                value={filterDateStart}
                                onChange={e => setFilterDateStart(e.target.value)}
                            />
                            <span className="text-secondary text-xs">–</span>
                            <input
                                type="date"
                                className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm transition-all"
                                value={filterDateEnd}
                                onChange={e => setFilterDateEnd(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Setup Tag */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Setup Tag</label>
                        <select
                            className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-40 transition-all"
                            value={filterSetupTag}
                            onChange={e => setFilterSetupTag(e.target.value)}
                        >
                            <option value="" className="bg-[var(--bg-card)]">All</option>
                            {existingTags.map(t => (
                                <option key={t} value={t} className="bg-[var(--bg-card)]">{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Additional Tag */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Additional Tag</label>
                        <select
                            className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-40 transition-all"
                            value={filterAdditionalTag}
                            onChange={e => setFilterAdditionalTag(e.target.value)}
                        >
                            <option value="" className="bg-[var(--bg-card)]">All</option>
                            {existingTags.map(t => (
                                <option key={t} value={t} className="bg-[var(--bg-card)]">{t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Setup Rating */}
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-widest text-secondary font-bold">Setup Rating</label>
                        <select
                            className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-accent p-2 rounded outline-none text-sm w-28 transition-all"
                            value={filterRating}
                            onChange={e => setFilterRating(e.target.value)}
                        >
                            <option value="" className="bg-[var(--bg-card)]">All</option>
                            {['5', '4', '3', '2', '1'].map(v => (
                                <option key={v} value={v} className="bg-[var(--bg-card)]">{'★'.repeat(Number(v))} ({v})</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear filters button — only shown when filters active */}
                    {isFilterActive && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all self-end"
                        >
                            <X size={14} /> Clear Filters
                        </button>
                    )}
                </div>
            )}

            {/* ---- Table ---- */}
            <div className="table-container flex-grow overflow-auto max-h-[75vh]">
                <table className="w-full text-left">
                    <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                        <tr>
                            {/* Checkbox col */}
                            <th className="w-10 px-4">
                                <button onClick={toggleAll} className="text-secondary hover:text-white">
                                    {selectedRows.size === displayedTrades.length && displayedTrades.length > 0
                                        ? <CheckSquare size={22} />
                                        : <Square size={22} />
                                    }
                                </button>
                            </th>
                            {['EntryDate', 'ExitDate', 'Symbol', 'PnL', 'Direction', 'Size', 'Setup Tag', 'Additional Tag', 'Setup Rating', 'Comments'].map(col => (
                                <th key={col} onClick={() => handleSort(col)} className="cursor-pointer hover:text-white py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="uppercase tracking-wider text-xs whitespace-nowrap">{col}</span>
                                        {sortConfig.key === col && (
                                            sortConfig.direction === 'asc'
                                                ? <ArrowUp size={16} className="text-accent" />
                                                : <ArrowDown size={16} className="text-accent" />
                                        )}
                                    </div>
                                </th>
                            ))}
                            {/* Delete col — no sorting */}
                            <th className="w-14 px-4">
                                <span className="uppercase tracking-wider text-xs text-secondary">Del</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--card-border)]">
                        {displayedTrades.map((trade, idx) => {
                            const isSelected = selectedRows.has(idx)
                            const tradeId = trade.id || trade._row_id || trade.mergeId || `trade-${idx}`
                            const isDeleting = deletingId === tradeId

                            return (
                                <tr
                                    key={tradeId}
                                    className={`group hover:bg-white/[0.02] transition-colors ${isSelected ? 'bg-accent/5' : ''} ${trade.isMerged ? 'merge-highlight' : ''} ${isDeleting ? 'opacity-40' : ''}`}
                                >
                                    {/* Checkbox */}
                                    <td className="px-4">
                                        <button
                                            onClick={() => toggleRow(idx)}
                                            className={`${isSelected ? 'text-accent' : 'text-secondary/50'} hover:text-accent`}
                                        >
                                            {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
                                        </button>
                                    </td>

                                    {/* Entry date */}
                                    <td className="font-mono text-secondary text-base min-w-[200px] whitespace-nowrap py-4">
                                        {trade.EntryDate || trade.Date}
                                    </td>

                                    {/* Exit date */}
                                    <td className="font-mono text-secondary text-base min-w-[200px] whitespace-nowrap py-4">
                                        {trade.ExitDate || trade.Date}
                                    </td>

                                    {/* Symbol */}
                                    <td className="font-bold text-white text-base py-4">{trade.Symbol}</td>

                                    {/* PnL */}
                                    <td className={`font-mono font-bold text-base py-4 ${parseFloat(trade.PnL) > 0 ? 'text-success' : 'text-danger'}`}>
                                        {parseFloat(trade.PnL) > 0 ? '+' : ''}{parseFloat(trade.PnL).toFixed(2)}
                                    </td>

                                    {/* Direction */}
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${trade.Direction?.toLowerCase().includes('long')
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                            {trade.Direction}
                                        </span>
                                    </td>

                                    {/* Size */}
                                    <td className="font-mono text-secondary text-base py-4">{trade.Size || '-'}</td>

                                    {/* Setup Tag */}
                                    <td className="min-w-[260px] py-4">{renderTags(trade, 'Setup Tag', tradeId)}</td>

                                    {/* Additional Tag */}
                                    <td className="min-w-[260px] py-4">{renderTags(trade, 'Additional Tag', tradeId)}</td>

                                    {/* Setup Rating */}
                                    <td className="py-4">
                                        <select
                                            className="bg-transparent border border-transparent hover:border-white/10 p-2 rounded w-full outline-none focus:border-accent transition-all text-sm"
                                            value={trade['Setup Rating'] || ''}
                                            onChange={(e) => handleEdit(trade, 'Setup Rating', e.target.value)}
                                        >
                                            <option value="" className="bg-[var(--bg-card)]">-</option>
                                            {['5', '4', '3', '2', '1'].map(v => (
                                                <option key={v} value={v} className="bg-[var(--bg-card)]">{v}</option>
                                            ))}
                                        </select>
                                    </td>

                                    {/* Comments with hover tooltip */}
                                    <td className="py-4 min-w-[200px] max-w-[280px]">
                                        {renderComment(trade)}
                                    </td>

                                    {/* Delete button */}
                                    <td className="px-4 py-4">
                                        <button
                                            onClick={() => handleDelete(trade)}
                                            disabled={isDeleting}
                                            className="p-2 rounded-lg text-secondary/40 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title={`Delete trade #${tradeId}`}
                                        >
                                            {isDeleting
                                                ? <Loader2 size={18} className="animate-spin" />
                                                : <Trash2 size={18} />
                                            }
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* ---- Footer ---- */}
            <div className="p-4 border-t border-[var(--card-border)] bg-black/10 flex justify-between items-center text-sm text-secondary">
                <div className="flex gap-4">
                    <span>* Multi-tags (max 10) appends to list</span>
                    <span className="text-accent/80 font-medium">| All changes auto-saved to database</span>
                </div>
                <span className="italic">Highlighted rows are merged trades</span>
            </div>
        </div>
    )
}

export default TransactionManager
