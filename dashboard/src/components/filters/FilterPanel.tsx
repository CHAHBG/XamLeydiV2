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
            const { data } = await supabase
                .from('complaints')
                .select('commune') // Distinct not directly supported via API easily without .rpc or hack, but let's try .csv or just fetch all logic? 
                // Better: create a stored procedure or just use lightweight query if possible.
                // Actually Supabase JS client supports .select('commune', { count: 'exact', head: false })?
                // Standard way for distinct: .select('commune').distinct() doesn't exist directly in older versions?
                // It does exist or we use .select('commune').range(0, 1000) then Set?
                // Efficient way: .from('complaints').select('commune').not('commune', 'is', null) 
                // Then processing in JS. Not efficient for large DB but okay for demo.
                // Better: use a distinct RPC function.
                // For now, I'll fetch unique communes via JS post-processing to keep it simple without DB migrations.
                .select('commune');

            if (data) {
                const unique = Array.from(new Set(data.map(d => d.commune).filter(Boolean))).sort();
                setCommunes(unique);
            }
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

            const { data } = await supabase
                .from('complaints')
                .select('village')
                .eq('commune', filters.commune);

            if (data) {
                const unique = Array.from(new Set(data.map(d => d.village).filter(Boolean))).sort();
                setVillages(unique);
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
