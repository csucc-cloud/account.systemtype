import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const eventManager = {
    async getEvents() {
        const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false });
        return data || [];
    },
    async setStatus(id, status) {
        return await supabase.from('events').update({ status }).eq('id', id);
    }
};
