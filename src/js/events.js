import { supabase } from './auth.js';
import { AuditLogger } from './audit-logger.js';

/** EventsModule: Professional Student Organization Event Management */
export const eventsModule = {
    state: { 
        events: [], filteredEvents: [], selectedEvent: null, attachments: [], 
        userRole: 'staff', userOrgId: null, userOrgName: '', searchTerm: '', 
        currentFilter: 'all', isLoading: false, isDarkMode: false, 
        isEditMode: false, stats: { total: 0, active: 0, upcoming: 0, completed: 0 } 
    },

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles')
                .select('role, organization_id, organizations(organization_name)')
                .eq('id', user?.id).single();
            
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
            this.state.userOrgName = profile?.organizations?.organization_name || '';
        } catch (e) { console.error("Auth sync failed", e); }
        
        container.innerHTML = this.getTemplate(this.state.isDarkMode ? 'dark-theme' : 'light-theme');
        await this.fetchEvents();
        this.initEventListeners();
        if (window.eventsModule === undefined) window.eventsModule = this;
    },

    async fetchEvents() {
        this.setLoading(true);
        try {
            const { data, error } = await supabase.from('events').select(`*, event_inquiries (id)`).order('start_time', { ascending: false });
            if (error) throw error;
            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time), end = new Date(ev.end_time);
                let status = ev.status;
                if (now < start) status = 'upcoming';
                else if (now >= start && now <= end) status = 'active';
                else if (now > end) status = 'completed';
                return { ...ev, status, inquiryCount: ev.event_inquiries ? ev.event_inquiries.length : 0 };
            });
            this.applyFilters();
            this.updateDashboardStats();
            this.renderGrid();
        } catch (error) { this.notify(error.message || "Failed to load events", "error"); }
        finally { this.setLoading(false); }
    },

    async saveEvent() {
        const name = document.getElementById('new-ev-name').value;
        const desc = document.getElementById('new-ev-desc').value;
        const start = document.getElementById('new-ev-start').value;
        const end = document.getElementById('new-ev-end').value;
        
        // Collect Participant Data
        const depts = Array.from(document.querySelectorAll('.dept-check:checked')).map(cb => cb.value);
        const years = Array.from(document.querySelectorAll('.year-check:checked')).map(cb => cb.value);

        if (!name || !start || !end) return this.notify("Please fill in all required fields", "error");
        if (this.state.userOrgName !== 'HERO Org' && depts.length === 0) return this.notify("Please select at least one department", "error");
        if (years.length === 0) return this.notify("Please select at least one year level", "error");
        if (this.checkConflicts(start, end)) return this.notify("Schedule conflict detected", "error");

        try {
            const payload = { 
                event_name: name, 
                description: desc, 
                start_time: start, 
                end_time: end, 
                organization_id: this.state.userOrgId,
                target_departments: depts,
                target_year_levels: years
            };
            
            const action = this.state.isEditMode 
                ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id) 
                : supabase.from('events').insert([{ ...payload, status: 'upcoming' }]);
            
            const { error } = await action;
            if (error) throw error;
            
            this.notify(this.state.isEditMode ? "Event updated successfully" : "Event created successfully", "success");
            this.closeModal('modal-event');
            await this.fetchEvents();
        } catch (err) { this.notify(err.message, "error"); }
    },

    async deleteEvent(id) {
        if (!confirm("Are you sure you want to delete this event? This cannot be undone.")) return;
        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            this.notify("Event removed from system", "success");
            this.closeModal('modal-event-detail');
            await this.fetchEvents();
        } catch (err) { this.notify(err.message, "error"); }
    },

    applyFilters() {
        let filtered = [...this.state.events];
        if (this.state.searchTerm) {
            const term = this.state.searchTerm.toLowerCase();
            filtered = filtered.filter(ev => ev.event_name.toLowerCase().includes(term) || (ev.description && ev.description.toLowerCase().includes(term)));
        }
        if (this.state.currentFilter !== 'all') filtered = filtered.filter(ev => ev.status === this.state.currentFilter);
        this.state.filteredEvents = filtered;
    },

    checkConflicts(start, end) {
        const s = new Date(start), e = new Date(end);
        return this.state.events.some(ev => {
            if (this.state.selectedEvent && ev.id === this.state.selectedEvent.id) return false;
            return (s < new Date(ev.end_time) && e > new Date(ev.start_time));
        });
    },

    updateDashboardStats() {
        const stats = { all: this.state.events.length, active: this.state.events.filter(e => e.status === 'active').length, upcoming: this.state.events.filter(e => e.status === 'upcoming').length };
        const statEl = document.getElementById('event-stats');
        if (statEl) statEl.innerText = `${stats.active} Ongoing | ${stats.upcoming} Upcoming | ${stats.all} Total`;
    },

    setLoading(status) {
        this.state.isLoading = status;
        const grid = document.getElementById('events-grid');
        if (grid) grid.style.opacity = status ? '0.5' : '1';
    },

    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-40 font-bold uppercase tracking-widest">No events found</div>`;
            return;
        }
        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const themeClass = this.state.isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-slate-100';
            return `<div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' class="${themeClass} cursor-pointer rounded-3xl p-8 group hover:shadow-xl transition-all relative animate-in fade-in slide-in-from-bottom-4" style="animation-delay: ${i * 40}ms">
                <div class="flex justify-between items-start mb-6"><div class="px-4 py-1.5 rounded-full bg-slate-100/50 text-[10px] font-bold uppercase tracking-wider ${ev.status === 'active' ? 'text-blue-600' : 'text-slate-500'}">${ev.status}</div>
                <div class="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg"><span class="text-[10px] font-bold text-blue-600">${ev.inquiryCount}</span><i data-lucide="help-circle" class="w-3 h-3 text-blue-600"></i></div></div>
                <div class="space-y-2 mb-8"><h3 class="text-xl font-bold tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">${ev.event_name}</h3><p class="text-xs text-slate-500 line-clamp-2">${ev.description || 'No description provided.'}</p></div>
                <div class="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50"><div class="flex flex-col gap-1"><span class="text-[9px] font-bold text-slate-400 uppercase">Starts</span><span class="text-[11px] font-medium">${new Date(ev.start_time).toLocaleDateString()}</span></div>
                <div class="flex flex-col gap-1 items-end"><span class="text-[9px] font-bold text-slate-400 uppercase">Ends</span><span class="text-[11px] font-medium">${new Date(ev.end_time).toLocaleDateString()}</span></div></div></div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        const isHero = this.state.userOrgName === 'HERO Org';
        const depts = ["Education Dept", "Industrial Technology Dept.", "All Dept"];
        const years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "All Year"];

        return `<div class="${theme} min-h-screen transition-colors duration-500 font-sans p-6 md:p-10"><style>.dark-theme{background:#111;color:#eee}.light-theme{background:#fdfdfd;color:#1e293b}.input-field{background:${this.state.isDarkMode ? '#222' : '#f8fafc'};border:1px solid ${this.state.isDarkMode ? '#444' : '#e2e8f0'}}.input-field:focus{border-color:#3b82f6}.custom-scrollbar::-webkit-scrollbar{width:5px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}</style>
            <div class="max-w-7xl mx-auto space-y-8"><div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"><div>
            <h1 class="text-4xl font-extrabold tracking-tight">Event <span class="text-blue-600">Planner</span></h1><p class="text-sm text-slate-500 mt-1 font-medium">Manage organization schedules and inquiries</p></div>
            <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto"><div class="relative flex-grow max-w-md"><i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i><input type="text" id="ev-search" value="${this.state.searchTerm}" placeholder="Search events..." class="w-full pl-11 pr-4 py-3 rounded-2xl input-field text-sm outline-none"></div>
            <button id="theme-toggle" class="p-3 rounded-xl input-field hover:bg-slate-100 transition-all"><i data-lucide="${this.state.isDarkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i></button>
            ${(this.state.userRole.includes('admin')) ? `<button id="btn-add-event" class="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Create Event</button>` : ''}</div></div>
            <div class="flex justify-between items-center py-2 border-b border-slate-100"><div class="flex gap-2">
            ${['all', 'active', 'upcoming', 'completed'].map(f => `<button data-filter="${f}" class="filter-tab px-5 py-2 rounded-xl text-xs font-bold capitalize transition-all ${this.state.currentFilter === f ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}">${f}</button>`).join('')}
            </div><div id="event-stats" class="text-xs font-bold text-slate-400 uppercase hidden md:block">Loading...</div></div><div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div></div>
            
            <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4"><div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="eventsModule.closeModal('modal-event')"></div><div class="relative bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div class="px-8 py-5 border-b flex justify-between items-center"><h2 id="modal-title" class="text-xl font-bold">New Event</h2><button id="close-ev-modal" class="p-2 rounded-full hover:bg-slate-100"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            <div class="overflow-y-auto p-8 custom-scrollbar"><div class="grid md:grid-cols-2 gap-8">
            <div class="space-y-4"><label class="text-xs font-bold text-slate-500 uppercase">Details</label><input type="text" id="new-ev-name" placeholder="Event Title" class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"><textarea id="new-ev-desc" rows="4" placeholder="Describe the event..." class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
            <label class="text-xs font-bold text-slate-500 uppercase mt-4 block">Schedule</label><input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 mb-2"><input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200"></div>
            <div class="space-y-4">
                <label class="text-xs font-bold text-slate-500 uppercase">Target Participants</label>
                ${!isHero ? `<div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Departments</p>
                    <div class="space-y-2">${depts.map(d => `<label class="flex items-center gap-3 cursor-pointer"><input type="checkbox" value="${d}" class="dept-check w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-xs font-medium text-slate-700">${d}</span></label>`).join('')}</div>
                </div>` : ''}
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Year Levels</p>
                    <div class="grid grid-cols-2 gap-2">${years.map(y => `<label class="flex items-center gap-3 cursor-pointer"><input type="checkbox" value="${y}" class="year-check w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-xs font-medium text-slate-700">${y}</span></label>`).join('')}</div>
                </div>
                <div id="conflict-engine" class="p-4 bg-emerald-50 rounded-xl flex items-center gap-3 text-emerald-700"><i data-lucide="check-circle" class="w-4 h-4"></i><p id="conflict-msg" class="text-[11px] font-bold uppercase">No Conflicts</p></div>
                <button id="save-ev-btn" class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">Save Event</button>
            </div></div></div></div></div>
            <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4"><div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div><div class="relative bg-white rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"><div class="p-8 overflow-y-auto custom-scrollbar space-y-6"><div class="flex justify-between items-center"><h2 id="detail-title" class="text-2xl font-bold"></h2><button onclick="document.getElementById('modal-event-detail').classList.add('hidden')"><i data-lucide="x" class="w-6 h-6 text-slate-400"></i></button></div>
            <div class="grid md:grid-cols-2 gap-8"><div><p id="detail-desc" class="text-sm text-slate-600 leading-relaxed mb-4"></p><div id="qr-container" class="hidden p-6 bg-slate-50 rounded-2xl text-center"><div id="qr-code-img" class="mb-2"></div><p class="text-[10px] font-bold text-slate-400 uppercase">Event QR Code</p></div><button id="btn-generate-qr" class="w-full py-3 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">Generate Inquiry QR</button></div>
            <div class="space-y-4"><h4 class="text-xs font-bold uppercase text-blue-600 tracking-wider">Recent Inquiries</h4><div id="inquiry-list" class="space-y-2 h-48 overflow-y-auto custom-scrollbar"></div></div></div><div class="flex gap-3 pt-6 border-t"><button id="btn-edit-active" class="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold">Edit Details</button><button id="btn-delete-active" class="px-6 py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all">Delete</button></div></div></div></div></div>`;
    },

    initEventListeners() {
        const query = (id) => document.getElementById(id);
        if (query('theme-toggle')) query('theme-toggle').onclick = () => { this.state.isDarkMode = !this.state.isDarkMode; this.render(); };
        if (query('btn-add-event')) query('btn-add-event').onclick = () => { this.state.isEditMode = false; this.state.selectedEvent = null; this.resetForm(); query('modal-event').classList.remove('hidden'); };
        if (query('ev-search')) query('ev-search').oninput = (e) => { this.state.searchTerm = e.target.value; this.applyFilters(); this.renderGrid(); };
        document.querySelectorAll('.filter-tab').forEach(tab => { tab.onclick = () => { this.state.currentFilter = tab.dataset.filter; this.applyFilters(); this.render(); }; });
        if (query('save-ev-btn')) query('save-ev-btn').onclick = () => this.saveEvent();
        if (query('close-ev-modal')) query('close-ev-modal').onclick = () => this.closeModal('modal-event');
        ['new-ev-start', 'new-ev-end'].forEach(id => { if (query(id)) query(id).onchange = () => this.handleConflictUI(query('new-ev-start').value, query('new-ev-end').value); });
        if (query('btn-edit-active')) query('btn-edit-active').onclick = () => this.openEditMode();
        if (query('btn-delete-active')) query('btn-delete-active').onclick = () => this.deleteEvent(this.state.selectedEvent.id);
        if (query('btn-generate-qr')) query('btn-generate-qr').onclick = () => this.generateQR(this.state.selectedEvent.id);
    },

    handleConflictUI(start, end) {
        const isConflict = this.checkConflicts(start, end), engine = document.getElementById('conflict-engine'), msg = document.getElementById('conflict-msg');
        if(!engine || !msg) return;
        engine.className = isConflict ? "p-4 bg-red-50 rounded-xl flex items-center gap-3 text-red-700" : "p-4 bg-emerald-50 rounded-xl flex items-center gap-3 text-emerald-700";
        msg.innerText = isConflict ? "Schedule Conflict" : "Slot Available";
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        document.getElementById('detail-title').innerText = event.event_name;
        document.getElementById('detail-desc').innerText = event.description || 'No description.';
        document.getElementById('qr-container').classList.add('hidden');
        document.getElementById('modal-event-detail').classList.remove('hidden');
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        const list = document.getElementById('inquiry-list');
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        if (!data || data.length === 0) { list.innerHTML = `<p class="text-[11px] italic text-slate-400">No inquiries yet.</p>`; return; }
        list.innerHTML = data.map(iq => `<div class="p-3 bg-slate-50 rounded-xl border border-slate-100"><span class="text-[9px] font-bold text-blue-500">Student ID: ${iq.student_id}</span><p class="text-[11px] text-slate-600 mt-1">${iq.question_1 || 'General Question'}</p></div>`).join('');
    },

    generateQR(eventId) {
        const url = `${window.location.href.split('index.html')[0]}ask.html?id=${eventId}`;
        document.getElementById('qr-code-img').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}" class="mx-auto rounded-xl">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    openEditMode() {
        const ev = this.state.selectedEvent; 
        this.state.isEditMode = true; 
        this.closeModal('modal-event-detail');
        this.resetForm();
        
        document.getElementById('modal-title').innerText = "Edit Event Details";
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description || '';
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        
        // Re-check saved participants
        if (ev.target_departments) {
            ev.target_departments.forEach(d => {
                const cb = document.querySelector(`.dept-check[value="${d}"]`);
                if(cb) cb.checked = true;
            });
        }
        if (ev.target_year_levels) {
            ev.target_year_levels.forEach(y => {
                const cb = document.querySelector(`.year-check[value="${y}"]`);
                if(cb) cb.checked = true;
            });
        }
        
        document.getElementById('modal-event').classList.remove('hidden');
    },

    closeModal(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow = 'auto'; },
    
    resetForm() { 
        ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => { 
            if (document.getElementById(id)) document.getElementById(id).value = ''; 
        }); 
        document.querySelectorAll('.dept-check, .year-check').forEach(cb => cb.checked = false);
    },
    
    notify(msg, type) { alert(`${type.toUpperCase()}: ${msg}`); }
};
