/**
 * 1. EMERGENCY ALERT SYSTEM (Must be at the very top)
 */
window.showAlert = function(msg, type = 'error') {
    const toast = document.getElementById('toast-box');
    const toastMsg = document.getElementById('toast-msg');
    
    if (!toast) {
        alert(msg); // Fallback if HTML isn't ready
        return;
    }

    toastMsg.innerText = msg;
    // Apply styling and show
    toast.className = "flex items-center bg-white border-2 border-[#000080] p-4 rounded-2xl shadow-2xl fixed top-5 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300";
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
};

window.onerror = function(message, source, lineno) {
    window.showAlert("System Error: " + message + " at line " + lineno);
};

/**
 * 2. IMPORTS
 */
import { authHandler } from './auth.js';
import { dashboardModule } from './dashboard.js'; // Ensure this file exists!
import { createIcons, Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut } from 'lucide';

/**
 * 3. INITIALIZER
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Icons
    createIcons({
        icons: { Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut }
    });

    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');

    // Check Session Status
    try {
        const user = await authHandler.getCurrentUser();

        if (user) {
            if (authScreen) authScreen.classList.add('hidden');
            if (appScreen) appScreen.classList.remove('hidden');
            setupUserUI(user);
            window.showSection('dashboard'); // Auto-load dashboard
        } else {
            if (authScreen) authScreen.classList.remove('hidden');
            if (appScreen) appScreen.classList.add('hidden');
        }
    } catch (err) {
        window.showAlert("Auth Connection Failed: " + err.message);
    }

    // Handle Login
    const loginBtn = document.getElementById('btn-login-exec');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email')?.value;
            const pass = document.getElementById('login-password')?.value;

            if (!email || !pass) {
                window.showAlert("Please enter email and password");
                return;
            }

            const { error } = await authHandler.signIn(email, pass);
            if (error) {
                window.showAlert(error.message);
            } else {
                window.location.reload();
            }
        });
    }

    // Handle Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authHandler.logout();
            window.location.reload();
        });
    }
});

/**
 * 4. UI SETUP
 */
function setupUserUI(user) {
    const displayOrg = document.getElementById('display-org-name');
    const displayUser = document.getElementById('user-full-name');
    const displayAvatar = document.getElementById('user-avatar');

    const fullName = user.user_metadata?.full_name || "Admin User";
    const orgName = user.user_metadata?.org_name || "Organization";

    if (displayOrg) displayOrg.innerText = orgName;
    if (displayUser) displayUser.innerText = fullName;
    if (displayAvatar) {
        displayAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=000080&color=fff`;
    }
}

/**
 * 5. GLOBAL NAVIGATION (Module Switcher)
 */
window.showSection = (sectionId) => {
    // Hide all logical sections (if you have them in index.html)
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    
    // Clear the dynamic module containers
    document.querySelectorAll('.module-container').forEach(div => div.innerHTML = '');

    // Show the target section or module
    if (sectionId === 'dashboard') {
        dashboardModule.init(); 
    } else {
        const target = document.getElementById(`section-${sectionId}`);
        if (target) target.classList.remove('hidden');
    }

    // Update Header
    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    // Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('bg-white/10');
        if (btn.innerText.toLowerCase().includes(sectionId)) {
            btn.classList.add('bg-white/10');
        }
    });
};
