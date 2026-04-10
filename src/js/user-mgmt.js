import { supabase } from './auth.js';

export const userMgmt = {
    async fetchAllAdmins() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin');
        
        if (error) throw error;
        return data || [];
    },

    async createAdmin(email, password, fullName, orgId, dept) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: 'admin',
                    organization_id: orgId,
                    department: dept
                }
            }
        });
        if (error) throw error;
        return data;
    }
};
