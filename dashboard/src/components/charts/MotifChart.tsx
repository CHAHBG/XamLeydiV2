import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupByReason } from '../../utils/aggregations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CustomTooltip, CHART_COLORS } from './CustomTooltip';

export function MotifChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        const grouped = groupByReason(data);
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                Répartition par Motif
            </h3>
            <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={0} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />

                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
