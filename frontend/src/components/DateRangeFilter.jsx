import { useState } from 'react'
import { Calendar } from 'lucide-react'

const DateRangeFilter = ({ onFilterChange, minDate, maxDate }) => {
    const [startDate, setStartDate] = useState(minDate || '')
    const [endDate, setEndDate] = useState(maxDate || '')

    const handleApply = () => {
        onFilterChange({ startDate, endDate })
    }

    const handleReset = () => {
        setStartDate(minDate || '')
        setEndDate(maxDate || '')
        onFilterChange({ startDate: null, endDate: null })
    }

    return (
        <div className="card flex items-center gap-4 !p-4">
            <div className="flex items-center gap-2 text-secondary">
                <Calendar size={18} />
                <span className="text-sm font-medium">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent transition-colors"
                />
                <span className="text-secondary">to</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent transition-colors"
                />
            </div>
            <div className="flex gap-2">
                <button
                    onClick={handleApply}
                    className="btn-primary !py-1.5 !px-4 text-sm"
                >
                    Apply
                </button>
                <button
                    onClick={handleReset}
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                    Reset
                </button>
            </div>
        </div>
    )
}

export default DateRangeFilter
