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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('date')}
                            >
                                <div className="flex items-center">Date <SortIcon field="date" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('commune')}
                            >
                                <div className="flex items-center">Commune <SortIcon field="commune" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('village')}
                            >
                                <div className="flex items-center">Village <SortIcon field="village" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('complainant_name')}
                            >
                                <div className="flex items-center">Nom <SortIcon field="complainant_name" /></div>
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('complaint_category')}
                            >
                                <div className="flex items-center">Catégorie <SortIcon field="complaint_category" /></div>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Motif
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedData.map((complaint) => (
                            <React.Fragment key={complaint.id}>
                                <tr className={`hover:bg-gray-50 ${expandedId === complaint.id ? 'bg-blue-50' : ''}`} onClick={() => toggleExpand(complaint.id)}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer">
                                        {expandedId === complaint.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {complaint.date ? format(new Date(complaint.date), 'dd/MM/yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{complaint.commune}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{complaint.village}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{complaint.complainant_name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${complaint.complaint_category === 'sensible' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {complaint.complaint_category === 'sensible' ? 'Sensible' : 'Non Sensible'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{complaint.complaint_reason}</td>
                                </tr>
                                {expandedId === complaint.id && (
                                    <tr className="bg-gray-50">
                                        <td colSpan={7} className="px-6 py-4 text-sm text-gray-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 mb-2">Détails de la plainte</h4>
                                                    <p><span className="font-medium">Description:</span> {complaint.complaint_description || 'Aucune description'}</p>
                                                    <p className="mt-2"><span className="font-medium">Résolution attendue:</span> {complaint.expected_resolution || 'Non spécifié'}</p>
                                                    <p className="mt-2"><span className="font-medium">Mode de réception:</span> {complaint.complaint_reception_mode}</p>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 mb-2">Informations Plaignant & Parcelle</h4>
                                                    <p><span className="font-medium">Contact:</span> {complaint.complainant_contact}</p>
                                                    <p><span className="font-medium">ID Plaignant:</span> {complaint.complainant_id}</p>
                                                    <p className="mt-2"><span className="font-medium">N° Parcelle:</span> {complaint.parcel_number}</p>
                                                    <p><span className="font-medium">Nature:</span> {complaint.nature_parcelle}</p>
                                                    <p><span className="font-medium">Usage:</span> {complaint.type_usage}</p>
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
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-medium">{Math.min(currentPage * itemsPerPage, data.length)}</span> sur <span className="font-medium">{data.length}</span> résultats
                        </p>
                    </div>
                    <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            >
                                <span className="sr-only">Précédent</span>
                                <ChevronDown className="h-5 w-5 rotate-90" aria-hidden="true" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Simple logic: show first 5 or around current. For now fix to limited range or simple prev/next
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
                                        className={`bg-white border-gray-300 text-gray-500 hover:bg-gray-50 relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === p ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600' : ''}`}
                                    >
                                        {p}
                                    </button>
                                )
                            })}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
