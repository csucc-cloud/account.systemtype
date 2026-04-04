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
            const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user?.id).single();
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
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
            
            // Org Isolation: Non-super_admins are restricted to their organization_id
            if (this.state.userRole !== 'super_admin') {
                query = query.eq('organization_id', this.state.userOrgId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time), end = new Date(ev.end_time);
                let status = now < start ? 'standby' : (now <= end ? 'active' : 'completed');
                return { ...ev, status, inquiryCount: ev.event_inquiries?.length || 0 };
            });

            this.applyFilters();
            this.updateDashboardStats();
            this.renderGrid();
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

    async deployMission() {
        const fields = ['name', 'desc', 'start', 'end'].reduce((acc, f) => ({...acc, [f]: document.getElementById(`new-ev-${f}`).value}), {});
        if (!fields.name || !fields.start || !fields.end) return this.notify("Missing required fields", "error");
        if (this.checkConflicts(fields.start, fields.end)) return this.notify("Scheduling conflict detected", "error");

        const payload = { 
            event_name: fields.name, description: fields.desc, 
            start_time: fields.start, end_time: fields.end, 
            organization_id: this.state.userOrgId 
        };

        const req = this.state.isEditMode 
            ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id)
            : supabase.from('events').insert([{ ...payload, status: 'active' }]);

        const { error } = await req;
        if (error) throw error;

        this.notify(this.state.isEditMode ? "Updated" : "Published", "success");
        this.closeModal('modal-event');
        await this.fetchEvents();
    },

    async deleteEvent(id) {
        if (!confirm("Are you sure?")) return;
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) return this.notify(error.message, "error");
        this.notify("Event removed", "success");
        this.closeModal('modal-event-detail');
        await this.fetchEvents();
    },

    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        grid.innerHTML = this.state.filteredEvents.length ? this.state.filteredEvents.map((ev, i) => `
            <div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' 
                 class="bg-white cursor-pointer rounded-3xl p-6 group hover:shadow-xl transition-all animate-in fade-in" style="animation-delay: ${i * 40}ms">
                <div class="flex justify-between mb-5">
                    <div class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ev.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}">
                        ${ev.status === 'standby' ? 'Upcoming' : ev.status}
                    </div>
                    <div class="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-full text-indigo-600 font-bold text-[10px]">
                        ${ev.inquiryCount} <i data-lucide="help-circle" class="w-3 h-3"></i>
                    </div>
                </div>
                <h3 class="text-xl font-bold line-clamp-1 group-hover:text-indigo-600">${ev.event_name}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mt-2">${ev.description || 'Campus event'}</p>
                <div class="flex justify-between pt-4 mt-4 border-t border-slate-50 items-center">
                    <span class="text-[11px] font-semibold text-slate-600">${new Date(ev.start_time).toLocaleDateString()}</span>
                    <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Details</span>
                </div>
            </div>`).join('') : `<div class="col-span-full py-40 text-center opacity-40 font-bold uppercase">No events found</div>`;
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        return `
            <div class="${theme} p-6 md:p-12">
                <div class="max-w-7xl mx-auto space-y-8">
                    <div class="flex justify-between items-center">
                        <div>
                           <h1 class="text-4xl font-extrabold">Campus <span class="org-gradient-text">Events</span></h1>
                           <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">${this.state.userRole.replace('_', ' ')}</p>
                        </div>
                        ${this.can('manage') ? `<button id="btn-add-event" class="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2"><i data-lucide="calendar-plus" class="w-4 h-4"></i> Create Event</button>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-4 items-center">
                        <input type="text" id="ev-search" placeholder="Search..." class="p-3 rounded-xl border w-64 text-sm outline-none focus:ring-2 focus:ring-indigo-100">
                        <div class="flex bg-slate-100 p-1 rounded-xl">
                            ${['all', 'active', 'standby', 'completed'].map(f => `<button data-filter="${f}" class="filter-tab px-4 py-2 text-xs font-bold uppercase ${this.state.currentFilter === f ? 'bg-white text-indigo-600 shadow-sm rounded-lg' : 'text-slate-500'}">${f}</button>`).join('')}
                        </div>
                        <div id="event-stats" class="text-[10px] font-bold text-slate-400 uppercase"></div>
                    </div>
                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6"></div>
                </div>
                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                    <div class="relative bg-white rounded-[2rem] w-full max-w-4xl p-8">
                        <h2 id="modal-title" class="text-xl font-bold mb-6">Event Planner</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div class="space-y-4">
                                <input type="text" id="new-ev-name" placeholder="Title" class="w-full p-4 bg-slate-50 rounded-xl">
                                <textarea id="new-ev-desc" placeholder="Details" class="w-full p-4 bg-slate-50 rounded-xl" rows="4"></textarea>
                            </div>
                            <div class="space-y-4">
                                <input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-xl">
                                <input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-xl">
                                <button id="save-ev-btn" class="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase">Publish</button>
                                <button onclick="eventsModule.closeModal('modal-event')" class="w-full py-2 text-slate-400 text-xs">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
                    <div class="bg-white rounded-[2.5rem] w-full max-w-4xl p-10 max-h-[90vh] overflow-y-auto">
                        <div class="flex justify-between items-start mb-6">
                            <h2 id="detail-title" class="text-3xl font-extrabold"></h2>
                            <button onclick="eventsModule.closeModal('modal-event-detail')" class="p-2 bg-slate-50 rounded-full"><i data-lucide="x"></i></button>
                        </div>
                        <p id="detail-desc" class="bg-slate-50 p-6 rounded-2xl text-slate-600 mb-6"></p>
                        <div id="qr-container" class="hidden mb-6 text-center border-2 border-dashed p-4 rounded-2xl">
                             <div id="qr-code-img"></div>
                        </div>
                        <div id="inquiry-list" class="space-y-3 mb-8"></div>
                        <div class="flex gap-4 border-t pt-6">
                            <button id="btn-generate-qr" class="flex-1 py-4 border-2 border-indigo-50 text-indigo-600 rounded-2xl font-bold text-xs uppercase"><i data-lucide="qr-code"></i> Attendance QR</button>
                            <button id="btn-edit-active" class="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase">Edit</button>
                            <button id="btn-delete-active" class="px-8 py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-xs uppercase">Cancel Event</button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        const q = (id) => document.getElementById(id);
        q('detail-title').innerText = event.event_name;
        q('detail-desc').innerText = event.description || 'No description provided.';
        q('qr-container').classList.add('hidden');
        
        q('btn-edit-active').style.display = this.can('manage') ? 'block' : 'none';
        q('btn-delete-active').style.display = this.can('manage') ? 'block' : 'none';
        q('btn-generate-qr').style.display = this.can('attendance') ? 'flex' : 'none';
        
        q('modal-event-detail').classList.remove('hidden');
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        if (!this.can('finance') && !this.can('manage')) return; 
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId);
        const list = document.getElementById('inquiry-list');
        list.innerHTML = data?.length ? data.map(iq => `<div class="p-4 bg-slate-50 rounded-xl text-xs"><b>Student ${iq.student_id}:</b> ${iq.question_1}</div>`).join('') : '<p class="text-center text-slate-400 text-xs">No inquiries yet.</p>';
    },

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

    generateQR(id) {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.href + '?id=' + id)}`;
        document.getElementById('qr-code-img').innerHTML = `<img src="${url}" class="mx-auto border-4 border-white shadow-sm">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    openEditMode() {
        const ev = this.state.selectedEvent;
        this.state.isEditMode = true;
        this.closeModal('modal-event-detail');
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description;
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        document.getElementById('modal-event').classList.remove('hidden');
    },

    applyFilters() {
        let f = this.state.events;
        if (this.state.searchTerm) f = f.filter(e => e.event_name.toLowerCase().includes(this.state.searchTerm.toLowerCase()));
        if (this.state.currentFilter !== 'all') f = f.filter(e => e.status === this.state.currentFilter);
        this.state.filteredEvents = f;
    },

    updateDashboardStats() {
        const s = document.getElementById('event-stats');
        if (s) s.innerText = `${this.state.events.filter(e => e.status === 'active').length} Active | ${this.state.events.length} Total`;
    },

    setLoading(s) { this.state.isLoading = s; const g = document.getElementById('events-grid'); if(g) g.style.opacity = s ? '0.5' : '1'; },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },
    notify(m, t) { alert(`${t.toUpperCase()}: ${m}`); },
    checkConflicts(s, e) { return this.state.events.some(ev => (this.state.selectedEvent?.id !== ev.id && new Date(s) < new Date(ev.end_time) && new Date(e) > new Date(ev.start_time))); },
    resetForm() { ['name', 'desc', 'start', 'end'].forEach(f => { const el = document.getElementById(`new-ev-${f}`); if(el) el.value = ''; }); }
};
