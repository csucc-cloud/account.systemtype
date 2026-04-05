import { authHandler } from './auth.js';
import { dashboardModule } from './dashboard.js'; 
import { studentModule } from './students.js';
import { eventsModule } from './events.js'; 
import { logAction } from './audit-logger.js';
import { financeModule } from './finance.js';
import { attendanceModule } from './attendance.js';
import { createIcons, Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X } from 'lucide';

// Global access for module interoperability
window.logAction = logAction;
window.eventsModule = eventsModule;
window.attendanceModule = attendanceModule;

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
    createIcons({
        icons: { Compass, LayoutDashboard, Users, CalendarRange, Wallet, QrCode, LogOut, Menu, X }
    });

    sidebarController.init();
    
    // Initialize Notification Brain
    brainInterceptor.init();

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
            
            // --- URL ROUTER INITIALIZATION ---
            const initialSection = window.location.hash.replace('#', '') || 'dashboard';
            window.showSection(initialSection);
            
            logAction('SESSION_RESTORED', `User ${user.email} reconnected.`);
        } else {
            authScreen?.classList.remove('hidden');
            appScreen?.classList.add('hidden');
        }
    } catch (err) {
        console.error("Auth Connection Failed:", err.message);
    }

    // Login Action
    document.getElementById('btn-login-exec')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value;
        const pass = document.getElementById('login-password')?.value;

        if (!email || !pass) return window.showAlert?.("Please enter email and password");

        const { data, error } = await authHandler.signIn(email, pass);
        if (error) {
            logAction('LOGIN_FAILED', `Attempted email: ${email}`);
            window.showAlert?.(error.message);
        } else {
            await logAction('LOGIN_SUCCESS', `User ${email} logged in.`);
            window.location.reload();
        }
    });

    // Logout Action
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
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
    // 1. Update URL Hash without refreshing
    if (window.location.hash !== `#${sectionId}`) {
        window.history.pushState(null, null, `#${sectionId}`);
    }

    // 2. Hide all containers and reset animations
    document.querySelectorAll('.module-container, section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-in', 'fade-in', 'slide-in-from-bottom-2');
    });

    // 3. Show target container
    const target = document.getElementById(`mod-${sectionId}`) || document.getElementById(`section-${sectionId}`);
    if (target) {
        target.classList.remove('hidden');
        requestAnimationFrame(() => {
            target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
        });

        logAction('NAVIGATE', `Viewed ${sectionId} section`);

        // 4. Initialize Module-Specific Logic
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
                attendanceModule.render(); 
                break;
            case 'finance':
                financeModule.render();
                break;
        }
    }

    // Update Header Title
    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    updateNavUI(sectionId);
};

// Listen for Browser Back/Forward buttons
window.addEventListener('popstate', () => {
    const sectionId = window.location.hash.replace('#', '') || 'dashboard';
    window.showSection(sectionId);
});

/**
 * UPDATED NAV UI: Handles both onclick and href triggers to keep blue indicator working
 */
function updateNavUI(sectionId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick') || "";
        const hrefAttr = btn.getAttribute('href') || "";
        
        // Active if either the onclick or the href contains the section ID
        const isActive = clickAttr.includes(`'${sectionId}'`) || hrefAttr === `#${sectionId}`;
        
        btn.classList.toggle('active', isActive);
    });
}

/**
 * THE STORYTELLER BRAIN: Global Activity Monitor
 */
const brainInterceptor = {
    notifications: [],

    init() {
        this.setupUI();
        this.interceptFetch();
    },

    setupUI() {
        const btn = document.getElementById('btn-notifications');
        const dropdown = document.getElementById('noti-dropdown');
        
        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown?.classList.toggle('hidden');
            document.getElementById('noti-badge')?.classList.add('hidden');
        });

        document.addEventListener('click', () => dropdown?.classList.add('hidden'));
    },

    interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            const url = args[0].toString();
            const method = args[1]?.method?.toUpperCase() || 'GET';
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const userName = document.getElementById('user-full-name')?.innerText || "An officer";

            // 1. LOGIN / LOGOUT SENTENCES
            if (url.includes('/auth/v1/token') && response.ok && method === 'POST') {
                setTimeout(() => {
                    const freshName = document.getElementById('user-full-name')?.innerText || "Officer";
                    this.push(`${freshName} logged into the system at ${time}`, "System Access");
                }, 1000);
            }

            // 2. DATA ACTIVITY SENTENCES
            if (response.ok && ['POST', 'PATCH', 'DELETE'].includes(method)) {
                if (url.includes('/auth/v1/')) return response; // Ignore internal auth traffic

                let sentence = "";
                let category = "Activity";

                if (url.includes('finance')) {
                    sentence = `${userName} added a new payment record at ${time}`;
                    category = "Finance";
                } 
                else if (url.includes('attendance')) {
                    sentence = `${userName} started tracking attendance at ${time}`;
                    category = "Attendance";
                }
                else if (url.includes('students')) {
                    const action = method === 'DELETE' ? 'removed a student' : 'registered a new student';
                    sentence = `${userName} ${action} at ${time}`;
                    category = "Registry";
                }
                else if (url.includes('events')) {
                    sentence = `${userName} updated the event details at ${time}`;
                    category = "Events";
                }

                if (sentence) this.push(sentence, category);
            }

            return response;
        };
    },

    push(message, title) {
        const entry = { id: Date.now(), title, message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        this.notifications.unshift(entry);
        if (this.notifications.length > 25) this.notifications.pop();
        
        this.render();
        this.toast(title, message);
        document.getElementById('noti-badge')?.classList.remove('hidden');
    },

    render() {
        const list = document.getElementById('noti-list');
        if (!list) return;
        list.innerHTML = this.notifications.map(n => `
            <div class="px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors animate-in slide-in-from-right-2">
                <p class="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">${n.title}</p>
                <p class="text-[11px] text-slate-700 font-medium leading-relaxed">${n.message}</p>
                <p class="text-[9px] text-slate-300 mt-2 font-bold uppercase tracking-widest">${n.time}</p>
            </div>
        `).join('');
    },

    toast(title, msg) {
        if (!window.Swal) return;
        Swal.fire({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 4000,
            icon: 'info',
            title: `<span class="text-xs font-black uppercase tracking-tight">${title}</span>`,
            html: `<span class="text-[11px] text-slate-500 leading-snug">${msg}</span>`,
            customClass: { popup: 'rounded-3xl border-none shadow-2xl' }
        });
    }
};
