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
import { exportToCSV } from '../../utils/export';
import { LayoutDashboard, Users, AlertCircle, FileText, Download } from 'lucide-react';

export function Dashboard() {
    const [filters, setFilters] = useState<FilterOptions>({});
    const { data, loading, error } = useComplaints(filters);

    // Calculate summary stats
    const totalComplaints = data.length;
    const sensitiveCount = data.filter(c => c.complaint_category === 'sensible').length;
    const nonSensitiveCount = totalComplaints - sensitiveCount;
    const uniqueCommunes = new Set(data.map(c => c.commune)).size;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-10">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="text-primary" size={24} />
                        <h1 className="text-xl font-bold text-gray-900">Tableau de Bord des Plaintes</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => exportToCSV(data, filters)}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                            disabled={loading || data.length === 0}
                        >
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

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
