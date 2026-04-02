import { supabase } from './auth.js';

/**
 * EVENTS & ATTENDANCE CORE MODULE
 * Features: Auto-Status, Real-time Search, Category Filtering, 
 * Advanced Modals, and Attendance Integration.
 */
export const eventsModule = {
    // --- STATE MANAGEMENT ---
    state: {
        events: [],
        filteredEvents: [],
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all' // all, upcoming, active, completed
    },

    // --- DATABASE LOGIC ---
    async fetchEvents() {
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
            this.notify("Critical: Could not sync with database.", "error");
            console.error("DB_FETCH_ERROR:", error.message);
            return false;
        }
    },

    async createEvent(name, date) {
        try {
            const { error } = await supabase.from('events').insert([{ 
                event_name: name, 
                event_date: date, 
                organization_id: this.state.userOrgId 
            }]);

            if (error) throw error;
            this.notify("Operation Deployed Successfully", "success");
            await this.fetchEvents();
            this.renderGrid();
            return true;
        } catch (error) {
            this.notify(error.message, "error");
            return false;
        }
    },

    // --- FILTER & SEARCH LOGIC ---
    applyFilters() {
        let results = [...this.state.events];

        // 1. Search Filter
        if (this.state.searchTerm) {
            results = results.filter(ev => 
                ev.event_name.toLowerCase().includes(this.state.searchTerm.toLowerCase())
            );
        }

        // 2. Tab Filter
        if (this.state.currentFilter !== 'all') {
            results = results.filter(ev => ev.status === this.state.currentFilter);
        }

        this.state.filteredEvents = results;
    },

    // --- UI HELPERS ---
    notify(msg, type) {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest z-[1000] animate-in slide-in-from-right duration-300 ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // --- MAIN RENDERER ---
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        // Fetch User Context
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user?.id)
            .single();

        this.state.userRole = profile?.role || 'staff';
        this.state.userOrgId = profile?.organization_id;

        container.innerHTML = `
            <div class="p-4 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-1000">
                
                <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <h1 class="text-4xl font-[1000] text-slate-900 tracking-tight leading-none">Command Center</h1>
                        <div class="flex items-center gap-3 mt-3">
                            <span class="px-3 py-1 bg-blue-50 text-[#000080] text-[10px] font-black uppercase rounded-full border border-blue-100">
                                ${this.state.userRole.replace('_', ' ')}
                            </span>
                            <span id="event-count" class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Loading Records...
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 w-full lg:w-auto">
                        <div class="relative flex-1 lg:w-64">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"></i>
                            <input type="text" id="ev-search" placeholder="Search operations..." 
                                class="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-blue-50 transition-all outline-none">
                        </div>
                        
                        ${(this.state.userRole === 'super_admin' || this.state.userRole === 'admin') ? `
                            <button id="btn-add-event" class="px-6 py-3 bg-[#000080] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:shadow-2xl active:scale-95 transition-all flex items-center gap-2 group">
                                <i data-lucide="plus" class="w-4 h-4 group-hover:rotate-90 transition-transform"></i> New Operation
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-2 p-1 bg-slate-100/50 w-fit rounded-2xl border border-slate-100">
                    <button data-filter="all" class="filter-tab px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white shadow-sm text-[#000080]">All</button>
                    <button data-filter="active" class="filter-tab px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Active</button>
                    <button data-filter="upcoming" class="filter-tab px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Upcoming</button>
                    <button data-filter="completed" class="filter-tab px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600">Archived</button>
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    </div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto">
                <div class="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-300 relative">
                    <button id="close-ev-modal-top" class="absolute right-8 top-8 p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-slate-300"></i>
                    </button>

                    <div class="mb-8">
                        <h3 class="text-3xl font-black text-slate-900 tracking-tight">Deploy Event</h3>
                        <p class="text-sm text-slate-400 mt-1 font-medium">Automatic status assignment based on scheduling.</p>
                    </div>

                    <div class="space-y-6">
                        <div class="group">
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1 group-focus-within:text-[#000080] transition-colors">Operation Designation</label>
                            <div class="relative">
                                <i data-lucide="tag" class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"></i>
                                <input type="text" id="new-ev-name" placeholder="Name of activity" 
                                    class="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-3xl text-sm focus:bg-white focus:border-blue-100 outline-none transition-all">
                            </div>
                        </div>

                        <div class="group">
                            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1 group-focus-within:text-[#000080] transition-colors">Target Schedule</label>
                            <div class="relative">
                                <i data-lucide="calendar-days" class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"></i>
                                <input type="date" id="new-ev-date" 
                                    class="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-transparent rounded-3xl text-sm focus:bg-white focus:border-blue-100 outline-none transition-all">
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row gap-4 pt-6">
                            <button id="close-ev-modal" class="flex-1 py-5 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
                            <button id="save-ev-btn" class="flex-1 py-5 bg-[#000080] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all">
                                Deploy Operation
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

    // --- GRID RENDERER ---
    renderGrid() {
        const grid = document.getElementById('events-grid');
        const countSpan = document.getElementById('event-count');
        if (!grid) return;

        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-32 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-700">
                    <div class="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                        <i data-lucide="layers-2" class="w-10 h-10 text-slate-200"></i>
                    </div>
                    <h3 class="text-xl font-black text-slate-800">No Operations Found</h3>
                    <p class="text-slate-400 text-xs font-medium max-w-[200px] mt-2">Adjust your search or filters to see more results.</p>
                </div>`;
            if (countSpan) countSpan.innerText = "0 Records";
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (countSpan) countSpan.innerText = `${this.state.filteredEvents.length} Records Found`;

        grid.innerHTML = this.state.filteredEvents.map((ev, index) => {
            const isActive = ev.status === 'active';
            const isCompleted = ev.status === 'completed';
            const statusColor = isActive ? 'text-emerald-500 bg-emerald-50' : isCompleted ? 'text-slate-400 bg-slate-50' : 'text-blue-500 bg-blue-50';

            return `
                <div class="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] transition-all group relative animate-in slide-in-from-bottom-4 duration-500" style="animation-delay: ${index * 50}ms">
                    
                    <div class="flex justify-between items-start mb-8">
                        <div class="px-4 py-1.5 rounded-full ${statusColor} text-[9px] font-[900] uppercase tracking-widest flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                            ${ev.status}
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button class="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>

                    <div class="mb-10">
                        <h3 class="text-2xl font-black text-slate-800 leading-tight group-hover:text-[#000080] transition-colors">${ev.event_name}</h3>
                        <div class="flex items-center gap-2 mt-3 text-slate-400">
                            <i data-lucide="calendar" class="w-4 h-4"></i>
                            <span class="text-[11px] font-bold uppercase tracking-tight">${new Date(ev.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>

                    <div class="pt-8 border-t border-slate-50">
                        ${isActive ? `
                            <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${ev.id}')" 
                                    class="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#000080] shadow-lg shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-3">
                                <i data-lucide="fingerprint" class="w-4 h-4"></i> Initialize Attendance
                            </button>
                        ` : `
                            <div class="w-full py-4 bg-slate-50 rounded-2xl flex items-center justify-center gap-2">
                                <i data-lucide="${isCompleted ? 'archive' : 'clock'}" class="w-4 h-4 text-slate-300"></i>
                                <span class="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    ${isCompleted ? 'Operation Concluded' : 'Schedule Standby'}
                                </span>
                            </div>
                        `}
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    // --- EVENT LISTENERS ---
    initEventListeners() {
        const searchInput = document.getElementById('ev-search');
        const filterTabs = document.querySelectorAll('.filter-tab');
        const modal = document.getElementById('modal-event');
        const saveBtn = document.getElementById('save-ev-btn');

        // Search Listener
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.state.searchTerm = e.target.value;
                this.applyFilters();
                this.renderGrid();
            };
        }

        // Tab Listeners
        filterTabs.forEach(tab => {
            tab.onclick = () => {
                // UI Toggle
                filterTabs.forEach(t => t.classList.replace('bg-white', 'text-slate-400'));
                filterTabs.forEach(t => t.classList.remove('shadow-sm', 'text-[#000080]'));
                
                tab.classList.replace('text-slate-400', 'text-[#000080]');
                tab.classList.add('bg-white', 'shadow-sm');

                this.state.currentFilter = tab.dataset.filter;
                this.applyFilters();
                this.renderGrid();
            };
        });

        // Modal Listeners
        if (document.getElementById('btn-add-event')) {
            document.getElementById('btn-add-event').onclick = () => {
                modal.classList.remove('hidden');
                document.getElementById('new-ev-name').focus();
            };
        }

        const closeModals = ['close-ev-modal', 'close-ev-modal-top'];
        closeModals.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.onclick = () => modal.classList.add('hidden');
        });

        // Save Logic
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const nameInput = document.getElementById('new-ev-name');
                const dateInput = document.getElementById('new-ev-date');
                
                if (!nameInput.value || !dateInput.value) {
                    return this.notify("Please fill in all tactical data.", "error");
                }

                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="flex items-center gap-2"><div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processing...</span>`;

                const success = await this.createEvent(nameInput.value, dateInput.value);
                
                saveBtn.disabled = false;
                saveBtn.innerText = "Deploy Operation";

                if (success) {
                    modal.classList.add('hidden');
                    nameInput.value = '';
                    dateInput.value = '';
                }
            };
        }

        // Handle Escape Key for Modal
        window.onkeydown = (e) => {
            if (e.key === "Escape" && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        };
    }
};
