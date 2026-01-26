import { useMemo, useState } from 'react';
import type { Complaint } from '../../types/complaint';
import { groupByDate } from '../../utils/aggregations';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function TimeSeriesChart({ data }: { data: Complaint[] }) {
    const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

    const chartData = useMemo(() => {
        return groupByDate(data, interval);
    }, [data, interval]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Évolution Temporelle</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => setInterval('day')}
                        className={`px-3 py-1 text-xs rounded-full ${interval === 'day' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Jour
                    </button>
                    <button
                        onClick={() => setInterval('week')}
                        className={`px-3 py-1 text-xs rounded-full ${interval === 'week' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Semaine
                    </button>
                    <button
                        onClick={() => setInterval('month')}
                        className={`px-3 py-1 text-xs rounded-full ${interval === 'month' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Mois
                    </button>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.slice(5)} // Show MM-DD roughly
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" name="Nombre de plaintes" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
