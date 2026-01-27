import { useState } from 'react';
import { useComplaints } from '../../hooks/useComplaints';
import type { FilterOptions } from '../../types/complaint';
import { FilterPanel } from '../filters/FilterPanel';
import { StatCard } from './StatCard';
import { CommuneChart } from '../charts/CommuneChart';
import { VillageChart } from '../charts/VillageChart';
import { MotifChart } from '../charts/MotifChart';
import { SexChart } from '../charts/SexChart';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import { ComplaintsTable } from '../tables/ComplaintsTable';
import { exportToCSV, exportToXLSX } from '../../utils/export';
import { LayoutDashboard, Users, AlertCircle, FileText, Download, FileSpreadsheet } from 'lucide-react';

import { Sidebar } from './Sidebar';

export function Dashboard() {
    const [filters, setFilters] = useState<FilterOptions>({});
    const { data, loading, error } = useComplaints(filters);

    // Calculate summary stats
    const totalComplaints = data.length;
    const sensitiveCount = data.filter(c => c.complaint_category === 'sensible').length;
    const nonSensitiveCount = totalComplaints - sensitiveCount;
    const uniqueCommunes = new Set(data.map(c => c.commune)).size;

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900" data-version="2.0.0-sidebar-layout">
            <Sidebar />

            <main className="flex-1 ml-64 min-h-screen flex flex-col transition-all duration-300">
                {/* Top Bar */}
                <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 px-8 flex justify-between items-center shadow-sm">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Vue d'ensemble</h2>
                        <p className="text-sm text-slate-500 font-medium">Gérez et analysez les plaintes foncières en temps réel</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => exportToXLSX(data, filters)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-sm font-semibold rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={loading || data.length === 0}
                        >
                            <FileSpreadsheet size={18} className="text-emerald-600" />
                            <span>Export Excel</span>
                        </button>
                        <button
                            onClick={() => exportToCSV(data, filters)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg shadow-md hover:shadow-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            disabled={loading || data.length === 0}
                        >
                            <Download size={18} />
                            <span>Export CSV</span>
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-8 space-y-8 max-w-[1600px] w-full mx-auto">

                    {/* Filters Section */}
                    <FilterPanel filters={filters} onFilterChange={setFilters} />

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2" role="alert">
                            <AlertCircle size={20} />
                            <span className="font-medium">Erreur: {error}</span>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Plaintes"
                            value={loading ? '...' : totalComplaints}
                            icon={FileText}
                            color="blue"
                        />
                        <StatCard
                            title="Plaintes Sensibles"
                            value={loading ? '...' : sensitiveCount}
                            icon={AlertCircle}
                            color="red"
                        />
                        <StatCard
                            title="Plaintes Non Sensibles"
                            value={loading ? '...' : nonSensitiveCount}
                            icon={AlertCircle}
                            color="green"
                        />
                        <StatCard
                            title="Communes Affectées"
                            value={loading ? '...' : uniqueCommunes}
                            icon={Users}
                            color="yellow"
                        />
                    </div>

                    {/* Charts & Data */}
                    {!loading && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                            {/* Charts Row 1 */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <CommuneChart data={data} />
                                <VillageChart data={data} />
                            </div>

                            {/* Charts Row 2 */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <MotifChart data={data} />
                                <SexChart data={data} />
                            </div>

                            {/* Full Width Chart */}
                            <TimeSeriesChart data={data} />

                            {/* Data Table */}
                            <div className="pt-4">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                        Détails des Plaintes
                                    </h3>
                                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                        {data.length} enregistrements
                                    </span>
                                </div>
                                <ComplaintsTable data={data} />
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col justify-center items-center h-96 gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            </div>
                            <p className="text-slate-500 font-medium animate-pulse">Chargement des données...</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
