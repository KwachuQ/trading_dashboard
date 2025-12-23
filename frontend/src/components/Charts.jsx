import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, ScatterChart, Scatter, LabelList
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                {payload.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke || p.fill }}></div>
                        <p className="text-sm font-bold text-white">
                            {p.name}: <span className="font-mono">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{p.name === 'Win Rate' ? '%' : ''}</span>
                        </p>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

const Charts = ({ chartsData }) => {
    // chartsData: daily_pnl, duration_distribution
    if (!chartsData) {
        return <div className="p-4 text-center text-secondary">Loading charts...</div>
    }

    const { daily_pnl = [], duration_distribution = [] } = chartsData

    const sortedDaily = Array.isArray(daily_pnl)
        ? [...daily_pnl].sort((a, b) => new Date(a.Date) - new Date(b.Date))
        : [];

    return (
        <div className="flex flex-col gap-5">
            {/* Row 1: Equity Curve & Net Daily PnL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-[340px]">
                {/* Equity Curve */}
                <div className="card relative !p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/2">
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Equity Curve</h3>
                    </div>
                    <div className="flex-grow w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sortedDaily} margin={{ top: 20, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="Date" hide />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <Line type="monotone" dataKey="CumulativePnL" name="Equity" stroke="#818cf8" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Daily PnL Bar */}
                <div className="card relative !p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/2">
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Daily Net PnL</h3>
                    </div>
                    <div className="flex-grow w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sortedDaily} margin={{ top: 20, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                                <XAxis dataKey="Date" hide />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={40} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.2 }} />
                                <Bar dataKey="DailyPnL" name="PnL" radius={[2, 2, 0, 0]}>
                                    {sortedDaily.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.DailyPnL >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Row 2: Duration Analysis & Win Rate Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-[400px]">
                {/* Trade Duration Analysis (Trade Count) */}
                <div className="card relative !p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/2 flex justify-between items-center">
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Trade Duration Analysis</h3>
                    </div>
                    <div className="flex-grow w-full py-4 pr-5 overflow-hidden relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={duration_distribution} layout="vertical" margin={{ top: 10, right: 35, left: 85, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 9 }} />
                                <YAxis type="category" dataKey="range" stroke="#64748b" tick={{ fontSize: 9 }} width={100} />
                                <Tooltip cursor={{ fill: 'white', opacity: 0.05 }} content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Trade Count" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={12}>
                                    <LabelList dataKey="count" position="right" fill="#fff" fontSize={10} offset={10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 opacity-80 uppercase tracking-widest pointer-events-none">Trade Count</div>
                    </div>
                </div>

                {/* Win Rate Analysis */}
                <div className="card relative !p-0 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/2 flex justify-between items-center">
                        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Win Rate Analysis</h3>
                    </div>
                    <div className="flex-grow w-full py-4 pr-5 overflow-hidden relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={duration_distribution} layout="vertical" margin={{ top: 10, right: 40, left: 85, bottom: 20 }}>
                                <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 9 }} tickFormatter={(val) => `${val}%`} />
                                <YAxis type="category" dataKey="range" stroke="#64748b" tick={{ fontSize: 9 }} width={100} />
                                <Tooltip cursor={{ fill: 'white', opacity: 0.05 }} content={<CustomTooltip />} />
                                <Bar dataKey="win_rate" name="Win Rate" radius={[0, 4, 4, 0]} barSize={12}>
                                    {duration_distribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.win_rate >= 50 ? '#10b981' : (entry.win_rate > 0 ? '#ef4444' : '#334155')} />
                                    ))}
                                    <LabelList dataKey="win_rate" position="right" fill="#fff" fontSize={10} offset={10} formatter={(val) => `${val}%`} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 opacity-80 uppercase tracking-widest pointer-events-none">Win Rate</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Charts
