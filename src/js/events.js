import { supabase } from './auth.js';
import { AuditLogger } from './utils/audit-logger.js'; // Integrated AuditLogger Utility

/**
 * ADVANCED EVENTS MANAGEMENT SYSTEM v2.0
 * Features: Time-range tracking, Rich Descriptions, 
 * Animated Modals, Search/Filter State, and Real-time UI.
 */
export const eventsModule = {
    // --- MODULE STATE ---
    state: {
        events: [],
        filteredEvents: [],
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all',
        isLoading: false
    },

    // --- DATABASE LAYER ---
    async fetchEvents() {
        this.state.isLoading = true;
        try {
            const { data, error } = await supabase
                .from('events_with_status')
                .select('*')
                .order('event_date', { ascending: false });
            
            if (error) throw error;
            this.state.events = data || [];
            this.applyFilters();
            return true;
        } catch (error) {
            this.notify("Sync Error: " + error.message, "error");
            return false;
        } finally {
            this.state.isLoading = false;
        }
    },

    async deployOperation(eventData) {
        try {
            // Updated to select the created record for the Audit Log target_id
            const { data, error } = await supabase
                .from('events')
                .insert([eventData])
                .select()
                .single();

            if (error) throw error;
            
            // --- INTEGRATED AUDIT LOGGING ---
            await AuditLogger.log(
                'DEPLOY_EVENT', 
                data.id, 
                eventData, 
                null
            );

            this.notify("Operation Deployed Successfully", "success");
            await this.fetchEvents();
            this.renderGrid();
            return true;
        } catch (error) {
            this.notify("Deployment Failed: " + error.message, "error");
            return false;
        }
    },

    // --- FILTER ENGINE ---
    applyFilters() {
        let filtered = [...this.state.events];

        if (this.state.searchTerm) {
            const term = this.state.searchTerm.toLowerCase();
            filtered = filtered.filter(ev => 
                ev.event_name.toLowerCase().includes(term) || 
                (ev.description && ev.description.toLowerCase().includes(term))
            );
        }

        if (this.state.currentFilter !== 'all') {
            filtered = filtered.filter(ev => ev.status === this.state.currentFilter);
        }

        this.state.filteredEvents = filtered;
    },

    // --- UI COMPONENTS ---
    notify(msg, type) {
        const id = 'toast-' + Math.random().toString(36).substr(2, 9);
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `fixed bottom-8 right-8 px-8 py-4 rounded-[2rem] text-white text-[10px] font-black uppercase tracking-[0.2em] z-[1000] shadow-2xl animate-in slide-in-from-bottom-10 duration-500 ${type === 'success' ? 'bg-[#000080]' : 'bg-red-500'}`;
        toast.innerHTML = `
            <div class="flex items-center gap-3">
                <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-triangle'}" class="w-4 h-4"></i>
                ${msg}
            </div>
        `;
        document.body.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    // --- MAIN RENDERER ---
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        // Initialize Identity
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user?.id).single();
        
        this.state.userRole = profile?.role || 'staff';
        this.state.userOrgId = profile?.organization_id;

        container.innerHTML = `
            <div class="p-6 md:p-12 max-w-[1600px] mx-auto space-y-12 animate-in fade-in duration-1000">
                
                <div class="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                    <div class="space-y-2">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-1 bg-[#000080] rounded-full"></div>
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Module</span>
                        </div>
                        <h1 class="text-5xl font-[1000] text-slate-900 tracking-tighter italic">COMMAND<span class="text-[#000080] text-stroke-thin">CENTER</span></h1>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        <div class="relative flex-1 min-w-[300px]">
                            <i data-lucide="search" class="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"></i>
                            <input type="text" id="ev-search" placeholder="Filter by name or description..." 
                                class="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-[2rem] text-sm shadow-sm focus:ring-4 focus:ring-blue-50 transition-all outline-none font-medium">
                        </div>
                        
                        ${(this.state.userRole === 'super_admin' || this.state.userRole === 'admin') ? `
                            <button id="btn-add-event" class="px-8 py-5 bg-[#000080] text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3">
                                <i data-lucide="plus-square" class="w-5 h-5 text-blue-300"></i> Deploy New Operation
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-100 pb-8">
                    <div class="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-[1.5rem] w-full md:w-auto">
                        <button data-filter="all" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white shadow-sm text-[#000080]">All Logs</button>
                        <button data-filter="active" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Live</button>
                        <button data-filter="upcoming" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Slated</button>
                        <button data-filter="completed" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Archived</button>
                    </div>
                    <div id="event-stats" class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                        Syncing...
                    </div>
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
                    </div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
                <div class="bg-white rounded-[3.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
                    <div class="p-12 space-y-10">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-4xl font-[1000] text-slate-900 tracking-tighter">NEW<br>OPERATION</h3>
                                <p class="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Deployment Configuration</p>
                            </div>
                            <button id="close-ev-modal" class="p-4 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-3xl transition-all">
                                <i data-lucide="x" class="w-6 h-6"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operation Title</label>
                                    <input type="text" id="new-ev-name" placeholder="e.g., Strategic Seminar" 
                                        class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brief Description</label>
                                    <textarea id="new-ev-desc" rows="4" placeholder="Objectives and details..." 
                                        class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-medium focus:bg-white focus:border-blue-100 outline-none transition-all resize-none"></textarea>
                                </div>
                            </div>

                            <div class="space-y-6">
                                <div class="space-y-2">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deployment Date</label>
                                    <input type="date" id="new-ev-date" 
                                        class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                                        <input type="time" id="new-ev-start" 
                                            class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                                        <input type="time" id="new-ev-end" 
                                            class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                                    </div>
                                </div>

                                <div class="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                                    <p class="text-[9px] text-[#000080] font-black uppercase leading-relaxed">
                                        <i data-lucide="info" class="inline w-3 h-3 mr-1 mb-0.5"></i>
                                        System will automatically set status to 'Active' on the scheduled date.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="pt-6">
                            <button id="save-ev-btn" class="w-full py-6 bg-[#000080] text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-900/30 hover:scale-[1.02] active:scale-95 transition-all">
                                Confirm & Deploy Operation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initEventListeners();
        await this.fetchEvents();
        this.renderGrid();
    },

    // --- GRID LOGIC ---
    renderGrid() {
        const grid = document.getElementById('events-grid');
        const stats = document.getElementById('event-stats');
        if (!grid) return;

        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-40 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
                    <div class="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-8 border border-slate-100">
                        <i data-lucide="ghost" class="w-12 h-12 text-slate-200"></i>
                    </div>
                    <h3 class="text-2xl font-[1000] text-slate-800 tracking-tight">NO LOGS FOUND</h3>
                    <p class="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">System Database is empty or filtered</p>
                </div>`;
            if (stats) stats.innerText = "0 RECORDS FOUND";
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (stats) stats.innerText = `${this.state.filteredEvents.length} OPERATIONS RECORDED`;

        grid.innerHTML = this.state.filteredEvents.map((ev, index) => {
            const isActive = ev.status === 'active';
            const isCompleted = ev.status === 'completed';
            const statusTheme = isActive ? 'bg-emerald-50 text-emerald-600' : isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600';

            return `
                <div class="group bg-white border border-slate-100 rounded-[3.5rem] p-10 shadow-sm hover:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-bottom-10 duration-700" style="animation-delay: ${index * 100}ms">
                    <div class="flex justify-between items-start mb-10">
                        <div class="px-5 py-2 rounded-2xl ${statusTheme} text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-current ${isActive ? 'animate-ping' : ''}"></span>
                            ${ev.status}
                        </div>
                        <div class="flex items-center gap-2 text-slate-200">
                            <i data-lucide="activity" class="w-4 h-4"></i>
                        </div>
                    </div>

                    <div class="space-y-4 mb-10">
                        <h3 class="text-3xl font-[1000] text-slate-900 leading-[0.9] tracking-tighter group-hover:text-[#000080] transition-colors uppercase">
                            ${ev.event_name}
                        </h3>
                        <p class="text-sm text-slate-400 font-medium line-clamp-2 leading-relaxed">
                            ${ev.description || 'No strategic objectives defined for this operation.'}
                        </p>
                        
                        <div class="flex flex-wrap items-center gap-4 pt-4">
                            <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                                <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                                <span class="text-[10px] font-black text-slate-500 uppercase">${new Date(ev.event_date).toDateString()}</span>
                            </div>
                            ${ev.start_time ? `
                                <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                                    <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                                    <span class="text-[10px] font-black text-slate-500 uppercase">${ev.start_time.slice(0,5)} - ${ev.end_time?.slice(0,5) || '??'}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="pt-8 border-t border-slate-50 flex items-center justify-between">
                        ${isActive ? `
                            <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${ev.id}')" 
                                class="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-[#000080] active:scale-95 transition-all shadow-xl shadow-slate-900/20">
                                Open Attendance
                            </button>
                        ` : `
                            <div class="flex-1 py-5 bg-slate-50 text-slate-300 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-center">
                                ${isCompleted ? 'Log Archived' : 'Standby Mode'}
                            </div>
                        `}
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    // --- INTERACTION ENGINE ---
    initEventListeners() {
        const searchInput = document.getElementById('ev-search');
        const filterTabs = document.querySelectorAll('.filter-tab');
        const modal = document.getElementById('modal-event');
        const saveBtn = document.getElementById('save-ev-btn');

        // Search Input Logic
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.state.searchTerm = e.target.value;
                this.applyFilters();
                this.renderGrid();
            };
        }

        // Tab Switching Logic
        filterTabs.forEach(tab => {
            tab.onclick = () => {
                filterTabs.forEach(t => t.classList.remove('bg-white', 'shadow-sm', 'text-[#000080]'));
                filterTabs.forEach(t => t.classList.add('text-slate-400'));
                
                tab.classList.remove('text-slate-400');
                tab.classList.add('bg-white', 'shadow-sm', 'text-[#000080]');

                this.state.currentFilter = tab.dataset.filter;
                this.applyFilters();
                this.renderGrid();
            };
        });

        // Modal Controls
        const openBtn = document.getElementById('btn-add-event');
        if (openBtn) openBtn.onclick = () => modal.classList.remove('hidden');
        
        const closeBtn = document.getElementById('close-ev-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

        // Deployment Logic
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const name = document.getElementById('new-ev-name').value;
                const date = document.getElementById('new-ev-date').value;
                const desc = document.getElementById('new-ev-desc').value;
                const start = document.getElementById('new-ev-start').value;
                const end = document.getElementById('new-ev-end').value;

                if (!name || !date) return this.notify("Tactical Error: Name & Date required", "error");

                saveBtn.disabled = true;
                saveBtn.innerText = "PROCESSING DEPLOYMENT...";

                const success = await this.deployOperation({
                    event_name: name,
                    event_date: date,
                    description: desc,
                    start_time: start || null,
                    end_time: end || null,
                    organization_id: this.state.userOrgId
                });

                saveBtn.disabled = false;
                saveBtn.innerText = "CONFIRM & DEPLOY OPERATION";

                if (success) {
                    modal.classList.add('hidden');
                    // Reset fields
                    ['new-ev-name', 'new-ev-date', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => {
                        document.getElementById(id).value = '';
                    });
                }
            };
        }
    }
};
