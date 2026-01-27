import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: { value: string; label: string }[];
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
            <select
                className="block w-full rounded-lg border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:bg-white transition-all outline-none"
                {...props}
            >
                <option value="">Tous</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
