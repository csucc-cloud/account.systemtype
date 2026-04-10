import { supabase } from './auth.js';

export const staffMgmt = {
    async fetchStaffByOrg(orgId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'staff')
            .eq('organization_id', orgId); // UUID gamit dito base sa screenshot mo
        
        if (error) throw error;
        return data || [];
    },

    async registerStaff(email, password, fullName, orgId, dept) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: 'staff',
                    organization_id: orgId,
                    department: dept
                }
            }
        });
        if (error) throw error;
        return data;
    }
};
