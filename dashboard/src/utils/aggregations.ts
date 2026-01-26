import type { Complaint } from '../types/complaint';
import { format, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

export const groupByCommune = (complaints: Complaint[]) => {
    return complaints.reduce((acc, complaint) => {
        const commune = complaint.commune || 'Non spécifié';
        acc[commune] = (acc[commune] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
};

export const groupByVillage = (complaints: Complaint[]) => {
    return complaints.reduce((acc, complaint) => {
        const village = complaint.village || 'Non spécifié';
        acc[village] = (acc[village] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
};

export const groupByReason = (complaints: Complaint[]) => {
    return complaints.reduce((acc, complaint) => {
        // Normalize reason? For now raw.
        const reason = complaint.complaint_reason || 'Non spécifié';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
};

export const groupBySex = (complaints: Complaint[]) => {
    return complaints.reduce((acc, complaint) => {
        const sex = complaint.complainant_sex === 'M' ? 'Masculin' : complaint.complainant_sex === 'F' ? 'Féminin' : 'Inconnu';
        acc[sex] = (acc[sex] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
};

export const groupByDate = (complaints: Complaint[], interval: 'day' | 'week' | 'month') => {
    const grouped = complaints.reduce((acc, complaint) => {
        if (!complaint.date) return acc;
        const date = parseISO(complaint.date);
        let key = '';

        if (interval === 'day') {
            key = format(startOfDay(date), 'yyyy-MM-dd');
        } else if (interval === 'week') {
            key = format(startOfWeek(date, { locale: fr }), 'yyyy-MM-dd');
        } else if (interval === 'month') {
            key = format(startOfMonth(date), 'yyyy-MM');
        }

        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));
};

export const getTopVillages = (complaints: Complaint[], limit = 10) => {
    const grouped = groupByVillage(complaints);
    return Object.entries(grouped)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([village, count]) => ({ village, count }));
};
