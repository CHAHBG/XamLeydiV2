import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupByCommune } from '../../utils/aggregations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CustomTooltip, CHART_COLORS } from './CustomTooltip';

export function CommuneChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        const grouped = groupByCommune(data);
        return Object.entries(grouped)
            .map(([commune, count]) => ({ commune, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // Limit to top 15 communes for readability
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                Plaintes par Commune
            </h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                        dataKey="commune"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', opacity: 0.4 }} />
                    <Bar dataKey="count" name="Plaintes" radius={[6, 6, 0, 0]}>
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
