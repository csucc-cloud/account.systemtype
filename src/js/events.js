import { supabase } from './auth.js';
import { AuditLogger } from './audit-logger.js';

export const eventsModule = {
    state: {
        events: [],
        filteredEvents: [],
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all',
        isLoading: false
    },

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

    notify(msg, type) {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-8 right-8 px-8 py-4 rounded-[2rem] text-white text-[10px] font-black uppercase tracking-[0.2em] z-[1000] shadow-2xl animate-in slide-in-from-bottom-10 duration-500 ${type === 'success' ? 'bg-[#000080]' : 'bg-red-500'}`;
        toast.innerHTML = `<div class="flex items-center gap-3"><i data-lucide="${type === 'success' ? 'check-circle' : 'alert-triangle'}" class="w-4 h-4"></i>${msg}</div>`;
        document.body.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

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
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">System Overview</span>
                        </div>
                        <h1 class="text-5xl font-[1000] text-slate-900 tracking-tighter italic">EVENTS<span class="text-[#000080] text-stroke-thin">LOG</span></h1>
                    </div>

                    <div class="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        <div class="relative flex-1 min-w-[300px]">
                            <i data-lucide="search" class="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"></i>
                            <input type="text" id="ev-search" placeholder="Search events..." 
                                class="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-[2rem] text-sm shadow-sm focus:ring-4 focus:ring-blue-50 transition-all outline-none font-medium">
                        </div>
                        
                        ${(this.state.userRole === 'super_admin' || this.state.userRole === 'admin') ? `
                            <button id="btn-add-event" class="px-8 py-5 bg-[#000080] text-white rounded-[2rem] text-xs font-black uppercase tracking-widest hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3">
                                <i data-lucide="plus-square" class="w-5 h-5 text-blue-300"></i> Create Event
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-100 pb-8">
                    <div class="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-[1.5rem] w-full md:w-auto">
                        <button data-filter="all" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white shadow-sm text-[#000080]">All</button>
                        <button data-filter="active" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400">Active</button>
                        <button data-filter="completed" class="filter-tab flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400">Completed</button>
                    </div>
                    <div id="event-stats" class="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Syncing Records...</div>
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10"></div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[500] flex items-center justify-center p-4">
                <div class="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                    <div class="p-12 space-y-10">
                        <div class="flex justify-between items-start">
                            <h3 class="text-4xl font-[1000] text-slate-900 tracking-tighter">EVENT<br>DETAILS</h3>
                            <button id="close-ev-modal" class="p-4 bg-slate-50 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-3xl transition-all">
                                <i data-lucide="x" class="w-6 h-6"></i>
                            </button>
                        </div>

                        <div class="space-y-6">
                            <input type="text" id="new-ev-name" placeholder="Event Name" class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                            <textarea id="new-ev-desc" rows="3" placeholder="Description" class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-medium focus:bg-white focus:border-blue-100 outline-none transition-all resize-none"></textarea>
                            <div class="grid grid-cols-2 gap-4">
                                <input type="date" id="new-ev-date" class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                                <input type="time" id="new-ev-start" class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-sm font-bold focus:bg-white focus:border-blue-100 outline-none transition-all">
                            </div>
                        </div>

                        <button id="save-ev-btn" class="w-full py-6 bg-[#000080] text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">
                            Confirm & Save
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.initEventListeners();
        await this.fetchEvents();
        this.renderGrid();
    },

    renderGrid() {
        const grid = document.getElementById('events-grid');
        const stats = document.getElementById('event-stats');
        if (!grid) return;

        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center font-black text-slate-300 uppercase tracking-widest text-xs">No Records Found</div>`;
            if (stats) stats.innerText = "0 RECORDS";
            return;
        }

        if (stats) stats.innerText = `${this.state.filteredEvents.length} RECORDS FOUND`;

        grid.innerHTML = this.state.filteredEvents.map((ev, index) => {
            const isActive = ev.status === 'active';
            const statusTheme = isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400';

            return `
                <div class="group bg-white border border-slate-100 rounded-[3.5rem] p-10 shadow-sm hover:shadow-2xl transition-all animate-in slide-in-from-bottom-10 duration-700" style="animation-delay: ${index * 100}ms">
                    <div class="flex justify-between items-start mb-10">
                        <div class="px-5 py-2 rounded-2xl ${statusTheme} text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-current ${isActive ? 'animate-ping' : ''}"></span>
                            ${ev.status}
                        </div>
                        <i data-lucide="more-horizontal" class="text-slate-200 w-5 h-5"></i>
                    </div>
                    
                    <div class="space-y-4 mb-10">
                        <h3 class="text-3xl font-[1000] text-slate-900 leading-[0.9] tracking-tighter group-hover:text-[#000080] transition-colors uppercase">${ev.event_name}</h3>
                        <p class="text-sm text-slate-400 font-medium line-clamp-2">${ev.description || 'No description provided.'}</p>
                        
                        <div class="flex items-center gap-4 pt-4">
                            <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                                <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                                <span class="text-[10px] font-black text-slate-500 uppercase">${new Date(ev.event_date).toDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="pt-8 border-t border-slate-50">
                        ${isActive ? `
                            <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${ev.id}')" 
                                class="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-[#000080] transition-all shadow-xl shadow-slate-900/20">
                                Manage Attendance
                            </button>` : `
                            <div class="w-full py-5 bg-slate-50 text-slate-300 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-center">
                                View Logs
                            </div>`}
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        const searchInput = document.getElementById('ev-search');
        const filterTabs = document.querySelectorAll('.filter-tab');
        const modal = document.getElementById('modal-event');

        if (searchInput) {
            searchInput.oninput = (e) => {
                this.state.searchTerm = e.target.value;
                this.applyFilters();
                this.renderGrid();
            };
        }

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

        const openBtn = document.getElementById('btn-add-event');
        if (openBtn) openBtn.onclick = () => modal.classList.remove('hidden');
        const closeBtn = document.getElementById('close-ev-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    }
};
