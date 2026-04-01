
import { authHandler } from './auth.js';
import { dashboardModule } from './dashboard.js'; 
import { studentModule } from './students.js';
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
window.showSection = function(sectionId) {
    // 1. Target both Modules and Sections
    const allContainers = document.querySelectorAll('.module-container, section');
    
    allContainers.forEach(el => {
        el.classList.add('hidden');
        // Clean up animation classes so they can restart
        el.classList.remove('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
    });

    const target = document.getElementById(`mod-${sectionId}`) || document.getElementById(`section-${sectionId}`);
    
    if (target) {
        // 2. The Trick: Use a tiny timeout to let the browser "breathe"
        target.classList.remove('hidden');
        
        requestAnimationFrame(() => {
            target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
        });

        // 3. Init logic
        if (sectionId === 'dashboard') dashboardModule.init();
        else if (sectionId === 'students') studentModule.init();
    }

    // 4. Update Title and Sidebar
    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    updateNavUI(sectionId);
};
};

function updateNavUI(sectionId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        // Remove the 'active' background from all buttons
        btn.classList.remove('bg-white/10', 'text-white');
        btn.classList.add('text-slate-400'); // Dim the inactive ones

        // If the button text matches the section we are in, highlight it
        if (btn.innerText.toLowerCase().includes(sectionId.toLowerCase())) {
            btn.classList.add('bg-white/10', 'text-white');
            btn.classList.remove('text-slate-400');
        }
    });
}

// Initial Load
auth.checkSession();
