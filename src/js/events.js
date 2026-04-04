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
        isStealthMode: false, // Now "Compact/Focus Mode"
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

        const theme = this.state.isStealthMode ? 'focus-theme' : 'campus-theme';
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
            this.notify(error.message || "Failed to load events", "error");
        } finally {
            this.setLoading(false);
        }
    },

    async deployMission() {
        const name = document.getElementById('new-ev-name').value;
        const desc = document.getElementById('new-ev-desc').value;
        const start = document.getElementById('new-ev-start').value;
        const end = document.getElementById('new-ev-end').value;

        if (!name || !start || !end) return this.notify("Please fill in all required fields", "error");
        if (this.checkConflicts(start, end)) return this.notify("Scheduling conflict with another event", "error");

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

            this.notify(this.state.isEditMode ? "Event Details Updated" : "Event Successfully Published", "success");
            this.closeModal('modal-event');
            await this.fetchEvents();
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    async deleteEvent(id) {
        if (!confirm("Are you sure you want to cancel this event? All data will be removed.")) return;
        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            this.notify("Event removed from campus calendar", "success");
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
        if (statEl) statEl.innerText = `${stats.active} Ongoing | ${stats.standby} Upcoming | ${stats.all} Total Events`;
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
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-40 font-bold uppercase tracking-widest text-slate-400">No events found in this category</div>`;
            return;
        }

        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const isActive = ev.status === 'active';
            const themeClass = this.state.isStealthMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-100 shadow-sm';
            
            return `
                <div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' 
                     class="${themeClass} cursor-pointer rounded-3xl p-6 group hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden animate-in fade-in slide-in-from-bottom-4" 
                     style="animation-delay: ${i * 40}ms">
                    
                    <div class="flex justify-between items-start mb-5">
                        <div class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}">
                            ${ev.status === 'standby' ? 'Upcoming' : ev.status}
                        </div>
                        <div class="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-full">
                             <span class="text-[10px] font-bold text-indigo-600">${ev.inquiryCount}</span>
                             <i data-lucide="help-circle" class="w-3 h-3 text-indigo-600"></i>
                        </div>
                    </div>

                    <div class="space-y-2 mb-6">
                        <h3 class="text-xl font-bold tracking-tight text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">${ev.event_name}</h3>
                        <p class="text-xs text-slate-500 font-normal line-clamp-2">${ev.description || 'Join us for this exciting campus activity!'}</p>
                    </div>

                    <div class="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div class="flex items-center gap-2">
                            <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-300"></i>
                            <span class="text-[11px] font-semibold text-slate-600">${new Date(ev.start_time).toLocaleDateString()}</span>
                        </div>
                        <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">View Details</div>
                    </div>
                </div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        return `
            <div class="${theme} min-h-screen transition-all duration-500 font-sans p-6 md:p-12">
                <style>
                    .focus-theme { background: #0f172a; color: #f8fafc; }
                    .campus-theme { background: #fdfdfd; color: #1e293b; }
                    .org-gradient-text { background: linear-gradient(135deg, #4f46e5, #9333ea); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                    .input-campus { background: ${this.state.isStealthMode ? '#1e293b' : '#fff'}; border: 1px solid ${this.state.isStealthMode ? '#334155' : '#e2e8f0'}; transition: all 0.2s; }
                    .input-campus:focus { border-color: #6366f1; ring: 2px; ring-color: #6366f1; }
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                </style>

                <div class="max-w-7xl mx-auto space-y-12">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div class="space-y-2">
                            <div class="flex items-center gap-2">
                                <i data-lucide="graduation-cap" class="text-indigo-600 w-5 h-5"></i>
                                <p class="text-[12px] font-bold uppercase tracking-widest text-indigo-500">Student Org Portal</p>
                            </div>
                            <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight">
                                Campus <span class="org-gradient-text">Events</span>
                            </h1>
                        </div>

                        <div class="flex flex-wrap items-center gap-4 w-full md:w-auto">
                            <div class="relative flex-grow md:w-80">
                                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                                <input type="text" id="ev-search" value="${this.state.searchTerm}" placeholder="Search events..." 
                                    class="w-full pl-11 pr-4 py-3.5 rounded-2xl input-campus text-sm font-medium outline-none">
                            </div>
                            <button id="stealth-toggle" class="p-3.5 rounded-xl input-campus hover:bg-slate-50 transition-all shadow-sm">
                                <i data-lucide="${this.state.isStealthMode ? 'layout' : 'maximize'}" class="w-5 h-5 text-indigo-600"></i>
                            </button>
                            ${(this.state.userRole.includes('admin')) ? `
                                <button id="btn-add-event" class="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 flex items-center gap-2 hover:bg-indigo-700 transition-all">
                                    <i data-lucide="calendar-plus" class="w-4 h-4"></i> Create Event
                                </button>` : ''}
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row justify-between items-center py-2 gap-4">
                        <div class="flex p-1 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto">
                            ${['all', 'active', 'standby', 'completed'].map(f => `
                                <button data-filter="${f}" class="filter-tab px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${this.state.currentFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${f === 'standby' ? 'Upcoming' : f}</button>
                            `).join('')}
                        </div>
                        <div id="event-stats" class="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Updating...</div>
                    </div>

                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                </div>

                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-6">
                    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="eventsModule.closeModal('modal-event')"></div>
                    <div class="relative bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div class="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                            <h2 id="modal-title" class="text-xl font-bold text-slate-800">Event <span class="text-indigo-600">Planner</span></h2>
                            <button id="close-ev-modal" class="p-2 rounded-full hover:bg-white transition-colors border border-transparent hover:border-slate-100"><i data-lucide="x" class="w-5 h-5 text-slate-400"></i></button>
                        </div>
                        <div class="overflow-y-auto p-8 custom-scrollbar">
                            <div class="grid lg:grid-cols-2 gap-8">
                                <div class="space-y-5">
                                    <label class="block text-[10px] font-bold uppercase text-slate-400 ml-1">Basic Information</label>
                                    <input type="text" id="new-ev-name" placeholder="Event Title" class="w-full p-4 bg-slate-50 rounded-xl font-semibold border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none transition-all">
                                    <textarea id="new-ev-desc" rows="6" placeholder="Provide event details, venue, and requirements..." class="w-full p-4 bg-slate-50 rounded-xl font-medium border-2 border-transparent focus:border-indigo-100 focus:bg-white outline-none transition-all"></textarea>
                                </div>
                                <div class="space-y-5">
                                    <label class="block text-[10px] font-bold uppercase text-slate-400 ml-1">Schedule & Constraints</label>
                                    <div class="space-y-2">
                                        <span class="text-[10px] font-bold text-slate-400">Starts</span>
                                        <input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-indigo-100">
                                    </div>
                                    <div class="space-y-2">
                                        <span class="text-[10px] font-bold text-slate-400">Ends</span>
                                        <input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-indigo-100">
                                    </div>
                                    <div id="conflict-engine" class="p-4 bg-green-50 rounded-xl flex items-center gap-3">
                                        <i data-lucide="check-circle" class="text-green-500 w-4 h-4"></i>
                                        <p id="conflict-msg" class="text-[11px] font-bold text-green-700">Schedule is available</p>
                                    </div>
                                    <button id="save-ev-btn" class="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Publish Event</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-6">
                    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-md"></div>
                    <div class="relative bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                        <div class="p-10 overflow-y-auto custom-scrollbar space-y-8">
                            <div class="flex justify-between items-start">
                                <div class="space-y-1">
                                    <h2 id="detail-title" class="text-3xl font-extrabold text-slate-900"></h2>
                                    <div class="flex gap-2">
                                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded">Public Event</span>
                                    </div>
                                </div>
                                <button onclick="document.getElementById('modal-event-detail').classList.add('hidden')" class="p-2 bg-slate-50 rounded-full hover:bg-slate-100">
                                    <i data-lucide="x" class="w-6 h-6 text-slate-400"></i>
                                </button>
                            </div>
                            <div class="grid md:grid-cols-2 gap-10">
                                <div class="space-y-6">
                                    <div class="prose prose-sm">
                                        <h4 class="text-xs font-bold uppercase text-slate-400 mb-2">Description</h4>
                                        <p id="detail-desc" class="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl"></p>
                                    </div>
                                    <div id="qr-container" class="hidden p-6 bg-white border-2 border-dashed border-slate-100 rounded-3xl text-center">
                                        <div id="qr-code-img" class="mb-4"></div>
                                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Scan to Submit Inquiry</p>
                                    </div>
                                    <button id="btn-generate-qr" class="w-full py-4 border-2 border-indigo-50 text-indigo-600 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                                        <i data-lucide="qr-code" class="w-4 h-4"></i> Generate QR Attendance/Help
                                    </button>
                                </div>
                                <div class="space-y-4">
                                    <div class="flex justify-between items-center">
                                        <h4 class="text-[11px] font-bold uppercase text-indigo-600">Student Inquiries</h4>
                                        <span class="text-[10px] text-slate-400 font-medium">Recent First</span>
                                    </div>
                                    <div id="inquiry-list" class="space-y-3 h-72 overflow-y-auto custom-scrollbar pr-2"></div>
                                </div>
                            </div>
                            <div class="flex gap-4 pt-8 border-t border-slate-50">
                                <button id="btn-edit-active" class="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs hover:bg-slate-800 transition-all">Edit Event</button>
                                <button id="btn-delete-active" class="px-8 py-4 bg-red-50 text-red-600 rounded-2xl font-bold uppercase text-xs hover:bg-red-100 transition-all">Cancel Event</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    // ---------------------------------------------------------
    // 6. EVENT BINDING (Unchanged logic)
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
        
        ['new-ev-start', 'new-ev-end'].forEach(id => {
            const el = query(id);
            if (el) el.onchange = () => this.handleConflictUI(query('new-ev-start').value, query('new-ev-end').value);
        });

        if (query('btn-edit-active')) query('btn-edit-active').onclick = () => this.openEditMode();
        if (query('btn-delete-active')) query('btn-delete-active').onclick = () => this.deleteEvent(this.state.selectedEvent.id);
        if (query('btn-generate-qr')) query('btn-generate-qr').onclick = () => this.generateQR(this.state.selectedEvent.id);
    },

    handleConflictUI(start, end) {
        const isConflict = this.checkConflicts(start, end);
        const engine = document.getElementById('conflict-engine');
        const msg = document.getElementById('conflict-msg');
        
        if (isConflict) {
            engine.className = "p-4 bg-amber-50 rounded-xl flex items-center gap-3";
            msg.innerText = "Warning: Venue/Time Overlap";
            msg.className = "text-[11px] font-bold text-amber-700";
        } else {
            engine.className = "p-4 bg-green-50 rounded-xl flex items-center gap-3";
            msg.innerText = "Schedule is available";
            msg.className = "text-[11px] font-bold text-green-700";
        }
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        const query = (id) => document.getElementById(id);
        
        query('detail-title').innerText = event.event_name;
        query('detail-desc').innerText = event.description || 'No detailed description provided for this campus event.';
        query('qr-container').classList.add('hidden');
        query('modal-event-detail').classList.remove('hidden');
        
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        const list = document.getElementById('inquiry-list');
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId).order('created_at', { ascending: false });

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="p-8 text-center border-2 border-dashed border-slate-50 rounded-2xl">
                <p class="text-[11px] font-bold text-slate-300 uppercase tracking-widest">No Student Inquiries</p>
            </div>`;
            return;
        }

        list.innerHTML = data.map(iq => `
            <div class="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                <div class="flex justify-between items-start mb-1">
                    <span class="text-[9px] font-bold text-indigo-600 uppercase">Student ID: ${iq.student_id}</span>
                </div>
                <p class="text-xs text-slate-700 font-medium">${iq.question_1 || 'General inquiry regarding event.'}</p>
            </div>`).join('');
    },

    generateQR(eventId) {
        const baseUrl = window.location.href.split('index.html')[0]; 
        const finalUrl = `${baseUrl}ask.html?id=${eventId}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(finalUrl)}`;
        
        document.getElementById('qr-code-img').innerHTML = `<img src="${qrApiUrl}" class="mx-auto rounded-2xl shadow-sm border-4 border-white">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    openEditMode() {
        const ev = this.state.selectedEvent;
        this.state.isEditMode = true;
        this.closeModal('modal-event-detail');
        
        document.getElementById('modal-title').innerText = "Edit Event Details";
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
        // Styled alert fallback
        alert(`${type.toUpperCase()}: ${msg}`);
    }
};
