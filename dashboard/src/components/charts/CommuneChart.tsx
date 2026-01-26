import { useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupByCommune } from '../../utils/aggregations';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function CommuneChart({ data }: { data: Complaint[] }) {
    const chartData = useMemo(() => {
        const grouped = groupByCommune(data);
        return Object.entries(grouped)
            .map(([commune, count]) => ({ commune, count }))
            .sort((a, b) => b.count - a.count);
    }, [data]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Plaintes par Commune</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="commune" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    {/* <Legend /> */}
                    <Bar dataKey="count" name="Plaintes" radius={[4, 4, 0, 0]}>
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
