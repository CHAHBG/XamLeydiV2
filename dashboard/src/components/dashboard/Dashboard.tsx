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

export function Dashboard() {
    const [filters, setFilters] = useState<FilterOptions>({});
    const { data, loading, error } = useComplaints(filters);
    const [exportLoading, setExportLoading] = useState(false);

    // Calculate summary stats
    const totalComplaints = data.length;
    const sensitiveCount = data.filter(c => c.complaint_category === 'sensible').length;
    const nonSensitiveCount = totalComplaints - sensitiveCount;
    const uniqueCommunes = new Set(data.map(c => c.commune)).size;

    // Handle export logic
    const handleExport = async (type: 'csv' | 'excel') => {
        setExportLoading(true);
        try {
            if (type === 'csv') {
                await exportToCSV(data, filters);
            } else {
                await exportToXLSX(data, filters);
            }
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-slate-900 shadow-lg border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/20 backdrop-blur-sm">
                                <LayoutDashboard className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white">Xamleydi Dashboard</h1>
                                <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Analytics Overview</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleExport('excel')}
                                disabled={exportLoading || loading || data.length === 0}
                                className="inline-flex items-center px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-semibold text-slate-300 shadow-lg hover:bg-slate-700 hover:text-white hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                {exportLoading ? 'Exporting...' : 'Export Excel'}
                            </button>
                            <button
                                onClick={() => handleExport('csv')}
                                disabled={exportLoading || loading || data.length === 0}
                                className="inline-flex items-center px-4 py-2 bg-primary border border-transparent rounded-lg text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:bg-primary-dark hover:shadow-primary/50 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Download className="h-4 w-4 mr-2" />
                                {exportLoading ? 'Exporting...' : 'Export CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

                {/* Filters */}
                <FilterPanel filters={filters} onFilterChange={setFilters} />

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                        <strong className="font-bold">Erreur:</strong>
                        <span className="block sm:inline"> {error}</span>
                    </div>
                )}

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                {/* Charts Grid */}
                {!loading && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <CommuneChart data={data} />
                            <VillageChart data={data} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MotifChart data={data} />
                            <SexChart data={data} />
                        </div>

                        <TimeSeriesChart data={data} />

                        {/* Data Table */}
                        <div className="mt-8">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Liste Détaillée des Plaintes</h2>
                            <ComplaintsTable data={data} />
                        </div>
                    </>
                )}

                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                )}
            </main>
        </div>
    );
}
