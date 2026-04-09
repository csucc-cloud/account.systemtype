import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dwvxrclaqrqathhdupdq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3dnhyY2xhcXJxYXRoaGR1cGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzU0MTIsImV4cCI6MjA5MDYxMTQxMn0.yoefPWL5wnyQcYqpR-7bXBmoswf0APg3TT2Z68GEKgU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global state exported for other modules
export let currentUserRole = 'guest'; 
export let currentUserOrg = 'Guest';
export let currentUserId = null;

export const authHandler = {
    /**
     * Entry point: Checks if a user is logged in and sets up the global state
     */
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            return await this.getCurrentUser();
        }
        return null;
    },

    /**
     * Fetches fresh user data, metadata, and database profile role
     */
    async getCurrentUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) return null;

            currentUserId = user.id;

            // 1. Get Org from Metadata (Fastest)
            currentUserOrg = user.user_metadata?.org_name || "Guest";

            // 2. Get Role from Profiles Table
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            // 3. Role Logic Hierarchy
            if (user.email === 'adminsystem@gmail.com') {
                currentUserRole = 'super_admin';
            } else if (profile) {
                currentUserRole = profile.role;
            } else {
                currentUserRole = 'staff'; // Default fallback
            }

            // Enforce UI restrictions based on the determined role
            this.applyUIPerks(currentUserRole);

            console.log(`🛡️ Auth: ${user.email} (${currentUserRole}) @ ${currentUserOrg}`);
            return { ...user, role: currentUserRole, org: currentUserOrg };
        } catch (err) {
            console.error("Auth Exception:", err);
            return null;
        }
    },

    /**
     * Logic for specific organization access levels
     */
    getOrgPermissions() {
        const role = currentUserRole;
        const org = currentUserOrg;

        return {
            org: org,
            isSuper: role === 'super_admin',
            // HERO is restricted to Education and Others, everyone else sees all
            allowedDepts: (org === "HERO Organization" && role !== 'super_admin') 
                ? ["Education Dept.", "Other Department"]
                : ["Education Dept.", "Other Department", "Industrial Technology Dept."]
        };
    },

    /**
     * Controls visibility and functionality of UI elements
     */
    applyUIPerks(role) {
        // Wait for DOM to ensure elements exist
        setTimeout(() => {
            const adminTab = document.getElementById('nav-admin-settings');
            const modButtons = [
                document.getElementById('btn-import'),
                document.getElementById('btn-open-modal'),
                document.getElementById('btn-export')
            ];

            // Hide Admin Settings if not Super Admin
            if (adminTab) adminTab.style.display = (role === 'super_admin') ? 'block' : 'none';

            // Disable modification buttons for Staff
            if (role === 'staff') {
                modButtons.forEach(btn => {
                    if (btn) {
                        btn.classList.add('opacity-50', 'cursor-not-allowed', 'filter', 'grayscale');
                        btn.title = "Staff cannot modify records";
                        // Prevent click actions
                        btn.addEventListener('click', (e) => {
                            e.stopImmediatePropagation();
                            alert("Access Denied: Your account role (Staff) is View-Only.");
                        }, true);
                    }
                });
            }
        }, 300);
    },

    async signIn(email, password) {
        const res = await supabase.auth.signInWithPassword({ email, password });
        if (!res.error) await this.getCurrentUser();
        return res;
    },

    async signUp(fullName, email, password, orgName) {
        const res = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, org_name: orgName } }
        });

        if (res.data?.user) {
            // Create the profile entry immediately
            await supabase.from('profiles').insert({
                id: res.data.user.id,
                email: email,
                full_name: fullName,
                role: 'staff' // New signups default to staff
            });
        }
        return res;
    },

    async logout() {
        await supabase.auth.signOut();
        window.location.href = '/'; // Redirect to home/login
    }
};
