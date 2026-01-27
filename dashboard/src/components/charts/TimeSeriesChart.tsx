import { useMemo, useState } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupByDate } from '../../utils/aggregations';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CustomTooltip, CHART_COLORS } from './CustomTooltip';

export function TimeSeriesChart({ data }: { data: Complaint[] }) {
    const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

    const chartData = useMemo(() => {
        return groupByDate(data, interval);
    }, [data, interval]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    Évolution Temporelle
                </h3>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    {['day', 'week', 'month'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setInterval(t as any)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${interval === t
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {t === 'day' ? 'Jour' : t === 'week' ? 'Semaine' : 'Mois'}
                        </button>
                    ))}
                </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        tickFormatter={(value) => value.slice(5)} // Show MM-DD roughly
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                        type="monotone"
                        dataKey="count"
                        name="Nombre de plaintes"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                        activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS[0] }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
