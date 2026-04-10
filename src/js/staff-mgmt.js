import { supabase } from './auth.js';

export const staffMgmt = {
    async fetchStaffByOrg(orgName) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'finance_staff')
            .eq('organization_name', orgName)
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        return data;
    },

    async registerStaff(email, password, fullName, orgName) {
        // Strict: Ang organization_name ay dapat manggaling sa state ng Admin
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: 'finance_staff',
                    organization_name: orgName
                }
            }
        });

        if (error) throw error;
        return data;
    }
};
