import { authHandler, supabase } from './auth.js';
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
 * THE STORYTELLER BRAIN: Global Activity Monitor
 */
const brainInterceptor = {
    notifications: [],

    init() {
        this.setupUI();
        this.interceptFetch();
        this.loadFromDB(); // Load saved notifications on startup
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

    async loadFromDB() {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(25);

            if (error) throw error;

            if (data && data.length > 0) {
                this.notifications = data.map(n => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    time: new Date(n.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', minute: '2-digit' 
                    })
                }));
                this.render();

                // Show badge if there are unread notifications
                const hasUnread = data.some(n => !n.is_read);
                if (hasUnread) {
                    document.getElementById('noti-badge')?.classList.remove('hidden');
                }
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    },

    interceptFetch() {
        const originalFetch = window.fetch;
        let _intercepting = false;

        window.fetch = async (...args) => {
            const url = args[0].toString();
            const method = args[1]?.method?.toUpperCase() || 'GET';

            const isInternal = url.includes('audit_logs') || 
                               url.includes('rpc') || 
                               url.includes('/auth/v1/user') ||
                               url.includes('notifications'); // Prevent recursion
            
            if (isInternal || _intercepting) {
                return originalFetch(...args);
            }

            _intercepting = true;
            const response = await originalFetch(...args);
            _intercepting = false;

            // Handle Successful Data Changes & Logins
            if (response.ok) {
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const userName = document.getElementById('user-full-name')?.innerText || "An officer";
                let sentence = "";
                let category = "Activity";

                // LOGIN DETECTION
                if (url.includes('/auth/v1/token') && method === 'POST') {
                    sentence = `${userName} authenticated into the portal at ${time}`;
                    category = "System";
                }
                // DATA CHANGES
                else if (['POST', 'PATCH', 'DELETE'].includes(method)) {
                    if (url.includes('finance')) {
                        sentence = `${userName} added a new payment record at ${time}`;
                        category = "Finance";
                    } 
                    else if (url.includes('attendance')) {
                        sentence = `${userName} updated attendance at ${time}`;
                        category = "Attendance";
                    }
                    else if (url.includes('students')) {
                        const action = method === 'DELETE' ? 'removed a student' : 'registered a new student';
                        sentence = `${userName} ${action} at ${time}`;
                        category = "Registry";
                    }
                }

                if (sentence) {
                    requestAnimationFrame(() => this.push(sentence, category));
                }
            }

            return response;
        };
    },

    async push(message, title) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const entry = { id: Date.now(), title, message, time };

        // Save to Supabase
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('notifications').insert({
                    user_id: user.id,
                    title,
                    message
                });
            }
        } catch (err) {
            console.error('Failed to save notification:', err);
        }

        // Update in-memory list
        this.notifications.unshift(entry);
        if (this.notifications.length > 25) this.notifications.pop();
        
        this.render();
        this.toast(title, message);
        
        const badge = document.getElementById('noti-badge');
        if (badge) badge.classList.remove('hidden');
    },

    render() {
        const listHTML = this.notifications.map(n => `
            <div class="flex gap-3 px-6 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors animate-in slide-in-from-right-2">
                <div class="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center flex-shrink-0 text-blue-600 font-black text-[10px]">
                    ${n.title.substring(0,2).toUpperCase()}
                </div>
                <div class="flex-1">
                    <p class="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">${n.title}</p>
                    <p class="text-[11px] text-slate-700 font-medium leading-tight">${n.message}</p>
                    <p class="text-[9px] text-slate-300 mt-2 font-bold uppercase tracking-widest">${n.time}</p>
                </div>
            </div>
        `).join('');

        // Update Header Dropdown
        const list = document.getElementById('noti-list');
        if (list) list.innerHTML = listHTML;

        // Update Dashboard Live Monitor (audit-log-list)
        const dashboardFeed = document.getElementById('audit-log-list');
        if (dashboardFeed && this.notifications.length > 0) {
            dashboardFeed.innerHTML = listHTML;
        }
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

/**
 * UTILITY: ALERT SYSTEM
 */
window.showAlert = function(message) {
    if (window.Swal) {
        Swal.fire({
            icon: 'warning',
            title: message,
            confirmButtonText: 'OK',
            customClass: { popup: 'rounded-3xl border-none shadow-2xl' }
        });
    } else {
        alert(message);
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

    document.getElementById('btn-login-exec')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value;
        const pass = document.getElementById('login-password')?.value;
        if (!email || !pass) return window.showAlert("Please enter email and password");

        const { data, error } = await authHandler.signIn(email, pass);
        if (error) {
            logAction('LOGIN_FAILED', `Attempted email: ${email}`);
            window.showAlert(error.message);
        } else {
            await logAction('LOGIN_SUCCESS', `User ${email} logged in.`);
            window.location.reload();
        }
    });

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
    if (window.location.hash !== `#${sectionId}`) {
        window.history.pushState(null, null, `#${sectionId}`);
    }

    document.querySelectorAll('.module-container, section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-in', 'fade-in', 'slide-in-from-bottom-2');
    });

    const target = document.getElementById(`mod-${sectionId}`) || document.getElementById(`section-${sectionId}`);
    
    if (!target) {
        console.warn(`showSection fallback: ${sectionId}`);
        if (sectionId !== 'dashboard') window.showSection('dashboard');
        return;
    }

    target.classList.remove('hidden');
    requestAnimationFrame(() => {
        target.classList.add('animate-in', 'fade-in', 'slide-in-from-bottom-2', 'duration-500');
    });

    logAction('NAVIGATE', `Viewed ${sectionId} section`);

    switch(sectionId) {
        case 'dashboard': dashboardModule.init(); break;
        case 'students': studentModule.init(); break;
        case 'events': eventsModule.render(); break;
        case 'attendance': attendanceModule.render(); break;
        case 'finance': financeModule.render(); break;
    }

    const title = document.getElementById('current-page-title');
    if (title) title.innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    updateNavUI(sectionId);
};

window.addEventListener('popstate', () => {
    const sectionId = window.location.hash.replace('#', '') || 'dashboard';
    window.showSection(sectionId);
});

function updateNavUI(sectionId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        const clickAttr = btn.getAttribute('onclick') || "";
        const hrefAttr = btn.getAttribute('href') || "";
        const isActive = clickAttr.includes(`'${sectionId}'`) || hrefAttr === `#${sectionId}`;
        btn.classList.toggle('active', isActive);
    });
}
