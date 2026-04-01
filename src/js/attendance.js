import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const attendanceManager = {
    async markPresent(studentId, eventId) {
        return await supabase.from('attendance').insert([{ 
            student_id: studentId, 
            event_id: eventId, 
            status: 'Present',
            timestamp: new Date() 
        }]);
    }
};
