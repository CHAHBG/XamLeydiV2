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
                let allData: Complaint[] = [];
                let page = 0;
                const pageSize = 1000;
                let fetchMore = true;

                while (fetchMore) {
                    let query = supabase
                        .from('complaints')
                        .select('*')
                        .order('date', { ascending: false })
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (activeFilters.startDate) {
                        query = query.gte('date', activeFilters.startDate.toISOString());
                    }
                    if (activeFilters.endDate) {
                        query = query.lte('date', activeFilters.endDate.toISOString());
                    }
                    if (activeFilters.commune) {
                        query = query.ilike('commune', activeFilters.commune);
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

                    if (err) throw err;

                    if (result) {
                        allData = [...allData, ...(result as Complaint[])];
                        if (result.length < pageSize) {
                            fetchMore = false;
                        } else {
                            page++;
                        }
                    } else {
                        fetchMore = false;
                    }
                }

                if (mounted) {
                    setData(allData);
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
