import type { Complaint, FilterOptions } from '../types/complaint';
import { format } from 'date-fns';

import * as XLSX from 'xlsx';

export const exportToCSV = (data: Complaint[], filters: FilterOptions) => {
    const headers = [
        'ID', 'Date', 'Commune', 'Village', 'Nom Plaignant', 'Sexe', 'ID Plaignant',
        'Contact', 'Motif', 'Catégorie', 'Description', 'Resolution Attendue',
        'Mode Reception', 'Utilisation', 'Nature Parcelle',
        'Activité', 'N° Parcelle', 'Fonction', 'Date Création',
        'Source', 'Envoyé', 'Données Supplémentaires', 'Réponse Serveur'
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
        c.nature_parcelle,
        c.activity,
        c.parcel_number,
        c.complaint_function,
        c.created_at,
        c.source,
        c.sent_remote ? 'Oui' : 'Non',
        c.data ? JSON.stringify(c.data) : '',
        c.remote_response ? JSON.stringify(c.remote_response) : ''
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

export const exportToXLSX = (data: Complaint[], filters: FilterOptions) => {
    // Headers are inferred from object keys, or we can use keys directly in map, so headers array is unused in JSON_to_sheet logic unless we use header option.
    // For simplicity, we just rely on keys.

    const rows = data.map(c => ({
        'ID': c.id,
        'Date': c.date,
        'Commune': c.commune,
        'Village': c.village,
        'Nom Plaignant': c.complainant_name,
        'Sexe': c.complainant_sex,
        'ID Plaignant': c.complainant_id,
        'Contact': c.complainant_contact,
        'Motif': c.complaint_reason,
        'Catégorie': c.complaint_category,
        'Description': c.complaint_description,
        'Resolution Attendue': c.expected_resolution,
        'Mode Reception': c.complaint_reception_mode,
        'Utilisation': c.type_usage,
        'Nature Parcelle': c.nature_parcelle,
        'Activité': c.activity,
        'N° Parcelle': c.parcel_number,
        'Fonction': c.complaint_function,
        'Date Création': c.created_at,
        'Source': c.source,
        'Envoyé': c.sent_remote ? 'Oui' : 'Non',
        'Données Supplémentaires': c.data ? JSON.stringify(c.data) : '',
        'Réponse Serveur': c.remote_response ? JSON.stringify(c.remote_response) : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plaintes");

    // Format filename
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const communeStr = filters.commune ? `_${filters.commune}` : '';
    const filename = `plaintes${communeStr}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, filename);
};
