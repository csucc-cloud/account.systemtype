import { authHandler } from './auth.js';
import { chartManager } from './charts.js';
import * as lucide from 'lucide';

/**
 * INITIALIZER
 * Runs when the page loads to check if we show the Login or the Dashboard.
 */
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');
    const loginBtn = document.getElementById('btn-login');

    // 1. Check for an existing session
    const user = await authHandler.getCurrentUser();

    if (user) {
        // User is logged in: Hide login, show dashboard
        if(authScreen) authScreen.classList.add('hidden');
        if(appScreen) appScreen.classList.remove('hidden');
        initializeDashboard(user);
    } else {
        // User is a guest: Ensure login screen is visible
        if(authScreen) authScreen.classList.remove('hidden');
    }

    // 2. Handle Login Button Click
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const errorMsg = document.getElementById('auth-error');

            const { data, error } = await authHandler.signIn(email, pass);
            
            if (error) {
                errorMsg.innerText = error.message;
                errorMsg.classList.remove('hidden');
            } else {
                window.location.reload(); // Refresh to trigger the 'user exists' logic
            }
        });
    }

    // 3. Handle Logout Button Click
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authHandler.logout();
            window.location.reload();
        });
    }
});

/**
 * DASHBOARD SETUP
 * Fills the UI with data once the user is authenticated.
 */
function initializeDashboard(user) {
    const displayOrg = document.getElementById('display-org-name');
    const displayUser = document.getElementById('user-full-name');

    // Set Organization and User names from Supabase Metadata
    if (displayOrg) displayOrg.innerText = user.user_metadata.org_name || "Organization";
    if (displayUser) displayUser.innerText = user.user_metadata.full_name || "Admin User";

    // Render the Analytics Charts
    chartManager.renderAttendance('attendanceChart');
    chartManager.renderDistribution('deptChart');
}

/**
 * NAVIGATION LOGIC
 * Toggles between sections (Dashboard, Students, Events, etc.)
 */
window.showSection = (sectionId) => {
    // Hide all sections
    const sections = document.querySelectorAll('section');
    sections.forEach(s => s.classList.add('hidden'));

    // Show the selected section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) {
        target.classList.remove('hidden');
        
        // Update the Header Title
        const pageTitle = document.getElementById('current-page-title');
        if (pageTitle) pageTitle.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    }
};
