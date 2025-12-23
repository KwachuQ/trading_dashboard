import { ArrowUpRight, ArrowDownRight, Minus, Info } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const Gauge = ({ value, color }) => {
    // Safety
    const safeValue = isNaN(value) ? 0 : value;
    const data = [
        { value: safeValue },
        { value: 100 - safeValue }
    ];
    return (
        <div className="w-[50px] h-[25px] relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cy="100%"
                        innerRadius="170%"
                        outerRadius="200%"
                        startAngle={180}
                        endAngle={0}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill={color} />
                        <Cell fill="#334155" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

const ProgressBar = ({ value, max = 100, color }) => {
    const val = isNaN(value) ? 0 : value;
    const pct = Math.min((val / max) * 100, 100);
    return (
        <div className="w-full h-1.5 bg-slate-700/50 rounded-full mt-2 overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
            />
        </div>
    )
}

const StatCard = ({
    title,
    value,
    subtext,
    type = 'neutral', // neutral, pnl, winrate, ratio
    icon: Icon,
    progressValue, // For ratio bars
    gaugeValue // For circular gauge (0-100)
}) => {
    let valueColor = 'text-white' // Default cleaner white
    let trendIcon = null
    let chartColor = '#6366f1' // Default accent

    // Ensure value is safe
    const displayValue = (value === undefined || value === null) ? '-' : value;

    // Logic for colors
    if (type === 'pnl') {
        const num = parseFloat(String(displayValue).replace(/[^0-9.-]+/g, ""))
        if (!isNaN(num)) {
            if (num > 0) { valueColor = 'text-emerald-400'; chartColor = '#10b981'; trendIcon = <ArrowUpRight size={16} className="text-emerald-500" />; }
            else if (num < 0) { valueColor = 'text-red-400'; chartColor = '#ef4444'; trendIcon = <ArrowDownRight size={16} className="text-red-500" />; }
            else { trendIcon = <Minus size={16} className="text-slate-500" />; }
        }
    } else if (type === 'winrate') {
        const num = parseFloat(String(displayValue).replace('%', ''));
        if (!isNaN(num)) {
            if (num >= 50) { chartColor = '#10b981'; valueColor = 'text-emerald-400'; }
            else { chartColor = '#f59e0b'; valueColor = 'text-amber-400'; }
        }
    }

    // Gauge Safety
    const safeGaugeValue = (gaugeValue === undefined || isNaN(gaugeValue)) ? 0 : Math.max(0, Math.min(100, gaugeValue));

    // Progress Safety
    const safeProgressValue = (progressValue === undefined || isNaN(progressValue)) ? 0 : Math.max(0, Math.min(100, progressValue));

    return (
        <div className="card flex flex-col justify-between h-full min-h-[110px] !p-5">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold">{title}</span>
                    <Info size={12} className="text-slate-600 hover:text-slate-400 cursor-help transition-colors" />
                </div>
                {type === 'winrate' && gaugeValue !== undefined && (
                    <Gauge value={safeGaugeValue} color={chartColor} />
                )}
            </div>

            <div className="flex flex-col justify-end flex-grow">
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold tracking-tight ${valueColor}`}>
                        {displayValue}
                    </span>
                    {trendIcon}
                </div>

                {/* Progress Bar mostly for Avg Win/Loss visual comp */}
                {type === 'ratio' && progressValue !== undefined && (
                    <ProgressBar value={safeProgressValue} max={100} color={chartColor} />
                )}

                {subtext && (
                    <div className="text-[11px] text-slate-500 mt-1.5 font-medium flex items-center gap-1">
                        {subtext}
                    </div>
                )}
            </div>
        </div>
    )
}

export default StatCard
