import { supabase } from './auth.js';

export const eventsModule = {
    state: {
        events: [], filteredEvents: [], selectedEvent: null,
        userRole: 'staff', userOrgId: null, searchTerm: '',
        currentFilter: 'all', isLoading: false, isEditMode: false
    },

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('role, organization_id, full_name').eq('id', user?.id).single();
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
            this.state.userName = profile?.full_name || 'User';
        } catch (e) { console.error("Auth sync failed", e); }

        container.innerHTML = this.getTemplate('campus-theme');
        await this.fetchEvents();
        this.initEventListeners();
        if (window.eventsModule === undefined) window.eventsModule = this;
    },

    async fetchEvents() {
        this.setLoading(true);
        try {
            let query = supabase.from('events').select(`*, event_inquiries (id)`).order('start_time', { ascending: false });
            if (this.state.userRole !== 'super_admin') query = query.eq('organization_id', this.state.userOrgId);

            const { data, error } = await query;
            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time), end = new Date(ev.end_time);
                let status = now < start ? 'standby' : (now <= end ? 'active' : 'completed');
                return { ...ev, status, inquiryCount: ev.event_inquiries?.length || 0 };
            });

            this.applyFilters();
            this.renderGrid();
            this.updateDashboardStats();
        } catch (error) { this.notify(error.message, "error"); } 
        finally { this.setLoading(false); }
    },

    can(action) {
        const r = this.state.userRole;
        return {
            manage: ['super_admin', 'admin'].includes(r),
            attendance: ['super_admin', 'admin', 'attendance_staff'].includes(r),
            finance: ['super_admin', 'admin', 'finance_staff'].includes(r)
        }[action];
    },

    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        
        if (!this.state.filteredEvents.length) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center py-24 text-slate-400">
                    <i data-lucide="calendar-off" class="w-12 h-12 mb-4 opacity-20"></i>
                    <p class="font-bold uppercase tracking-widest text-sm">No Events found</p>
                    <p class="text-xs">Try adjusting your filters or search term</p>
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const isActive = ev.status === 'active';
            return `
            <div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' 
                 class="group relative bg-white border border-slate-100 rounded-[2rem] p-6 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-500 cursor-pointer animate-in fade-in slide-in-from-bottom-4" style="animation-delay: ${i * 50}ms">
                
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center gap-2">
                        <span class="relative flex h-2 w-2 ${isActive ? 'block' : 'hidden'}">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isActive ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}">
                            ${ev.status}
                        </span>
                    </div>
                    <div class="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full group-hover:bg-indigo-50 transition-colors">
                        <i data-lucide="message-square" class="w-3 h-3 text-slate-400 group-hover:text-indigo-600"></i>
                        <span class="text-[10px] font-bold text-slate-600 group-hover:text-indigo-600">${ev.inquiryCount}</span>
                    </div>
                </div>

                <h3 class="text-xl font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">${ev.event_name}</h3>
                <p class="text-sm text-slate-500 line-clamp-2 mb-6 leading-relaxed">${ev.description || 'No description provided.'}</p>

                <div class="flex items-center justify-between pt-5 border-t border-slate-50">
                    <div class="flex items-center gap-2 text-slate-400">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                        <span class="text-[11px] font-bold">${new Date(ev.start_time).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </div>
                </div>
            </div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        return `
            <div class="${theme} min-h-screen bg-[#F8FAFC] p-6 lg:p-12 font-sans">
                <div class="max-w-7xl mx-auto space-y-10">
                    
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <div class="h-1 w-8 bg-indigo-600 rounded-full"></div>
                                <span class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">${this.state.userRole.replace('_', ' ')} Portal</span>
                            </div>
                            <h1 class="text-4xl font-black text-slate-900 tracking-tight">Campus <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Events</span></h1>
                        </div>
                        
                        <div class="flex items-center gap-3">
                            <div class="relative hidden sm:block">
                                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                                <input type="text" id="ev-search" placeholder="Search events..." class="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all w-64">
                            </div>
                            ${this.can('manage') ? `
                                <button id="btn-add-event" class="bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-bold text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 flex items-center gap-2">
                                    <i data-lucide="plus" class="w-4 h-4"></i> Create
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row justify-between items-center bg-white/50 backdrop-blur-md p-2 rounded-[1.5rem] border border-white gap-4">
                        <div class="flex gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                            ${['all', 'active', 'standby', 'completed'].map(f => `
                                <button data-filter="${f}" class="filter-tab px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${this.state.currentFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}">
                                    ${f}
                                </button>
                            `).join('')}
                        </div>
                        <div id="event-stats" class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"></div>
                    </div>

                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
                </div>

                <style>
                    .no-scrollbar::-webkit-scrollbar { display: none; }
                    .modal-animate { animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                    @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
                </style>

                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
                    <div class="modal-animate relative bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl">
                        <div class="p-8 sm:p-12">
                            <h2 id="modal-title" class="text-2xl font-black text-slate-900 mb-8">Event <span class="text-indigo-600">Details</span></h2>
                            <div class="space-y-6">
                                <div class="group">
                                    <label class="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 block tracking-widest">Event Title</label>
                                    <input type="text" id="new-ev-name" class="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700">
                                </div>
                                <div class="group">
                                    <label class="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 block tracking-widest">Description</label>
                                    <textarea id="new-ev-desc" rows="3" class="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all text-slate-600"></textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 block tracking-widest">Start Time</label>
                                        <input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs text-slate-600">
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1 mb-2 block tracking-widest">End Time</label>
                                        <input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold text-xs text-slate-600">
                                    </div>
                                </div>
                                <div class="flex gap-3 pt-4">
                                    <button onclick="eventsModule.closeModal('modal-event')" class="flex-1 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
                                    <button id="save-ev-btn" class="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Confirm & Publish</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-xl">
                    <div class="modal-animate relative bg-white rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div class="flex-1 overflow-y-auto p-8 sm:p-14 custom-scrollbar">
                            <div class="flex justify-between items-start mb-10">
                                <div>
                                    <div id="detail-status-pill" class="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-3">Public Event</div>
                                    <h2 id="detail-title" class="text-4xl font-black text-slate-900 tracking-tight"></h2>
                                </div>
                                <button onclick="eventsModule.closeModal('modal-event-detail')" class="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                                    <i data-lucide="x" class="w-6 h-6"></i>
                                </button>
                            </div>

                            <div class="grid lg:grid-cols-3 gap-12">
                                <div class="lg:col-span-2 space-y-8">
                                    <div>
                                        <h4 class="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4">Event Overview</h4>
                                        <p id="detail-desc" class="text-slate-600 leading-loose text-lg"></p>
                                    </div>
                                    <div id="qr-container" class="hidden p-8 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
                                        <div id="qr-code-img" class="p-4 bg-white rounded-3xl shadow-sm mb-4"></div>
                                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Scanning Enabled</p>
                                    </div>
                                </div>
                                
                                <div class="space-y-6">
                                    <div class="bg-slate-50 rounded-[2rem] p-6">
                                        <h4 class="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em] mb-4">Recent Inquiries</h4>
                                        <div id="inquiry-list" class="space-y-4 max-h-64 overflow-y-auto no-scrollbar"></div>
                                    </div>
                                    ${this.can('attendance') ? `
                                        <button id="btn-generate-qr" class="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                            <i data-lucide="qr-code" class="w-4 h-4"></i> Access Gate
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>

                        ${this.can('manage') ? `
                            <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                                <button id="btn-edit-active" class="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">Edit Details</button>
                                <button id="btn-delete-active" class="px-8 py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-100 transition-all">Cancel Event</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>`;
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        const q = (id) => document.getElementById(id);
        q('detail-title').innerText = event.event_name;
        q('detail-desc').innerText = event.description || 'No detailed information provided for this activity.';
        q('qr-container').classList.add('hidden');
        q('modal-event-detail').classList.remove('hidden');
        
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        if (!this.can('finance') && !this.can('manage')) return; 
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId).order('created_at', {ascending: false});
        const list = document.getElementById('inquiry-list');
        list.innerHTML = data?.length ? data.map(iq => `
            <div class="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                <p class="text-[9px] font-black text-indigo-600 mb-1">STUDENT ${iq.student_id}</p>
                <p class="text-xs text-slate-600 font-medium leading-tight">${iq.question_1}</p>
            </div>`).join('') : '<p class="text-center text-slate-300 py-10 text-[10px] font-bold uppercase tracking-widest">No Activity</p>';
    },

    updateDashboardStats() {
        const s = document.getElementById('event-stats');
        if (s) s.innerText = `${this.state.events.filter(e => e.status === 'active').length} Active • ${this.state.events.length} Total`;
    },

    // Utilities maintained from source
    setLoading(s) { this.state.isLoading = s; const g = document.getElementById('events-grid'); if(g) g.style.opacity = s ? '0.3' : '1'; },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    notify(m, t) { alert(`${t.toUpperCase()}: ${m}`); },
    initEventListeners() {
        const q = (id) => document.getElementById(id);
        if (q('btn-add-event')) q('btn-add-event').onclick = () => { this.state.isEditMode = false; this.resetForm(); q('modal-event').classList.remove('hidden'); };
        if (q('ev-search')) q('ev-search').oninput = (e) => { this.state.searchTerm = e.target.value; this.applyFilters(); this.renderGrid(); };
        if (q('save-ev-btn')) q('save-ev-btn').onclick = () => this.deployMission();
        if (q('btn-edit-active')) q('btn-edit-active').onclick = () => this.openEditMode();
        if (q('btn-delete-active')) q('btn-delete-active').onclick = () => this.deleteEvent(this.state.selectedEvent.id);
        if (q('btn-generate-qr')) q('btn-generate-qr').onclick = () => this.generateQR(this.state.selectedEvent.id);
        document.querySelectorAll('.filter-tab').forEach(t => t.onclick = () => { this.state.currentFilter = t.dataset.filter; this.applyFilters(); this.renderGrid(); });
    },
    resetForm() { ['name', 'desc', 'start', 'end'].forEach(f => { const el = document.getElementById(`new-ev-${f}`); if(el) el.value = ''; }); }
};
