import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase Error: API URL or Anon Key is missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global state exported for other modules to use
export let currentUserRole = 'staff'; 
export let currentUserOrg = 'Guest';

export const authHandler = {
    /**
     * Retrieves session + Fetches Profile Role from Database
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;

            // 1. Set Organization from Metadata
            currentUserOrg = user.user_metadata?.org_name || "Guest";

            // 2. Fetch Role from the profiles table
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile) {
                currentUserRole = profile.role;
            }

            // 3. HARD-CODED RECOGNITION (Extra safety)
            if (user.email === 'adminsystem@gmail.com') {
                currentUserRole = 'super_admin';
            }

            // Apply UI locks/unlocks
            this.applyUIPerks(currentUserRole);

            console.log("Logged in as:", currentUserRole, "from", currentUserOrg);
            return { ...user, role: currentUserRole, org: currentUserOrg };
        } catch (err) {
            console.error("Auth Exception:", err);
            return null;
        }
    },

    /**
     * Maps permissions based on Organization
     */
    getOrgPermissions(user) {
        const orgName = user?.user_metadata?.org_name || "Guest";
        const role = currentUserRole;

        const permissions = {
            org: orgName,
            isFullAdmin: (role === 'super_admin' || orgName === "CITTE LSG" || orgName === "PSTTS Organization"),
            allowedDepts: []
        };

        if (orgName === "HERO Organization" && role !== 'super_admin') {
            permissions.allowedDepts = ["Education Dept.", "Other Department"];
        } else {
            permissions.allowedDepts = ["Education Dept.", "Other Department", "Industrial Technology Dept."];
        }

        return permissions;
    },

    /**
     * Enforces UI restrictions (Hiding buttons/tabs)
     */
    applyUIPerks(role) {
        setTimeout(() => {
            const adminTab = document.getElementById('nav-admin-settings');
            const importBtn = document.getElementById('btn-import');
            const addBtn = document.getElementById('btn-open-modal');

            if (adminTab) {
                adminTab.style.display = (role === 'super_admin') ? 'block' : 'none';
            }

            if (role === 'staff') {
                [importBtn, addBtn].forEach(btn => {
                    if (btn) {
                        btn.classList.add('opacity-50', 'cursor-not-allowed');
                        btn.onclick = (e) => {
                            e.stopImmediatePropagation();
                            alert("Access Denied: Staff accounts cannot modify student records.");
                        };
                    }
                });
            }
        }, 200);
    },

    async signIn(email, password) {
        return await supabase.auth.signInWithPassword({ email, password });
    },

    async signUp(fullName, email, password, orgName) {
        const res = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    org_name: orgName
                }
            }
        });

        if (res.data?.user) {
            await supabase.from('profiles').upsert({
                id: res.data.user.id,
                email: email,
                full_name: fullName,
                role: 'admin' 
            });
        }
        return res;
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.reload();
    }
};
