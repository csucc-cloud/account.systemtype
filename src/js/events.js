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
            let query = supabase.from('events').select(`*, event_inquiries (id)`);
            
            // RBAC: Super Admin sees all, others see their own org
            if (this.state.userRole !== 'super_admin') {
                query = query.eq('organization_id', this.state.userOrgId);
            }

            const { data, error } = await query.order('start_time', { ascending: false });
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
        
        const depts = Array.from(document.querySelectorAll('.dept-check:checked')).map(cb => cb.value);
        const years = Array.from(document.querySelectorAll('.year-check:checked')).map(cb => cb.value);

        if (!name || !start || !end) return this.notify("Please fill in all required fields", "error");
        if (this.state.userOrgName !== 'HERO Org' && depts.length === 0) return this.notify("Please select at least one department", "error");
        if (years.length === 0) return this.notify("Please select at least one year level", "error");
        if (this.checkConflicts(start, end)) return this.notify("Schedule conflict detected", "error");

        try {
            const payload = { 
                event_name: name, description: desc, start_time: start, end_time: end, 
                organization_id: this.state.userOrgId, target_departments: depts, target_year_levels: years 
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
            const themeClass = this.state.isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white' : 'bg-white border-slate-100 shadow-sm';
            return `<div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' class="${themeClass} cursor-pointer rounded-[2rem] p-8 group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative animate-in fade-in slide-in-from-bottom-4" style="animation-delay: ${i * 40}ms">
                <div class="flex justify-between items-start mb-6">
                    <div class="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ev.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}">${ev.status}</div>
                    <div class="flex items-center gap-2 bg-blue-50/50 px-3 py-1 rounded-full"><span class="text-[10px] font-black text-blue-600">${ev.inquiryCount}</span><i data-lucide="message-circle" class="w-3 h-3 text-blue-600"></i></div>
                </div>
                <div class="space-y-2 mb-8">
                    <h3 class="text-xl font-bold tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">${ev.event_name}</h3>
                    <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${ev.description || 'No description provided.'}</p>
                </div>
                <div class="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div class="flex items-center gap-2 text-slate-500"><i data-lucide="calendar" class="w-3.5 h-3.5"></i><span class="text-[11px] font-semibold">${new Date(ev.start_time).toLocaleDateString()}</span></div>
                    <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></div>
                </div></div>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate(theme) {
        const isHero = this.state.userOrgName === 'HERO Org';
        const depts = ["Education Dept", "Industrial Technology Dept.", "All Dept"];
        const years = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "All Year"];

        return `<div class="${theme} min-h-screen transition-colors duration-500 font-sans p-6 md:p-10">
            <style>
                .dark-theme{background:#0a0a0a;color:#eee} .light-theme{background:#f8fafc;color:#1e293b}
                .input-field{background:${this.state.isDarkMode ? '#1a1a1a' : '#ffffff'}; border:1px solid ${this.state.isDarkMode ? '#333' : '#e2e8f0'}; transition: all 0.2s ease;}
                .input-field:focus{border-color:#3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);}
                .custom-scrollbar::-webkit-scrollbar{width:5px} .custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}
                .glass-card{background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.3);}
            </style>
            
            <div class="max-w-7xl mx-auto space-y-10">
                <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">${this.state.userRole}</span>
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${this.state.userOrgName}</span>
                        </div>
                        <h1 class="text-5xl font-black tracking-tighter">Event <span class="text-blue-600">HQ</span></h1>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div class="relative flex-grow max-w-md">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                            <input type="text" id="ev-search" value="${this.state.searchTerm}" placeholder="Find an event..." class="w-full pl-11 pr-4 py-4 rounded-2xl input-field text-sm outline-none shadow-sm">
                        </div>
                        <button id="theme-toggle" class="p-4 rounded-2xl input-field hover:bg-slate-50 shadow-sm"><i data-lucide="${this.state.isDarkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i></button>
                        ${(this.state.userRole.includes('admin')) ? `<button id="btn-add-event" class="px-8 py-4 bg-blue-600 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-2 uppercase tracking-wider"><i data-lucide="plus" class="w-4 h-4"></i> Create</button>` : ''}
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center py-4 border-b border-slate-200/60 gap-4">
                    <div class="flex p-1 bg-slate-200/50 rounded-2xl w-full md:w-auto">
                        ${['all', 'active', 'upcoming', 'completed'].map(f => `<button data-filter="${f}" class="filter-tab flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-bold capitalize transition-all ${this.state.currentFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${f}</button>`).join('')}
                    </div>
                    <div id="event-stats" class="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-4 py-2 rounded-full">Syncing...</div>
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
            </div>
            
            <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4 overflow-hidden">
                <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onclick="eventsModule.closeModal('modal-event')"></div>
                <div class="relative bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl scale-in-center">
                    <div class="px-10 py-8 border-b flex justify-between items-center bg-slate-50/50">
                        <div><h2 id="modal-title" class="text-2xl font-black tracking-tight">New Event</h2><p class="text-xs text-slate-400 font-medium">Define your organization's next big milestone.</p></div>
                        <button id="close-ev-modal" class="p-3 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-400 hover:text-slate-900"><i data-lucide="x" class="w-6 h-6"></i></button>
                    </div>
                    <div class="overflow-y-auto p-10 custom-scrollbar">
                        <div class="grid md:grid-cols-2 gap-12">
                            <div class="space-y-6">
                                <div class="group">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-blue-600 transition-colors">Event Identity</label>
                                    <input type="text" id="new-ev-name" placeholder="Name your event" class="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold">
                                </div>
                                <div>
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Mission & Details</label>
                                    <textarea id="new-ev-desc" rows="4" placeholder="What is this event about?" class="w-full p-5 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"></textarea>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div><label class="text-[10px] font-black text-slate-400 uppercase mb-2 block">Starts</label><input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"></div>
                                    <div><label class="text-[10px] font-black text-slate-400 uppercase mb-2 block">Ends</label><input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"></div>
                                </div>
                            </div>
                            <div class="space-y-6">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Invitation Scope</label>
                                ${!isHero ? `<div class="p-6 bg-blue-50/30 rounded-[2rem] border border-blue-100">
                                    <p class="text-[10px] font-black text-blue-600 mb-4 uppercase tracking-widest flex items-center gap-2"><i data-lucide="layers" class="w-3 h-3"></i> Targeted Departments</p>
                                    <div class="grid grid-cols-1 gap-2">${depts.map(d => `<label class="flex items-center gap-3 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-200 transition-all group"><input type="checkbox" value="${d}" class="dept-check w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-xs font-bold text-slate-600 group-hover:text-blue-700">${d}</span></label>`).join('')}</div>
                                </div>` : ''}
                                <div class="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                    <p class="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2"><i data-lucide="graduation-cap" class="w-3 h-3"></i> Year Level Access</p>
                                    <div class="grid grid-cols-2 gap-2">${years.map(y => `<label class="flex items-center gap-3 p-3 bg-white/60 rounded-xl cursor-pointer hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-200 transition-all group"><input type="checkbox" value="${y}" class="year-check w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-xs font-bold text-slate-600 group-hover:text-blue-700">${y}</span></label>`).join('')}</div>
                                </div>
                                <div id="conflict-engine" class="p-5 bg-emerald-50 rounded-2xl flex items-center justify-between text-emerald-700 border border-emerald-100">
                                    <div class="flex items-center gap-3"><i data-lucide="check-circle" class="w-5 h-5"></i><p id="conflict-msg" class="text-xs font-black uppercase tracking-tighter">Ready for Launch</p></div>
                                </div>
                                <button id="save-ev-btn" class="w-full py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 shadow-xl hover:shadow-blue-200 transition-all uppercase tracking-widest">Execute Plan</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4"><div class="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"></div><div class="relative bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                <div class="p-10 overflow-y-auto custom-scrollbar space-y-8">
                    <div class="flex justify-between items-start"><div class="space-y-1"><h2 id="detail-title" class="text-4xl font-black tracking-tight text-slate-900"></h2><p id="detail-date" class="text-blue-600 font-bold text-xs uppercase tracking-widest"></p></div><button onclick="document.getElementById('modal-event-detail').classList.add('hidden')" class="p-2 rounded-full hover:bg-slate-100"><i data-lucide="x" class="w-6 h-6 text-slate-400"></i></button></div>
                    <div class="grid md:grid-cols-5 gap-10">
                        <div class="md:col-span-3 space-y-6"><p id="detail-desc" class="text-slate-500 leading-relaxed text-lg"></p><div id="qr-container" class="hidden p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center"><div id="qr-code-img" class="mb-4 inline-block"></div><p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Official Inquiry Access</p></div><button id="btn-generate-qr" class="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Generate Smart QR</button></div>
                        <div class="md:col-span-2 space-y-4"><div class="flex items-center justify-between"><h4 class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inquiry Stream</h4><span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded">LIVE</span></div><div id="inquiry-list" class="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2"></div></div>
                    </div>
                    <div class="flex gap-4 pt-8 border-t border-slate-100"><button id="btn-edit-active" class="flex-1 py-4 bg-blue-50 text-blue-700 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-100 transition-all">Modify</button><button id="btn-delete-active" class="px-8 py-4 text-red-500 font-black uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all">Archive</button></div>
                </div>
            </div></div></div>`;
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
        engine.className = isConflict ? "p-5 bg-red-50 rounded-2xl flex items-center justify-between text-red-700 border border-red-100 shadow-sm" : "p-5 bg-emerald-50 rounded-2xl flex items-center justify-between text-emerald-700 border border-emerald-100 shadow-sm";
        msg.innerText = isConflict ? "Schedule Conflict" : "Slot Available";
    },

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        document.getElementById('detail-title').innerText = event.event_name;
        document.getElementById('detail-desc').innerText = event.description || 'No description provided.';
        document.getElementById('detail-date').innerText = `${new Date(event.start_time).toLocaleDateString()} — ${new Date(event.end_time).toLocaleDateString()}`;
        document.getElementById('qr-container').classList.add('hidden');
        document.getElementById('modal-event-detail').classList.remove('hidden');
        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        const list = document.getElementById('inquiry-list');
        const { data } = await supabase.from('event_inquiries').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        if (!data || data.length === 0) { list.innerHTML = `<div class="p-6 bg-slate-50 rounded-2xl text-center"><p class="text-[10px] font-black text-slate-400 uppercase italic">Silence is golden.</p></div>`; return; }
        list.innerHTML = data.map(iq => `<div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all"><span class="text-[10px] font-black text-blue-500 uppercase tracking-widest">ID: ${iq.student_id}</span><p class="text-xs text-slate-600 mt-2 font-medium">${iq.question_1 || 'General Question'}</p></div>`).join('');
    },

    generateQR(eventId) {
        const url = `${window.location.href.split('index.html')[0]}ask.html?id=${eventId}`;
        document.getElementById('qr-code-img').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}" class="mx-auto rounded-[1.5rem] shadow-lg border-4 border-white">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    openEditMode() {
        const ev = this.state.selectedEvent; this.state.isEditMode = true; 
        this.closeModal('modal-event-detail');
        this.resetForm();
        document.getElementById('modal-title').innerText = "Update Operation";
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description || '';
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        if (ev.target_departments) ev.target_departments.forEach(d => { const cb = document.querySelector(`.dept-check[value="${d}"]`); if(cb) cb.checked = true; });
        if (ev.target_year_levels) ev.target_year_levels.forEach(y => { const cb = document.querySelector(`.year-check[value="${y}"]`); if(cb) cb.checked = true; });
        document.getElementById('modal-event').classList.remove('hidden');
    },

    closeModal(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow = 'auto'; },
    resetForm() { 
        ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ''; }); 
        document.querySelectorAll('.dept-check, .year-check').forEach(cb => cb.checked = false);
    },
    notify(msg, type) { 
        const style = type === 'success' ? 'background: #10b981; color: white;' : 'background: #ef4444; color: white;';
        console.log(`%c ${type.toUpperCase()}: ${msg} `, style);
        alert(`${type.toUpperCase()}: ${msg}`); 
    }
};
