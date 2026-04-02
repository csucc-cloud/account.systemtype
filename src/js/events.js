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
            this.notify("Error: " + error.message, "error");
            return false;
        } finally {
            this.state.isLoading = false;
        }
    },

    async deployOperation(eventData) {
        try {
            const { data, error } = await supabase
                .from('events')
                .insert([eventData])
                .select()
                .single();

            if (error) throw error;
            
            await AuditLogger.log('CREATE_EVENT', data.id, eventData, null);

            this.notify("Event Created", "success");
            await this.fetchEvents();
            this.renderGrid();
            return true;
        } catch (error) {
            this.notify("Failed: " + error.message, "error");
            return false;
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
        const id = 'toast-' + Math.random().toString(36).substr(2, 9);
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `fixed bottom-8 right-8 px-6 py-3 rounded-2xl text-white text-[11px] font-bold uppercase tracking-wider z-[1000] shadow-xl animate-in slide-in-from-bottom-5 duration-300 ${type === 'success' ? 'bg-slate-900' : 'bg-red-600'}`;
        toast.innerHTML = `<div class="flex items-center gap-2">${msg}</div>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user?.id).single();
        
        this.state.userRole = profile?.role || 'staff';
        this.state.userOrgId = profile?.organization_id;

        container.innerHTML = `
            <div class="p-6 md:p-12 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
                <div class="flex flex-col md:flex-row justify-between items-center gap-6">
                    <h1 class="text-4xl font-black text-slate-900 tracking-tight">Events</h1>

                    <div class="flex items-center gap-4 w-full md:w-auto">
                        <div class="relative flex-1 md:w-80">
                            <i data-lucide="search" class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="ev-search" placeholder="Search..." 
                                class="w-full pl-12 pr-5 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all">
                        </div>
                        
                        ${(this.state.userRole === 'super_admin' || this.state.userRole === 'admin') ? `
                            <button id="btn-add-event" class="px-6 py-4 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-black transition-all flex items-center gap-2">
                                <i data-lucide="plus" class="w-4 h-4"></i> New Event
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-100 pb-6">
                    <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button data-filter="all" class="filter-tab px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all bg-white shadow-sm text-slate-900">All</button>
                        <button data-filter="active" class="filter-tab px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-slate-500">Live</button>
                        <button data-filter="upcoming" class="filter-tab px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-slate-500">Upcoming</button>
                        <button data-filter="completed" class="filter-tab px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all text-slate-500">Completed</button>
                    </div>
                    <div id="event-stats" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"></div>
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[500] flex items-center justify-center p-4">
                <div class="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
                    <div class="p-10 space-y-8">
                        <div class="flex justify-between items-center">
                            <h3 class="text-2xl font-bold text-slate-900">Create Event</h3>
                            <button id="close-ev-modal" class="text-slate-400 hover:text-slate-900 transition-colors">
                                <i data-lucide="x" class="w-6 h-6"></i>
                            </button>
                        </div>

                        <div class="space-y-4">
                            <input type="text" id="new-ev-name" placeholder="Event Name" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-slate-100 outline-none transition-all">
                            <textarea id="new-ev-desc" rows="3" placeholder="Description" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-slate-100 outline-none transition-all resize-none"></textarea>
                            
                            <div class="grid grid-cols-1 gap-4">
                                <input type="date" id="new-ev-date" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-slate-100 outline-none transition-all">
                                <div class="grid grid-cols-2 gap-4">
                                    <input type="time" id="new-ev-start" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-slate-100 outline-none transition-all">
                                    <input type="time" id="new-ev-end" class="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-slate-100 outline-none transition-all">
                                </div>
                            </div>
                        </div>

                        <button id="save-ev-btn" class="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all">
                            Save Event
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
            grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 text-sm font-medium">No results found.</div>`;
            if (stats) stats.innerText = "0 TOTAL";
            return;
        }

        if (stats) stats.innerText = `${this.state.filteredEvents.length} TOTAL`;

        grid.innerHTML = this.state.filteredEvents.map((ev) => {
            const isActive = ev.status === 'active';
            const statusColor = isActive ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50';

            return `
                <div class="bg-white border border-slate-100 rounded-3xl p-8 hover:shadow-lg transition-all">
                    <div class="flex justify-between items-start mb-6">
                        <span class="px-3 py-1 rounded-lg ${statusColor} text-[9px] font-bold uppercase tracking-wider">
                            ${ev.status}
                        </span>
                    </div>
                    <div class="space-y-3">
                        <h3 class="text-xl font-bold text-slate-900 line-clamp-1">${ev.event_name}</h3>
                        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${ev.description || 'No description provided.'}</p>
                        
                        <div class="flex items-center gap-4 pt-2">
                            <div class="flex items-center gap-1.5 text-slate-400">
                                <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                                <span class="text-[10px] font-bold uppercase">${new Date(ev.event_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-8 pt-6 border-t border-slate-50">
                        ${isActive ? `
                            <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${ev.id}')" 
                                class="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all">
                                Attendance
                            </button>` : `
                            <div class="w-full py-3 bg-slate-50 text-slate-300 rounded-xl text-[10px] font-bold uppercase text-center tracking-widest">
                                Inactive
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
        const saveBtn = document.getElementById('save-ev-btn');

        if (searchInput) {
            searchInput.oninput = (e) => {
                this.state.searchTerm = e.target.value;
                this.applyFilters();
                this.renderGrid();
            };
        }

        filterTabs.forEach(tab => {
            tab.onclick = () => {
                filterTabs.forEach(t => t.classList.remove('bg-white', 'shadow-sm', 'text-slate-900'));
                filterTabs.forEach(t => t.classList.add('text-slate-500'));
                tab.classList.remove('text-slate-500');
                tab.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
                this.state.currentFilter = tab.dataset.filter;
                this.applyFilters();
                this.renderGrid();
            };
        });

        const openBtn = document.getElementById('btn-add-event');
        if (openBtn) openBtn.onclick = () => modal.classList.remove('hidden');
        const closeBtn = document.getElementById('close-ev-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

        if (saveBtn) {
            saveBtn.onclick = async () => {
                const name = document.getElementById('new-ev-name').value;
                const date = document.getElementById('new-ev-date').value;
                const desc = document.getElementById('new-ev-desc').value;
                const start = document.getElementById('new-ev-start').value;
                const end = document.getElementById('new-ev-end').value;

                if (!name || !date) return this.notify("Required: Name & Date", "error");

                saveBtn.disabled = true;
                saveBtn.innerText = "SAVING...";

                const success = await this.deployOperation({
                    event_name: name,
                    event_date: date,
                    description: desc,
                    start_time: start || null,
                    end_time: end || null,
                    organization_id: this.state.userOrgId
                });

                saveBtn.disabled = false;
                saveBtn.innerText = "SAVE EVENT";

                if (success) {
                    modal.classList.add('hidden');
                    ['new-ev-name', 'new-ev-date', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => {
                        document.getElementById(id).value = '';
                    });
                }
            };
        }
    }
};
