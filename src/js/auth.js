import { createClient } from '@supabase/supabase-js';

// Connect to Supabase using your GitHub Secrets
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const authHandler = {
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    },

    // HERO vs PSTTS Logic
    getOrgPermissions(user) {
        const orgName = user.user_metadata.org_name || "Guest";
        const permissions = {
            org: orgName,
            isFullAdmin: (orgName === "CITTE LSG" || orgName === "PSTTS Organization"),
            allowedDepts: []
        };

        if (orgName === "HERO Organization") {
            // HERO ONLY sees these two categories
            permissions.allowedDepts = ["Education Dept. Student", "General Student(other dept.)"];
        } else {
            // Others see everything
            permissions.allowedDepts = ["Education Dept.", "General Student", "Indus Tech Dept."];
        }

        return permissions;
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.reload();
    }
};
