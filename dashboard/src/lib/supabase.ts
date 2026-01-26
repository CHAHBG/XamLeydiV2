import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    // Only log in development to avoid leaking info, though these are public/anon keys
    if (import.meta.env.DEV) {
        console.warn("Supabase credentials missing in .env using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
    }
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
