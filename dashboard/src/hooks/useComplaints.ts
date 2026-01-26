import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Complaint, FilterOptions } from '../types/complaint';

function isDeepEqual(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function useComplaints(filters: FilterOptions) {
    const [data, setData] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use ref to prevent infinite loops if filters object is recreated but identical
    const prevFiltersRef = useRef(filters);
    const filtersChanged = !isDeepEqual(prevFiltersRef.current, filters);

    if (filtersChanged) {
        prevFiltersRef.current = filters;
    }

    const activeFilters = prevFiltersRef.current;

    useEffect(() => {
        let mounted = true;

        async function fetchComplaints() {
            try {
                setLoading(true);
                let query = supabase
                    .from('complaints')
                    .select('*')
                    .order('date', { ascending: false })
                    .limit(5000);

                if (activeFilters.startDate) {
                    query = query.gte('date', activeFilters.startDate.toISOString());
                }
                if (activeFilters.endDate) {
                    query = query.lte('date', activeFilters.endDate.toISOString());
                }
                if (activeFilters.commune) {
                    query = query.eq('commune', activeFilters.commune);
                }
                if (activeFilters.village) {
                    query = query.eq('village', activeFilters.village);
                }
                if (activeFilters.motif) {
                    query = query.ilike('complaint_reason', `%${activeFilters.motif}%`);
                }
                if (activeFilters.sex && activeFilters.sex !== 'all') {
                    query = query.eq('complainant_sex', activeFilters.sex);
                }
                if (activeFilters.category && activeFilters.category !== 'all') {
                    query = query.eq('complaint_category', activeFilters.category);
                }

                const { data: result, error: err } = await query;

                if (mounted) {
                    if (err) throw err;
                    setData(result as Complaint[] || []);
                    setError(null);
                }
            } catch (err: any) {
                if (mounted) {
                    console.error('Error fetching complaints:', err);
                    setError(err.message || 'Failed to fetch complaints');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchComplaints();

        return () => {
            mounted = false;
        };
    }, [activeFilters]);

    // Refetch capability could be added
    return { data, loading, error };
}
