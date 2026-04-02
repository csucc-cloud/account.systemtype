import { authHandler } from './auth.js';
import { dashboardModule } from './dashboard.js'; 
import { studentModule } from './students.js';
import { eventsModule } from './events.js'; 
import { logAction } from './utils/audit-logger.js'; // 1. Added Audit Logger Import
import { createIcons, Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X } from 'lucide';

// Make logAction global for all other modules to use easily
window.logAction = logAction;

/**
 * SIDEBAR CONTROLLER 
 */
const sidebarController = {
    init() {
        const sidebar = document.getElementById('sidebar-main');
        const openBtn = document.getElementById('open-sidebar');
        const closeBtn = document.getElementById('close-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (!sidebar || !openBtn) return;

        const toggleSidebar = (isOpen) => {
            if (isOpen) {
                sidebar.classList.add('sidebar-open');
                sidebar.classList.remove('-translate-x-full');
                overlay?.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            } else {
                sidebar.classList.remove('sidebar-open');
                sidebar.classList.add('-translate-x-full');
                overlay?.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            }
        };

        openBtn.addEventListener('click', () => toggleSidebar(true));
        closeBtn?.addEventListener('click', () => toggleSidebar(false));
        overlay?.addEventListener('click', () => toggleSidebar(false));

        const navLinks = sidebar.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1280) toggleSidebar(false);
            });
        });
    }
};

/**
 * APP INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    createIcons({
        icons: { Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X }
    });

    sidebarController.init();

    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');

    try {
        const user = await authHandler.getCurrentUser();

        if (user) {
            authScreen?.classList.add('hidden');
            appScreen?.classList.remove('hidden');
            
            const role = user.user_metadata?.role || 'staff'; 
            localStorage.setItem('user_role', role);
            
            setupUserUI(user);
            window.showSection('dashboard');
            
            // 2. LOG: Session Restoration
            logAction('SESSION_RESTORED', `User ${user.email} reconnected.`);
        } else {
            authScreen?.classList.remove('hidden');
            appScreen?.classList.add('hidden');
        }
    } catch (err) {
        console.error("Auth Connection Failed:", err.message);
    }

    // Login logic
    document.getElementById('btn-login-exec')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value;
        const pass = document.getElementById('login-password')?.value;

        if (!email || !pass) return window.showAlert?.("Please enter email and password");

        const { data, error } = await authHandler.signIn(email, pass);
        if (error) {
            logAction('LOGIN_FAILED', `Attempted email: ${email}`); // 3. LOG: Failed Login
            window.showAlert?.(error.message);
        } else {
            // 4. LOG: Successful Login
            await logAction('LOGIN_SUCCESS', `User ${email} logged in.`);
            window.location.reload();
        }
    });

    // Logout logic
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        // 5. LOG: Logout (done before clearing storage)
        await logAction('LOGOUT', 'User initiated logout.');
        
        await authHandler.logout();
        localStorage.clear(); 
        window.location.reload();
    });
});

/**
 * UI SETTINGS
 */
function setupUserUI(user) {
    const fullName = user.user_metadata?.full_name || "Admin User";
    const orgName = user.user_metadata?.org_name || "Organization";
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=000080&color=fff`;

    const setEl = (id, val, prop = 'innerText') => {
        const el = document.getElementById(id);
        if (el) el[prop] = val;
    };

    setEl('display-org-name', orgName);
    setEl('user-full-name', fullName);
    setEl('footer-user-name', fullName);
    setEl('user-avatar', avatarUrl, 'src');
    setEl('footer-avatar', avatarUrl, 'src');
}

/**
 * ROUTER / SECTION SWITCHER
 */
window.showSection = function(sectionId) {
    // 1. Hide all containers
    document.querySelectorAll('.module-container, section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-in', 'fade-in', 'slide-in-from-bottom-2');
    });

    // 2. Show target container
    const target = document.getElementById(`mod-${sectionId}`) || document.getElementById(`section-${sectionId}`);
    if (target) {
        target.classList.remove('hidden');
        requestAnimationFrame(() => {
            target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
        });

        // 6. LOG: Navigation Tracking
        logAction('NAVIGATE', `Viewed ${sectionId} section`);

        // 3. Initialize Module-Specific Logic
        switch(sectionId) {
            case 'dashboard':
                dashboardModule.init();
                break;
            case 'students':
                studentModule.init();
                break;
            case 'events':
                eventsModule.render(); 
                break;
            case 'attendance':
                if(!sessionStorage.getItem('active_event')) {
                    window.showAlert?.("Select an active event first!");
                    window.showSection('events');
                } else {
                    // attendanceModule.render(); 
                }
                break;
        }
    }

    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    updateNavUI(sectionId);
};

function updateNavUI(sectionId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick') || "";
        btn.classList.toggle('active', clickAttr.includes(`'${sectionId}'`));
    });
}
