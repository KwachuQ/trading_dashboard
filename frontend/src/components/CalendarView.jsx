import { useMemo, useState } from 'react'

const CalendarView = ({ dailyData }) => {
    // dailyData: [{ Date: "2023-01-01", DailyPnL: 100, TradeCount: 5, ... }]
    const safeData = Array.isArray(dailyData) ? dailyData : [];

    const getInitialDate = () => {
        const validDates = safeData.filter(d => d && d.Date);
        if (validDates.length > 0) {
            const lastItem = validDates[validDates.length - 1];
            const d = new Date(lastItem.Date);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    }

    const [viewDate, setViewDate] = useState(getInitialDate);

    const calendarData = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const startDayIdx = firstDay.getDay(); // 0 = Sunday
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Group into weeks
        const weeks = [];
        let currentWeek = Array(7).fill(null);

        // Fill first week leading days
        for (let i = 0; i < startDayIdx; i++) {
            currentWeek[i] = null;
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayData = safeData.find(d => d && d.Date === dateStr);

            const dayIdx = (startDayIdx + i - 1) % 7;
            currentWeek[dayIdx] = {
                day: i,
                date: dateStr,
                data: dayData
            };

            if (dayIdx === 6 || i === daysInMonth) {
                weeks.push(currentWeek);
                currentWeek = Array(7).fill(null);
            }
        }

        // Calculate Weekly Stats
        const weeklyStats = weeks.map(week => {
            return week.reduce((acc, day) => {
                if (day && day.data) {
                    acc.pnl += (day.data.DailyPnL || 0);
                    acc.trades += (day.data.TradeCount || 0);
                }
                return acc;
            }, { pnl: 0, trades: 0 });
        });

        const currentMonthPnL = safeData
            .filter(d => d && d.Date && d.Date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
            .reduce((sum, d) => sum + (d.DailyPnL || 0), 0);

        return {
            year,
            monthName: viewDate.toLocaleString('default', { month: 'short' }),
            weeks,
            weeklyStats,
            currentMonthPnL
        };
    }, [safeData, viewDate]);

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    }

    return (
        <div className="card h-full flex flex-col !bg-[#1e1e2d] !border-none">
            <div className="flex flex-col items-center mb-6">
                <div className="text-secondary text-xs font-bold uppercase tracking-widest mb-1">Monthly P/L</div>
                <div className={`text-2xl font-bold font-mono ${calendarData.currentMonthPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {calendarData.currentMonthPnL < 0 ? '-' : ''}${Math.abs(calendarData.currentMonthPnL).toFixed(2)}
                </div>
            </div>

            <div className="flex justify-between items-center mb-10 px-4">
                <div className="flex items-center gap-8">
                    <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-white/5 rounded transition-colors text-2xl font-bold">&lt;</button>
                    <h3 className="text-[24px] font-black w-32 text-center uppercase tracking-tighter">
                        {calendarData.monthName} {calendarData.year}
                    </h3>
                    <button onClick={() => changeMonth(1)} className="p-3 hover:bg-white/5 rounded transition-colors text-2xl font-bold">&gt;</button>
                </div>
                <button
                    onClick={() => setViewDate(new Date())}
                    className="bg-slate-700 h-10 px-8 text-sm font-black uppercase tracking-widest rounded-md hover:bg-slate-600 transition-all flex items-center justify-center"
                >
                    Today
                </button>
            </div>

            <div className="grid grid-cols-[repeat(7,1fr)_140px] text-center mb-6 px-4 font-black">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-[20px] text-slate-500 uppercase tracking-widest">{d}</div>
                ))}
                <div className="border-l border-white/5 text-[20px] text-slate-500 uppercase tracking-widest">Weekly</div>
            </div>

            <div className="flex flex-col gap-4 px-4 pb-8">
                {calendarData.weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-[repeat(7,1fr)_140px] gap-4">
                        {week.map((item, dayIdx) => {
                            if (!item) return <div key={`empty-${dayIdx}`} className="aspect-[4/3] bg-black/20 rounded-md" />

                            const pnl = item.data?.DailyPnL || 0;
                            const count = item.data?.TradeCount || 0;
                            const hasData = !!item.data;

                            return (
                                <div key={item.day} className={`
                                    aspect-[4/3] flex flex-col px-4 py-3 rounded-md transition-all relative
                                    ${hasData
                                        ? (pnl > 0 ? 'bg-emerald-500/15 ring-1 ring-emerald-500/20' : pnl < 0 ? 'bg-red-500/15 ring-1 ring-red-500/20' : 'bg-slate-700/30')
                                        : 'bg-black/10'
                                    }
                                `}>
                                    <div className="text-right text-slate-500 font-black mb-2 text-[18px]">{item.day}</div>
                                    {hasData && (
                                        <div className="flex flex-col items-center justify-center flex-grow -mt-3">
                                            <div className={`font-black text-[22px] font-mono leading-none ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {pnl < 0 ? '-' : ''}${Math.abs(pnl).toFixed(2)}
                                            </div>
                                            <div className="text-[17px] text-slate-400 font-bold mt-2">
                                                {count} trades
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Weekly Stats Column */}
                        <div className="border-l border-white/10 pl-6 flex flex-col justify-center items-center text-center">
                            <div className="text-[14px] font-black text-slate-500 uppercase mb-2 tracking-tight">Week {weekIdx + 1}</div>
                            <div className={`text-[21px] font-black font-mono leading-none ${calendarData.weeklyStats[weekIdx].pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {calendarData.weeklyStats[weekIdx].pnl < 0 ? '-' : ''}${Math.abs(calendarData.weeklyStats[weekIdx].pnl).toFixed(2)}
                            </div>
                            <div className="text-[17px] text-slate-400 font-bold mt-2">{calendarData.weeklyStats[weekIdx].trades} trades</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CalendarView
