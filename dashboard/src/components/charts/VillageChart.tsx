import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { getTopVillages } from '../../utils/aggregations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomTooltip, CHART_COLORS } from './CustomTooltip';

export function VillageChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        return getTopVillages(data, 10);
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                Top 10 Villages
            </h3>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="village"
                        type="category"
                        width={120}
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9', opacity: 0.4 }} />
                    <Bar dataKey="count" name="Plaintes" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
