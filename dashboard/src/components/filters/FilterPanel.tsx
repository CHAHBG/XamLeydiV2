import { useEffect, useState } from 'react';
import type { FilterOptions } from '../../types/complaint';
import { Select } from './Select';
import { supabase } from '../../lib/supabase';
import { RotateCcw } from 'lucide-react';

interface FilterPanelProps {
    filters: FilterOptions;
    onFilterChange: (filters: FilterOptions) => void;
}

export function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
    const [communes, setCommunes] = useState<string[]>([]);
    const [villages, setVillages] = useState<string[]>([]);

    // Fetch communes on mount
    useEffect(() => {
        async function fetchCommunes() {
            let allCommunes: Set<string> = new Set();
            let page = 0;
            const pageSize = 1000;
            let fetchMore = true;

            while (fetchMore) {
                const { data, error } = await supabase
                    .from('complaints')
                    .select('commune')
                    .order('id', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data || data.length === 0) {
                    fetchMore = false;
                } else {
                    data.forEach(d => {
                        if (d.commune) allCommunes.add(d.commune.toUpperCase().trim());
                    });

                    if (data.length < pageSize) {
                        fetchMore = false;
                    } else {
                        page++;
                    }
                }
            }

            setCommunes(Array.from(allCommunes).sort());
        }
        fetchCommunes();
    }, []);

    // Fetch villages when commune changes
    useEffect(() => {
        async function fetchVillages() {
            if (!filters.commune) {
                setVillages([]);
                return;
            }

            while (fetchMore) {
                const { data, error } = await supabase
                    .from('complaints')
                    .select('village')
                    .eq('commune', filters.commune) // We can't easily use ilike here without fetching everything first if we want strict relation. 
                    // Actually, let's keep the filter simple.
                    .ilike('commune', filters.commune)
                    .order('id', { ascending: true })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error || !data) {
                    fetchMore = false;
                } else {
                    data.forEach(d => {
                        if (d.village) allVillages.add(d.village.toUpperCase().trim());
                    });

                    if (data.length < pageSize) {
                        fetchMore = false;
                    } else {
                        page++;
                    }
                }
            }
        }
        fetchVillages();
    }, [filters.commune]);

    const handleChange = (key: keyof FilterOptions, value: any) => {
        const newFilters = { ...filters, [key]: value };
        if (key === 'commune') {
            newFilters.village = undefined; // Reset village on commune change
        }
        onFilterChange(newFilters);
    };

    const clearFilters = () => {
        onFilterChange({});
    }

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-800">Filtres</h3>
                <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-primary flex items-center gap-1">
                    <RotateCcw size={14} /> Réinitialiser
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date Range - Simplified using native date inputs */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Période (Début)</label>
                    <input
                        type="date"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                        value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => handleChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Période (Fin)</label>
                    <input
                        type="date"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                        value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => handleChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
                    />
                </div>

                <Select
                    label="Commune"
                    value={filters.commune || ''}
                    onChange={(e) => handleChange('commune', e.target.value || undefined)}
                    options={communes.map(c => ({ value: c, label: c }))}
                />

                <Select
                    label="Village"
                    value={filters.village || ''}
                    onChange={(e) => handleChange('village', e.target.value || undefined)}
                    options={villages.map(v => ({ value: v, label: v }))}
                    disabled={!filters.commune}
                />

                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Motif</label>
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2"
                        value={filters.motif || ''}
                        onChange={(e) => handleChange('motif', e.target.value || undefined)}
                    />
                </div>

                <Select
                    label="Sexe"
                    value={filters.sex || 'all'}
                    onChange={(e) => handleChange('sex', e.target.value)}
                    options={[
                        { value: 'all', label: 'Tous' },
                        { value: 'M', label: 'Masculin' },
                        { value: 'F', label: 'Féminin' },
                    ]}
                />

                <Select
                    label="Catégorie"
                    value={filters.category || 'all'}
                    onChange={(e) => handleChange('category', e.target.value)}
                    options={[
                        { value: 'all', label: 'Toutes' },
                        { value: 'sensible', label: 'Sensible' },
                        { value: 'non_sensible', label: 'Non Sensible' },
                    ]}
                />
            </div>
        </div>
    );
}
