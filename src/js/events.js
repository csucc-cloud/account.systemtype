import { supabase } from './auth.js';
import { AuditLogger } from './audit-logger.js';

/** EventsModule: Professional Student Organization Event Management */
export const eventsModule = {
    state: { events: [], filteredEvents: [], selectedEvent: null, attachments: [], userRole: 'staff', userOrgId: null, userOrgName: '', searchTerm: '', currentFilter: 'all', isLoading: false, isDarkMode: false, isEditMode: false, stats: { total: 0, active: 0, upcoming: 0, completed: 0 } },

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('role, organization_id, organizations(organization_name)').eq('id', user?.id).single();
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
            this.state.userOrgName = profile?.organizations?.organization_name || '';
        } catch (e) { console.error("Auth sync failed", e); }
        container.innerHTML = this.getTemplate(this.state.isDarkMode ? 'dark-theme' : 'light-theme');
        await this.fetchEvents();
        this.initEventListeners();
        if (window.eventsModule === undefined) window.eventsModule = this;
    },

    async saveEvent() {
        const name = document.getElementById('new-ev-name').value, desc = document.getElementById('new-ev-desc').value;
        const start = document.getElementById('new-ev-start').value, end = document.getElementById('new-ev-end').value;
        const depts = Array.from(document.querySelectorAll('.dept-check:checked')).map(cb => cb.value);
        const years = Array.from(document.querySelectorAll('.year-check:checked')).map(cb => cb.value);

        if (!name || !start || !end) return this.notify("Please fill in all required fields", "error");
        if (this.state.userOrgName !== 'HERO Org' && depts.length === 0) return this.notify("Select at least one department", "error");
        if (years.length === 0) return this.notify("Select at least one year level", "error");

        try {
            const payload = { 
                event_name: name, description: desc, start_time: start, end_time: end, 
                organization_id: this.state.userOrgId, target_departments: depts, target_year_levels: years 
            };
            const action = this.state.isEditMode ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id) : supabase.from('events').insert([{ ...payload, status: 'upcoming' }]);
            const { error } = await action;
            if (error) throw error;
            this.notify(this.state.isEditMode ? "Event updated" : "Event created", "success");
            this.closeModal('modal-event');
            await this.fetchEvents();
        } catch (err) { this.notify(err.message, "error"); }
    },

    getTemplate(theme) {
        const isHero = this.state.userOrgName === 'HERO Org';
        const depts = ["Education Dept", "Industrial Technology Dept.", "All Dept"];
        const years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "All Year"];

        return `<div class="${theme} min-h-screen font-sans p-6 md:p-10"><style>.dark-theme{background:#111;color:#eee}.light-theme{background:#fdfdfd;color:#1e293b}.input-field{background:${this.state.isDarkMode ? '#222' : '#f8fafc'};border:1px solid ${this.state.isDarkMode ? '#444' : '#e2e8f0'}}.custom-scrollbar::-webkit-scrollbar{width:5px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}</style>
            <div class="max-w-7xl mx-auto space-y-8"><div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"><div><h1 class="text-4xl font-extrabold tracking-tight">Event <span class="text-blue-600">Planner</span></h1></div>
            <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto"><div class="relative flex-grow max-w-md"><i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i><input type="text" id="ev-search" value="${this.state.searchTerm}" placeholder="Search events..." class="w-full pl-11 pr-4 py-3 rounded-2xl input-field text-sm outline-none"></div>
            <button id="theme-toggle" class="p-3 rounded-xl input-field hover:bg-slate-100 transition-all"><i data-lucide="${this.state.isDarkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i></button>
            ${(this.state.userRole.includes('admin')) ? `<button id="btn-add-event" class="px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Create Event</button>` : ''}</div></div>
            <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div></div>
            
            <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4"><div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="eventsModule.closeModal('modal-event')"></div><div class="relative bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div class="px-8 py-5 border-b flex justify-between items-center"><h2 id="modal-title" class="text-xl font-bold">Event Details</h2><button id="close-ev-modal" class="p-2 rounded-full hover:bg-slate-100"><i data-lucide="x" class="w-5 h-5"></i></button></div>
            <div class="overflow-y-auto p-8 custom-scrollbar"><div class="grid md:grid-cols-2 gap-8"><div class="space-y-6"><div><label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Basic Info</label><input type="text" id="new-ev-name" placeholder="Event Title" class="w-full p-4 bg-slate-50 rounded-xl mb-4 border-none ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-blue-500"><textarea id="new-ev-desc" rows="3" placeholder="Description" class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-blue-500"></textarea></div>
            <div><label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Schedule</label><input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-xl mb-2 border-none ring-1 ring-slate-200"><input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-xl border-none ring-1 ring-slate-200"></div></div>
            <div class="space-y-6"><div><label class="text-xs font-bold text-slate-500 uppercase mb-3 block">Target Participants</label>
            ${!isHero ? `<div class="mb-4"><p class="text-[10px] font-bold text-slate-400 mb-2">DEPARTMENTS</p><div class="grid grid-cols-1 gap-2">${depts.map(d => `<label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100"><input type="checkbox" value="${d}" class="dept-check w-4 h-4 rounded text-blue-600"><span class="text-xs font-medium">${d}</span></label>`).join('')}</div></div>` : ''}
            <div><p class="text-[10px] font-bold text-slate-400 mb-2">YEAR LEVELS</p><div class="grid grid-cols-2 gap-2">${years.map(y => `<label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100"><input type="checkbox" value="${y}" class="year-check w-4 h-4 rounded text-blue-600"><span class="text-xs font-medium">${y}</span></label>`).join('')}</div></div></div>
            <button id="save-ev-btn" class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">Save Event</button></div></div></div></div></div>
            <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4"><div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div><div class="relative bg-white rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"><div class="p-8 overflow-y-auto custom-scrollbar space-y-6"></div></div></div></div>`;
    },

    openEditMode() {
        const ev = this.state.selectedEvent; this.state.isEditMode = true; this.closeModal('modal-event-detail');
        document.getElementById('modal-title').innerText = "Edit Event";
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description || '';
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        (ev.target_departments || []).forEach(d => { const el = document.querySelector(`.dept-check[value="${d}"]`); if(el) el.checked = true; });
        (ev.target_year_levels || []).forEach(y => { const el = document.querySelector(`.year-check[value="${y}"]`); if(el) el.checked = true; });
        document.getElementById('modal-event').classList.remove('hidden');
    },

    resetForm() {
        ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; });
        document.querySelectorAll('.dept-check, .year-check').forEach(cb => cb.checked = false);
    },

    // Standard Utility placeholders (logic unchanged from previous version)
    async fetchEvents() { /* logic from previous version */ },
    async deleteEvent(id) { /* logic from previous version */ },
    applyFilters() { /* logic from previous version */ },
    checkConflicts(s, e) { /* logic from previous version */ },
    updateDashboardStats() { /* logic from previous version */ },
    setLoading(s) { /* logic from previous version */ },
    renderGrid() { /* logic from previous version */ },
    initEventListeners() { /* logic from previous version */ },
    async openDetailModal(e) { /* logic from previous version */ },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow = 'auto'; },
    notify(m, t) { alert(`${t.toUpperCase()}: ${m}`); }
};
