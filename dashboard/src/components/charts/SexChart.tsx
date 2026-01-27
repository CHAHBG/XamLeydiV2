import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupBySex } from '../../utils/aggregations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CustomTooltip, CHART_COLORS } from './CustomTooltip';

export function SexChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        const grouped = groupBySex(data);
        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }, [data]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-primary rounded-full"></span>
                Répartition par Sexe
            </h3>
            <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={0} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="middle"
                        align="right"
                        layout="vertical"
                        height={36}
                        formatter={(value) => <span className="text-slate-600 font-medium ml-1">{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
