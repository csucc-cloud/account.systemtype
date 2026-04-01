import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase with Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail-safe: Check if keys are missing before creating the client
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase Error: API URL or Anon Key is missing. Check your GitHub Secrets.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * AUTH HANDLER
 * Centralizes all Supabase communication logic.
 */
export const authHandler = {
    /**
     * Retrieves the current user session.
     * Used by main.js to decide whether to show the Login screen or Dashboard.
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;
            return user;
        } catch (err) {
            console.error("Auth Exception:", err);
            return null;
        }
    },

    /**
     * Maps the user's organization to specific dashboard permissions.
     */
    getOrgPermissions(user) {
        const orgName = user?.user_metadata?.org_name || "Guest";
        const permissions = {
            org: orgName,
            isFullAdmin: (orgName === "CITTE LSG" || orgName === "PSTTS Organization"),
            allowedDepts: []
        };

        // HERO has limited visibility compared to PSTTS or LSG
        if (orgName === "HERO Organization") {
            permissions.allowedDepts = ["Education Dept. Student", "General Student(other dept.)"];
        } else {
            permissions.allowedDepts = ["Education Dept.", "General Student", "Indus Tech Dept."];
        }

        return permissions;
    },

    /**
     * Handles Log In
     */
    async signIn(email, password) {
        return await supabase.auth.signInWithPassword({
            email,
            password
        });
    },

    /**
     * Handles Sign Up + Metadata Injection
     * This is critical: without 'org_name' in metadata, the Dashboard won't load correctly.
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
     * Clears session and refreshes page to show the Auth Screen
     */
    async logout() {
        await supabase.auth.signOut();
        window.location.reload();
    }
};
