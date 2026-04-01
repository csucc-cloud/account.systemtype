import { authHandler } from './auth.js';
import { chartManager } from './charts.js';
import * as lucide from 'lucide';

/**
 * INITIALIZER
 * Manages the transition from the Balangay Login Screen to the Dashboard.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Render Icons (Lucide) - Using the universal creator
    lucide.createIcons();
    
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');

    // 2. Check Session Status
    const user = await authHandler.getCurrentUser();

    if (user) {
        // User is logged in: Hide login card, show Balangay app
        if (authScreen) authScreen.classList.add('hidden');
        if (appScreen) appScreen.classList.remove('hidden');
        setupDashboard(user);
    } else {
        // Guest: Ensure login card is visible
        if (authScreen) authScreen.classList.remove('hidden');
        if (appScreen) appScreen.classList.add('hidden');
    }

    // 3. Handle SIGN IN (btn-login-exec)
    const loginBtn = document.getElementById('btn-login-exec');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            if (!email || !pass) {
                showFeedback("Please enter email and password.", "text-red-300");
                return;
            }

            showFeedback("Authenticating...", "text-blue-300");

            const { data, error } = await authHandler.signIn(email, pass);
            if (error) {
                showFeedback(error.message, "text-red-300");
            } else {
                window.location.reload();
            }
        });
    }

    // 4. Handle SIGN UP (btn-signup-exec)
    const signupBtn = document.getElementById('btn-signup-exec');
    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-password').value;
            const org = document.getElementById('signup-org').value;

            if (!name || !email || !pass || !org) {
                showFeedback("Missing fields. Fill out all details.", "text-red-300");
                return;
            }

            showFeedback("Registering Officer...", "text-blue-300");

            const { data, error } = await authHandler.signUp(name, email, pass, org);
            if (error) {
                showFeedback(error.message, "text-red-300");
            } else {
                alert("Success! Welcome to the Balangay. Please sign in now.");
                window.location.reload();
            }
        });
    }

    // 5. Handle LOGOUT
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authHandler.logout();
        });
    }
});

/**
 * DASHBOARD INITIALIZATION
 * Connects Supabase user metadata to the Navy Blue UI.
 */
function setupDashboard(user) {
    const displayOrg = document.getElementById('display-org-name');
    const displayUser = document.getElementById('user-full-name');
    const displayAvatar = document.getElementById('user-avatar');

    // Extract Metadata from Supabase Profile
    const fullName = user.user_metadata?.full_name || "Admin User";
    const orgName = user.user_metadata?.org_name || "Organization";

    if (displayOrg) displayOrg.innerText = orgName;
    if (displayUser) displayUser.innerText = fullName;
    
    // Dynamic Avatar based on Name
    if (displayAvatar) {
        displayAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=000080&color=fff`;
    }

    // Load Charts
    try {
        chartManager.renderAttendance('attendanceChart');
        chartManager.renderDistribution('deptChart');
    } catch (e) {
        console.warn("Charts could not load. Ensure charts.js is correct.", e);
    }
}

/**
 * UTILS - For showing errors inside the Balangay Card
 */
function showFeedback(msg, colorClass) {
    const fb = document.getElementById('auth-feedback');
    if (fb) {
        fb.innerText = msg;
        // Resets classes to ensure color updates correctly
        fb.className = `text-center text-xs font-medium py-2 ${colorClass}`;
        fb.classList.remove('hidden');
    }
}

/**
 * GLOBAL NAVIGATION
 * Toggles sections within the dashboard
 */
window.showSection = (sectionId) => {
    // 1. Hide all sections
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    
    // 2. Show selected section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
        target.classList.remove('hidden');
        
        // 3. Update Header Title
        const title = document.getElementById('current-page-title');
        if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    }

    // 4. Update Sidebar UI Active State
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('bg-white/10');
        if (btn.innerText.toLowerCase().includes(sectionId)) {
            btn.classList.add('bg-white/10');
        }
    });
};
