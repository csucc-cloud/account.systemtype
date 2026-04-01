import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL, 
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const authHandler = {
    /**
     * Get the current session user
     */
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    },

    /**
     * Logic for HERO vs PSTTS departmental filtering
     */
    getOrgPermissions(user) {
        const orgName = user?.user_metadata?.org_name || "Guest";
        const permissions = {
            org: orgName,
            isFullAdmin: (orgName === "CITTE LSG" || orgName === "PSTTS Organization"),
            allowedDepts: []
        };

        if (orgName === "HERO Organization") {
            permissions.allowedDepts = ["Education Dept. Student", "General Student(other dept.)"];
        } else {
            permissions.allowedDepts = ["Education Dept.", "General Student", "Indus Tech Dept."];
        }

        return permissions;
    },

    /**
     * NEW: Handle Sign In (Logic for btn-login-exec)
     */
    async signIn(email, password) {
        return await supabase.auth.signInWithPassword({
            email,
            password
        });
    },

    /**
     * NEW: Handle Sign Up (Logic for btn-signup-exec)
     * Injects the metadata needed for the RLS policies to work.
     */
    async signUp(fullName, email, password, orgName) {
        return await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    org_name: orgName
                }
            }
        });
    },

    /**
     * Terminate session and reset UI
     */
    async logout() {
        await supabase.auth.signOut();
        window.location.reload();
    }
};
