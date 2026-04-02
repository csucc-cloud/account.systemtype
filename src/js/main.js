import { authHandler } from './auth.js';
import { dashboardModule } from './dashboard.js'; 
import { studentModule } from './students.js';
// Lucide icons including Menu and X for the sidebar toggle
import { createIcons, Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X } from 'lucide';

/**
 * SIDEBAR CONTROLLER 
 * Manages the open/close state for mobile and tablet responsiveness
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
                // Slide the sidebar in and show overlay
                sidebar.classList.remove('-translate-x-full');
                overlay?.classList.remove('hidden');
                document.body.classList.add('overflow-hidden');
            } else {
                // Slide the sidebar out and hide overlay
                sidebar.classList.add('-translate-x-full');
                overlay?.classList.add('hidden');
                document.body.classList.remove('overflow-hidden');
            }
        };

        openBtn.addEventListener('click', () => toggleSidebar(true));
        closeBtn?.addEventListener('click', () => toggleSidebar(false));
        overlay?.addEventListener('click', () => toggleSidebar(false));

        // Auto-close sidebar when a navigation item is clicked
        const navLinks = sidebar.querySelectorAll('.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                // Set to 1280 to match the XL breakpoint used in your HTML
                if (window.innerWidth < 1280) toggleSidebar(false);
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize icons
    createIcons({
        icons: { Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X }
    });

    // Initialize Sidebar Logic
    sidebarController.init();

    const authScreen = document.getElementById('auth-screen');
    const appScreen = document.getElementById('app');

    try {
        const user = await authHandler.getCurrentUser();

        if (user) {
            if (authScreen) authScreen.classList.add('hidden');
            if (appScreen) appScreen.classList.remove('hidden');
            setupUserUI(user);
            window.showSection('dashboard');
        } else {
            if (authScreen) authScreen.classList.remove('hidden');
            if (appScreen) appScreen.classList.add('hidden');
        }
    } catch (err) {
        if (window.showAlert) {
            window.showAlert("Auth Connection Failed: " + err.message);
        } else {
            console.error("Auth Connection Failed:", err.message);
        }
    }

    const loginBtn = document.getElementById('btn-login-exec');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email')?.value;
            const pass = document.getElementById('login-password')?.value;

            if (!email || !pass) {
                if (window.showAlert) window.showAlert("Please enter email and password");
                return;
            }

            const { error } = await authHandler.signIn(email, pass);
            if (error) {
                if (window.showAlert) window.showAlert(error.message);
            } else {
                window.location.reload();
            }
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authHandler.logout();
            window.location.reload();
        });
    }
});

function setupUserUI(user) {
    const displayOrg = document.getElementById('display-org-name');
    const displayUser = document.getElementById('user-full-name');
    const displayAvatar = document.getElementById('user-avatar');
    const footerUser = document.getElementById('footer-user-name');
    const footerAvatar = document.getElementById('footer-avatar');

    const fullName = user.user_metadata?.full_name || "Admin User";
    const orgName = user.user_metadata?.org_name || "Organization";

    if (displayOrg) displayOrg.innerText = orgName;
    if (displayUser) displayUser.innerText = fullName;
    if (footerUser) footerUser.innerText = fullName;
    
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=000080&color=fff`;
    if (displayAvatar) displayAvatar.src = avatarUrl;
    if (footerAvatar) footerAvatar.src = avatarUrl;
}

window.showSection = function(sectionId) {
    const allContainers = document.querySelectorAll('.module-container, section');
    
    allContainers.forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
    });

    const target = document.getElementById(`mod-${sectionId}`) || document.getElementById(`section-${sectionId}`);
    
    if (target) {
        target.classList.remove('hidden');
        
        requestAnimationFrame(() => {
            target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
        });

        if (sectionId === 'dashboard') dashboardModule.init();
        else if (sectionId === 'students') studentModule.init();
    }

    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    updateNavUI(sectionId);
};

function updateNavUI(sectionId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick') || "";
        
        if (clickAttr.includes(`'${sectionId}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

if (window.auth) {
    auth.checkSession();
}
