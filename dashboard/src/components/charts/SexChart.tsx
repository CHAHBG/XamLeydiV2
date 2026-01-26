import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupBySex } from '../../utils/aggregations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#3B82F6', '#EC4899', '#9CA3AF']; // Blue, Pink, Gray

export function SexChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        const grouped = groupBySex(data);
        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }, [data]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Répartition par Sexe</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
