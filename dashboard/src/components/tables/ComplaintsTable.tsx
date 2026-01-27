import React, { useState, useMemo } from 'react';
import type { Complaint } from '../../types/complaint';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

interface ComplaintsTableProps {
    data: Complaint[];
}

type SortField = 'date' | 'commune' | 'village' | 'complainant_name' | 'complaint_category';
type SortDirection = 'asc' | 'desc';

export function ComplaintsTable({ data }: ComplaintsTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];

            // Handle nulls
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortField, sortDirection]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(data.length / itemsPerPage);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className="w-4 h-4 ml-1 inline-block text-gray-300">↕</span>;
        return sortDirection === 'asc' ? <ChevronUp size={14} className="ml-1 text-primary" /> : <ChevronDown size={14} className="ml-1 text-primary" />;
    };

    return (
        <div className="bg-white rounded-xl shadow-card border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/80 backdrop-blur-sm">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest w-12"></th>
                            <th
                                scope="col"
                                className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('date')}
                            >
                                <div className="flex items-center gap-2">Date <SortIcon field="date" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('commune')}
                            >
                                <div className="flex items-center gap-2">Commune <SortIcon field="commune" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('village')}
                            >
                                <div className="flex items-center gap-2">Village <SortIcon field="village" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('complainant_name')}
                            >
                                <div className="flex items-center gap-2">Nom <SortIcon field="complainant_name" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('complaint_category')}
                            >
                                <div className="flex items-center gap-2">Catégorie <SortIcon field="complaint_category" /></div>
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Motif
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {paginatedData.map((complaint) => (
                            <React.Fragment key={complaint.id}>
                                <tr
                                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${expandedId === complaint.id ? 'bg-slate-50/50' : ''}`}
                                    onClick={() => toggleExpand(complaint.id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {expandedId === complaint.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                                        {complaint.date ? format(new Date(complaint.date), 'dd/MM/yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{complaint.commune}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{complaint.village}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">{complaint.complainant_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        <span className={`px-2.5 py-0.5 inline-flex text-xs font-bold rounded-full border ${complaint.complaint_category === 'sensible' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                            {complaint.complaint_category === 'sensible' ? 'Sensible' : 'Non Sensible'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{complaint.complaint_reason}</td>
                                </tr>
                                {expandedId === complaint.id && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={7} className="px-6 py-6 text-sm text-slate-600">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-12 bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                                                        <span className="w-1 h-4 bg-primary rounded-full"></span>
                                                        Détails de la plainte
                                                    </h4>
                                                    <p><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1">Description</span> {complaint.complaint_description || 'Aucune description'}</p>
                                                    <p><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1 mt-3">Résolution attendue</span> {complaint.expected_resolution || 'Non spécifié'}</p>
                                                    <p><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1 mt-3">Mode de réception</span> {complaint.complaint_reception_mode}</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                                                        <span className="w-1 h-4 bg-primary rounded-full"></span>
                                                        Informations complémentaires
                                                    </h4>
                                                    <p><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1">Contact</span> {complaint.complainant_contact}</p>
                                                    <p><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1 mt-3">ID Plaignant</span> {complaint.complainant_id}</p>
                                                    <div className="flex gap-6 mt-3">
                                                        <div>
                                                            <span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1">N° Parcelle</span>
                                                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">{complaint.parcel_number}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1">Nature</span>
                                                            {complaint.nature_parcelle}
                                                        </div>
                                                    </div>
                                                    <p className="mt-3"><span className="font-semibold text-slate-500 uppercase text-xs tracking-wider block mb-1">Usage</span> {complaint.type_usage}</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-slate-100">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-slate-500">
                            Affichage de <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, data.length)}</span> sur <span className="font-bold text-slate-900">{data.length}</span> résultats
                        </p>
                    </div>
                    <div>
                        <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px gap-1" aria-label="Pagination">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-lg border border-transparent bg-white text-sm font-medium text-slate-500 hover:text-primary hover:bg-slate-50 disabled:bg-transparent disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <span className="sr-only">Précédent</span>
                                <ChevronDown className="h-5 w-5 rotate-90" aria-hidden="true" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    p = currentPage - 2 + i;
                                }
                                if (p > totalPages) return null;

                                return (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        aria-current={currentPage === p ? 'page' : undefined}
                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-semibold rounded-lg transition-all ${currentPage === p
                                            ? 'z-10 bg-primary text-white shadow-soft border-transparent'
                                            : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center px-2 py-2 rounded-lg border border-transparent bg-white text-sm font-medium text-slate-500 hover:text-primary hover:bg-slate-50 disabled:bg-transparent disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                <span className="sr-only">Suivant</span>
                                <ChevronDown className="h-5 w-5 -rotate-90" aria-hidden="true" />
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    );
}
