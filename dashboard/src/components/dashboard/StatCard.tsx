import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: string;
    color?: string; // 'blue' | 'green' | 'red' | 'yellow'
}

export function StatCard({ title, value, icon: Icon, trend, color = 'blue' }: StatCardProps) {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        red: 'bg-red-100 text-red-600',
        yellow: 'bg-yellow-100 text-yellow-600',
    };

    return (
        <div className="bg-white rounded-xl shadow-card p-6 border border-slate-100 flex items-center justify-between transition-transform hover:-translate-y-1 duration-300">
            <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
                    {trend && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {trend}
                        </span>
                    )}
                </div>
            </div>
            <div className={`p-4 rounded-xl ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue} opacity-90 shadow-sm`}>
                <Icon size={28} strokeWidth={1.5} />
            </div>
        </div>
    );
}
