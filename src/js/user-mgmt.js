import { supabase } from './auth.js';

export const userMgmt = {
    async fetchAdmins() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        return data;
    },

    async createAdmin(email, password, fullName, orgName) {
        // Ang signUp na ito ay magti-trigger sa SQL function natin sa database
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: 'admin',
                    organization_name: orgName
                }
            }
        });

        if (error) throw error;
        return data;
    },

    // Paalala: Ang pag-delete ng user ay nangangailangan ng Edge Function/Admin API
    // Pero maaari nating i-disable ang profile sa database
    async toggleUserStatus(userId, isActive) {
        const { error } = await supabase
            .from('profiles')
            .update({ is_active: isActive })
            .eq('id', userId);
        
        if (error) throw error;
    }
};
