import type { Complaint, FilterOptions } from '../types/complaint';
import { format } from 'date-fns';

export const exportToCSV = (data: Complaint[], filters: FilterOptions) => {
    const headers = [
        'ID', 'Date', 'Commune', 'Village', 'Nom Plaignant', 'Sexe', 'ID Plaignant',
        'Contact', 'Motif', 'Catégorie', 'Description', 'Resolution Attendue',
        'Mode Reception', 'Utilisation', 'Nature Parcelle'
    ];

    const rows = data.map(c => [
        c.id,
        c.date,
        c.commune,
        c.village,
        c.complainant_name,
        c.complainant_sex,
        c.complainant_id,
        c.complainant_contact,
        c.complaint_reason,
        c.complaint_category,
        c.complaint_description,
        c.expected_resolution,
        c.complaint_reception_mode,
        c.type_usage,
        c.nature_parcelle
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            // Escape quotes and wrap in quotes
            const val = cell ? String(cell).replace(/"/g, '""') : '';
            return `"${val}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    // Format filename
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const communeStr = filters.commune ? `_${filters.commune}` : '';
    const filename = `plaintes${communeStr}_${dateStr}.csv`;

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};
