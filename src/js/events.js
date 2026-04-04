import { supabase } from './auth.js';
import { AuditLogger } from './audit-logger.js';


export const eventsModule = {
    
    state: {
        events: [],
        filteredEvents: [],
        selectedEvent: null,
        attachments: [],
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all',
        isLoading: false,
        isStealthMode: false,
        isEditMode: false,
        stats: { total: 0, active: 0, standby: 0, completed: 0 }
    },
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        // Sync User Permissions
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles')
                .select('role, organization_id')
                .eq('id', user?.id)
                .single();

            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
        } catch (e) {
            console.error("Auth sync failed", e);
        }

        const theme = this.state.isStealthMode ? 'stealth-theme' : 'light-theme';
        container.innerHTML = this.getTemplate(theme);

        await this.fetchEvents();
        this.initEventListeners();
        
        // Global exposure for inline onclick handlers
        if (window.eventsModule === undefined) window.eventsModule = this;
    },

    async fetchEvents() {
        this.setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select(`*, event_inquiries (id)`)
                .order('start_time', { ascending: false });

            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                let computedStatus = ev.status;

                if (now < start) computedStatus = 'standby';
                else if (now >= start && now <= end) computedStatus = 'active';
                else if (now > end) computedStatus = 'completed';

                return { 
                    ...ev, 
                    status: computedStatus,
                    inquiryCount: ev.event_inquiries ? ev.event_inquiries.length : 0
                };
            });

            this.applyFilters();
            this.updateDashboardStats();
            this.renderGrid();
        } catch (error) {
            this.notify(error.message || "Data Retrieval Failed", "error");
        } finally {
            this.setLoading(false);
        }
    },

    async deployMission() {
        const name = document.getElementById('new-ev-name').value;
        const desc = document.getElementById('new-ev-desc').value;
        const start = document.getElementById('new-ev-start').value;
        const end = document.getElementById('new-ev-end').value;

        if (!name || !start || !end) return this.notify("Missing required information", "error");
        if (this.checkConflicts(start, end)) return this.notify("Schedule overlap detected", "error");

        try {
            const payload = {
                event_name: name,
                description: desc,
                start_time: start,
                end_time: end,
                organization_id: this.state.userOrgId
            };

            const action = this.state.isEditMode 
                ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id)
                : supabase.from('events').insert([{ ...payload, status: 'active' }]);

            const { error } = await action;
            if (error) throw error;

            this.notify(this.state.isEditMode ? "Mission Data Updated" : "New Mission Published", "success");
            this.closeModal('modal-event');
            await this.fetchEvents();
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    async deleteEvent(id) {
        if (!confirm("Execute deletion? This cannot be undone.")) return;
        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            this.notify("Event purged from records", "success");
            this.closeModal('modal-event-detail');
            await this.fetchEvents();
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    // ---------------------------------------------------------
    // 4. LOGIC & UTILITIES
    // ---------------------------------------------------------
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

    checkConflicts(start, end) {
        const s = new Date(start);
        const e = new Date(end);
        return this.state.events.some(ev => {
            if (this.state.selectedEvent && ev.id === this.state.selectedEvent.id) return false;
            return (s < new Date(ev.end_time) && e > new Date(ev.start_time));
        });
    },

    updateDashboardStats() {
        const stats = {
            all: this.state.events.length,
            active: this.state.events.filter(e => e.status === 'active').length,
            standby: this.state.events.filter(e => e.status === 'standby').length,
            completed: this.state.events.filter(e => e.status === 'completed').length
        };
        const statEl = document.getElementById('event-stats');
        if (statEl) statEl.innerText = `${stats.active} Active | ${stats.standby} Standby | ${stats.all} Total`;
    },

    setLoading(status) {
        this.state.isLoading = status;
        const grid = document.getElementById('events-grid');
        if (status && grid) grid.style.opacity = '0.5';
        else if (grid) grid.style.opacity = '1';
    },

    // ---------------------------------------------------------
    // 5. UI RENDERERS
    // ---------------------------------------------------------
    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;

        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-30 font-black uppercase tracking-[1em]">Empty Registry</div>`;
            return;
        }

        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const isActive = ev.status === 'active';
            const themeClass = this.state.isStealthMode ? 'bg-[#0f0f0f] border-white/5 text-white' : 'bg-white border-slate-100';
            
            return `
                <div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' 
                     class="${themeClass} cursor-pointer rounded-[2.5rem] p-8 group hover:shadow-2xl transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-4" 
                     style="animation-delay: ${i * 40}ms">
                    
                    <div class="flex justify-between items-start mb-6">
                        <div class="px-4 py-1.5 rounded-xl bg-slate-100/50 text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500' : 'text-slate-400'}">
                            ${ev.status}
                        </div>
                        <div class="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg">
                             <span class="text-[10px] font-black text-blue-600">${ev.inquiryCount}</span>
                             <i data-lucide="message-square" class="w-3 h-3 text-blue-600"></i>
                        </div>
                    </div>

                    <div class="space-y-3 mb-8">
                        <h3 class="text-2xl font-black italic tracking-tighter uppercase leading-none group-hover:text-[#000080] transition-colors line-clamp-1">${ev.event_name}</h3>
                        <p class="text-xs text-slate-400 font-medium line-clamp-2">${ev.description || 'Secure communication details only.'}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] font-black text-slate-300 uppercase">Commencement</span>
                            <span class="text-[10px] font-black uppercase">${new Date(ev.start_time).toLocaleDateString()}</span>
                        </div>
                        <div class="flex flex-col gap-1 items-end">
                            <span class="text-[8px] font-black text-slate-300 uppercase">Termination</span>
                            <span class="text-[10px] font-black uppercase">${new Date(ev.end_time).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        return `
            <div class="${theme} min-h-screen transition-all duration-700 font-sans p-4 md:p-10">
                <style>
                    .stealth-theme { background: #050505; color: #f1f5f9; }
                    .light-theme { background: #f8fafc; color: #0f172a; }
                    .text-stroke-custom { -webkit-text-stroke: 1px #000080; color: transparent; }
                    .input-campus { background: ${this.state.isStealthMode ? '#111' : '#fff'}; border: 2px solid ${this.state.isStealthMode ? '#333' : '#e2e8f0'}; }
                    .input-campus:focus { border-color: #000080; }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #000080; border-radius: 10px; }
                </style>

                <div class="max-w-[1600px] mx-auto space-y-10">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div class="space-y-4">
                            <div class="flex items-center gap-4">
                                <span class="h-1 w-16 bg-[#000080] rounded-full"></span>
                                <p class="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">Command Center</p>
                            </div>
                            <h1 class="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
                                Mission<span class="text-stroke-custom opacity-70">Control</span>
                            </h1>
                        </div>

                        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            <div class="relative flex-grow max-w-md">
                                <i data-lucide="search" class="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
                                <input type="text" id="ev-search" value="${this.state.searchTerm}" placeholder="Query registry..." 
                                    class="w-full pl-14 pr-6 py-5 rounded-[2rem] input-campus text-sm font-bold outline-none">
                            </div>
                            <button id="stealth-toggle" class="p-5 rounded-full input-campus hover:rotate-12 transition-all">
                                <i data-lucide="${this.state.isStealthMode ? 'sun' : 'moon'}" class="w-5 h-5 text-[#000080]"></i>
                            </button>
                            ${(this.state.userRole.includes('admin')) ? `
                                <button id="btn-add-event" class="px-10 py-5 bg-[#000080] text-white rounded-[2rem] text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3">
                                    <i data-lucide="plus" class="w-5 h-5"></i> New Entry
                                </button>` : ''}
                        </div>
                    </div>

                    <div class="flex justify-between items-center py-4 border-b border-slate-200/60">
                        <div class="flex p-1.5 bg-slate-200/40 rounded-[1.8rem] overflow-x-auto">
                            ${['all', 'active', 'standby', 'completed'].map(f => `
                                <button data-filter="${f}" class="filter-tab px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${this.state.currentFilter === f ? 'bg-white text-[#000080] shadow-md' : 'text-slate-500'}">${f}</button>
                            `).join('')}
                        </div>
                        <div id="event-stats" class="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Synchronizing...</div>
                    </div>

                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8"></div>
                </div>

                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" onclick="eventsModule.closeModal('modal-event')"></div>
                    <div class="relative bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div class="px-8 py-6 border-b flex justify-between items-center">
                            <h2 id="modal-title" class="text-2xl font-black italic uppercase">New<span class="text-[#000080]">Mission</span></h2>
                            <button id="close-ev-modal" class="p-2 rounded-full hover:bg-slate-100"><i data-lucide="x"></i></button>
                        </div>
                        <div class="overflow-y-auto p-8 custom-scrollbar">
                            <div class="grid lg:grid-cols-2 gap-10">
                                <div class="space-y-6">
                                    <input type="text" id="new-ev-name" placeholder="Mission Name" class="w-full p-6 bg-slate-50 rounded-2xl font-black border-none focus:ring-2 focus:ring-blue-100">
                                    <textarea id="new-ev-desc" rows="5" placeholder="Strategic Briefing..." class="w-full p-6 bg-slate-50 rounded-2xl font-bold border-none focus:ring-2 focus:ring-blue-100"></textarea>
                                </div>
                                <div class="space-y-6">
                                    <input type="datetime-local" id="new-ev-start" class="w-full p-5 bg-slate-50 rounded-2xl font-black">
                                    <input type="datetime-local" id="new-ev-end" class="w-full p-5 bg-slate-50 rounded-2xl font-black">
                                    <div id="conflict-engine" class="p-5 bg-emerald-50 rounded-2xl flex items-center gap-3">
                                        <i data-lucide="shield-check" class="text-emerald-500"></i>
                                        <p id="conflict-msg" class="text-[10px] font-black uppercase text-emerald-700">Vector Clear</p>
                                    </div>
                                    <button id="save-ev-btn" class="w-full py-6 bg-[#000080] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Deploy Signal</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md"></div>
                    <div class="relative bg-white rounded-[3rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div class="p-10 overflow-y-auto custom-scrollbar space-y-8">
                            <div class="flex justify-between">
                                <h2 id="detail-title" class="text-4xl font-black italic uppercase"></h2>
                                <button onclick="document.getElementById('modal-event-detail').classList.add('hidden')"><i data-lucide="x" class="w-8 h-8 text-slate-300"></i></button>
                            </div>
                            <div class="grid md:grid-cols-2 gap-8">
                                <div class="space-y-4">
                                    <p id="detail-desc" class="text-sm text-slate-500 leading-relaxed"></p>
                                    <div id="qr-container" class="hidden p-6 bg-slate-50 rounded-3xl text-center">
                                        <div id="qr-code-img" class="mb-4"></div>
                                        <p class="text-[9px] font-black uppercase text-slate-400">Secure Inquiry Link</p>
                                    </div>
                                    <button id="btn-generate-qr" class="w-full py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Generate Access Key</button>
                                </div>
                                <div class="space-y-4">
                                    <h4 class="text-[10px] font-black uppercase text-[#000080]">Inquiry Feed</h4>
                                    <div id="inquiry-list" class="space-y-2 h-64 overflow-y-auto custom-scrollbar"></div>
                                </div>
                            </div>
                            <div class="flex gap-4 pt-6 border-t">
                                <button id="btn-edit-active" class="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Modify</button>
                                <button id="btn-delete-active" class="px-8 py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase">Purge</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    // ---------------------------------------------------------
    // 6. EVENT BINDING
    // ---------------------------------------------------------
    initEventListeners() {
        const query = (id) => document.getElementById(id);

        if (query('stealth-toggle')) query('stealth-toggle').onclick = () => {
            this.state.isStealthMode = !this.state.isStealthMode;
            this.render();
        };

        if (query('btn-add-event')) query('btn-add-event').onclick = () => {
            this.state.isEditMode = false;
            this.state.selectedEvent = null;
            this.resetForm();
            query('modal-event').classList.remove('hidden');
        };

        if (query('ev-search')) query('ev-search').oninput = (e) => {
            this.state.searchTerm = e.target.value;
            this.applyFilters();
            this.renderGrid();
        };

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.onclick = () => {
                this.state.currentFilter = tab.dataset.filter;
                this.applyFilters();
                this.render();
            };
        });

        if (query('save-ev-btn')) query('save-ev-btn').onclick = () => this.deployMission();
        if (query('close-ev-modal')) query('close-ev-modal').onclick = () => this.closeModal('modal-event');
        
        // Dynamic UI Conflict Check
        ['new-ev-start', 'new-ev-end'].forEach(id => {
            const el = query(id);
            if (el) el.onchange = () => this.handleConflictUI(query('new-ev-start').value, query('new-ev-end').value);
        });

        if (query('btn-edit-active')) query('btn-edit-active').onclick = () => this.openEditMode();
        if (query('btn-delete-active')) query('btn-delete-active').onclick = () => this.deleteEvent(this.state.selectedEvent.id);
        if (query('btn-generate-qr')) query('btn-generate-qr').onclick = () => this.generateQR(this.state.selectedEvent.id);
    },

    // ---------------------------------------------------------
    // 7. COMPONENT SPECIFIC ACTIONS
    // ---------------------------------------------------------
    handleConflictUI(start, end) {
        const isConflict = this.checkConflicts(start, end);
        const engine = document.getElementById('conflict-engine');
        const msg = document.getElementById('conflict-msg');
        
        if (isConflict) {
            engine.className = "p-5 bg-amber-50 rounded-2xl flex items-center gap-3 animate-pulse";
            msg.innerText = "Temporal Conflict Detected";
        } else {
            engine.className = "p-5 bg-emerald-50 rounded-2xl flex items-center gap-3";
            msg.innerText = "Vector Clear";
        }
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        const query = (id) => document.getElementById(id);
        
        query('detail-title').innerText = event.event_name;
        query('detail-desc').innerText = event.description || 'No public briefing available.';
        query('qr-container').classList.add('hidden');
        query('modal-event-detail').classList.remove('hidden');
        
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        const list = document.getElementById('inquiry-list');
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId).order('created_at', { ascending: false });

        if (!data || data.length === 0) {
            list.innerHTML = `<p class="text-[10px] italic text-slate-300">No active inquiries.</p>`;
            return;
        }

        list.innerHTML = data.map(iq => `
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span class="text-[8px] font-black text-blue-600 uppercase">ID: ${iq.student_id}</span>
                <p class="text-xs text-slate-700 font-bold mt-1">${iq.question_1 || 'General Query'}</p>
            </div>`).join('');
    },

    generateQR(eventId) {
        const baseUrl = window.location.href.split('index.html')[0]; 
        const finalUrl = `${baseUrl}ask.html?id=${eventId}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(finalUrl)}`;
        
        document.getElementById('qr-code-img').innerHTML = `<img src="${qrApiUrl}" class="mx-auto rounded-xl">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    openEditMode() {
        const ev = this.state.selectedEvent;
        this.state.isEditMode = true;
        this.closeModal('modal-event-detail');
        
        document.getElementById('modal-title').innerText = "Edit Mission";
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description || '';
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        document.getElementById('modal-event').classList.remove('hidden');
    },

    closeModal(id) {
        document.getElementById(id).classList.add('hidden');
        document.body.style.overflow = 'auto';
    },

    resetForm() {
        ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    notify(msg, type) {
        alert(`${type.toUpperCase()}: ${msg}`); // Replace with custom toast if available
    }
};
