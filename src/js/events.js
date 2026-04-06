import { supabase } from './auth.js';

export const eventsModule = {
    state: {
        events: [], filteredEvents: [], selectedEvent: null,
        userRole: 'staff', userOrgId: null,
        searchTerm: '', currentFilter: 'all', isLoading: false, isEditMode: false,
        _loadingDialog: null   // FIX #1: track the Swal loading instance
    },

    // ─── Helpers ────────────────────────────────────────────────────────────

    // FIX #5: convert a UTC ISO string to a value safe for datetime-local inputs
    _toLocalInput(iso) {
        const d = new Date(iso);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
    },

    // FIX #11: safely read a form field; throws a clear error if the element is missing
    _fieldVal(id) {
        const el = document.getElementById(id);
        if (!el) throw new Error(`Form element #${id} not found`);
        return el.value;
    },

    // FIX #3: simple HTML escaper used in renderGrid and fetchInquiries
    _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // ─── Bootstrap ──────────────────────────────────────────────────────────

    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles').select('role, organization_id')
                .eq('id', user?.id).single();
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
        } catch (e) { console.error('Auth sync failed', e); }

        container.innerHTML = this.getTemplate();
        await this.fetchEvents();
        this.initEventListeners();

        // FIX #10: always assign (not just when undefined) so hot-reloads work
        window.eventsModule = this;
    },

    // ─── Data ────────────────────────────────────────────────────────────────

    async fetchEvents() {
        this.setLoading(true);
        try {
            let query = supabase
                .from('events').select('*, event_inquiries (id)')
                .order('start_time', { ascending: false });
            if (this.state.userRole !== 'super_admin') {
                query = query.eq('organization_id', this.state.userOrgId);
            }
            const { data, error } = await query;
            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time), end = new Date(ev.end_time);
                const status = now < start ? 'standby' : (now <= end ? 'active' : 'completed');
                return { ...ev, status, inquiryCount: ev.event_inquiries?.length || 0 };
            });

            this.applyFilters();
            this.updateDashboardStats();
            this.renderGrid();
        } catch (error) {
            this.notify(error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    },

    // ─── Permissions ─────────────────────────────────────────────────────────

    can(action) {
        const r = this.state.userRole;
        return {
            manage:     ['super_admin', 'admin'].includes(r),
            attendance: ['super_admin', 'admin', 'attendance_staff'].includes(r),
            finance:    ['super_admin', 'admin', 'finance_staff'].includes(r)
        }[action];
    },

    // ─── CRUD ────────────────────────────────────────────────────────────────

    async deployMission() {
        // FIX #2: enforce role on the call itself, not just the button
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');

        let fields;
        try {
            // FIX #11: safe field reads that surface missing-element errors clearly
            fields = {
                name:  this._fieldVal('new-ev-name'),
                desc:  this._fieldVal('new-ev-desc'),
                start: this._fieldVal('new-ev-start'),
                end:   this._fieldVal('new-ev-end'),
                dept:  this._fieldVal('new-ev-dept'),
                year:  this._fieldVal('new-ev-year'),
            };
        } catch (err) {
            return this.notify(err.message, 'error');
        }

        if (!fields.name || !fields.start || !fields.end)
            return this.notify('Missing required fields', 'error');
        if (new Date(fields.end) <= new Date(fields.start))
            return this.notify('End time must be after start time', 'error');
        if (this.checkConflicts(fields.start, fields.end))
            return this.notify('Scheduling conflict detected', 'error');

        const payload = {
            event_name:      fields.name,
            description:     fields.desc,
            start_time:      fields.start,
            end_time:        fields.end,
            organization_id: this.state.userOrgId,
            target_dept:     fields.dept,
            target_year:     fields.year,
        };

        const req = this.state.isEditMode
            ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id)
            : supabase.from('events').insert([payload]);

        const { error } = await req;
        if (error) return this.notify(error.message, 'error');

        this.notify(this.state.isEditMode ? 'Event Updated' : 'Event Published', 'success');
        this.closeModal('modal-event');
        await this.fetchEvents();
    },

    async deleteEvent(id) {
        // FIX #2: enforce role on the call itself
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');

        const result = await Swal.fire({
            title: 'Remove Event?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Yes, remove it',
            color: '#0f172a',
            background: '#ffffff',
            customClass: {
                popup:         'rounded-[2rem]',
                confirmButton: 'rounded-xl px-6 py-3 font-bold',
                cancelButton:  'rounded-xl px-6 py-3 font-bold text-slate-500',
            },
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) return this.notify(error.message, 'error');
            this.notify('Event removed', 'success');
            this.closeModal('modal-event-detail');
            await this.fetchEvents();
        }
    },

    // ─── Rendering ───────────────────────────────────────────────────────────

    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;

        if (!this.state.filteredEvents.length) {
            grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-40 font-bold uppercase tracking-widest text-sm">No matches found</div>`;
            return;
        }

        // FIX #3: store events by id; cards use data-event-id — no inline JSON
        this._eventMap = {};
        this.state.filteredEvents.forEach(ev => { this._eventMap[ev.id] = ev; });

        grid.innerHTML = this.state.filteredEvents.map((ev, i) => `
            <div data-event-id="${ev.id}"
                 class="event-card bg-white border border-slate-100 cursor-pointer rounded-[2rem] p-6 group hover:shadow-2xl hover:shadow-indigo-100/40 transition-all animate-in fade-in slide-in-from-bottom-2"
                 style="animation-delay: ${i * 40}ms">
                <div class="flex justify-between mb-5">
                    <div class="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ev.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}">
                        ${ev.status === 'active' ? '<span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>' : ''}
                        ${ev.status === 'standby' ? 'Upcoming' : ev.status}
                    </div>
                    <div class="flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full text-indigo-600 font-bold text-[10px]">
                        ${ev.inquiryCount} <i data-lucide="message-circle" class="w-3 h-3"></i>
                    </div>
                </div>
                <h3 class="text-xl font-bold line-clamp-1 group-hover:text-indigo-600 transition-colors">${this._escapeHtml(ev.event_name)}</h3>
                <p class="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">${this._escapeHtml(ev.description || 'Campus event')}</p>
                <div class="flex justify-between pt-5 mt-5 border-t border-slate-50 items-center">
                    <span class="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                        ${new Date(ev.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span class="text-[10px] font-black text-indigo-500 uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Open <i data-lucide="chevron-right" class="w-3 h-3"></i>
                    </span>
                </div>
            </div>`).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    getTemplate() {
        return `
            <div class="p-6 md:p-12 min-h-screen bg-[#FDFDFF]">
                <div class="max-w-7xl mx-auto space-y-10">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                           <h1 class="text-5xl font-black tracking-tighter text-slate-900">Campus <span class="text-indigo-600">Events</span></h1>
                           <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">${this.state.userRole.replace('_', ' ')} Access</p>
                        </div>
                        ${this.can('manage') ? `<button id="btn-add-event" class="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-indigo-600 transition-all flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i> Create Event</button>` : ''}
                    </div>

                    <div class="flex flex-wrap gap-4 items-center bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <div class="relative flex-1 min-w-[240px]">
                            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"></i>
                            <input type="text" id="ev-search" placeholder="Search events..." class="w-full pl-12 pr-4 py-3 rounded-xl text-sm outline-none bg-slate-50/50 focus:bg-white transition-all">
                        </div>
                        <div class="flex bg-slate-100 p-1 rounded-xl">
                            ${['all', 'active', 'standby', 'completed'].map(f => `
                                <button data-filter="${f}" class="filter-tab px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${this.state.currentFilter === f ? 'bg-white text-indigo-600 shadow-sm rounded-lg' : 'text-slate-400 hover:text-slate-600'}">${f}</button>`
                            ).join('')}
                        </div>
                        <div id="event-stats" class="px-4 text-[10px] font-black text-slate-300 uppercase tracking-widest hidden md:block"></div>
                    </div>

                    <!-- FIX #7: skeleton loader shown while data fetches -->
                    <div id="events-loading" style="display:none" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        ${Array(3).fill(`<div class="bg-slate-100 animate-pulse rounded-[2rem] h-52"></div>`).join('')}
                    </div>
                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
                </div>

                <!-- Create / Edit modal -->
                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md transition-all">
                    <!-- FIX #8: clicking the backdrop closes the modal -->
                    <div class="modal-backdrop absolute inset-0" data-close-modal="modal-event"></div>
                    <div class="bg-white rounded-[3rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 relative">
                        <div class="p-10 md:p-14">
                            <h2 id="modal-title" class="text-3xl font-black text-slate-900 mb-8">Event <span class="text-indigo-600">Planner</span></h2>
                            <div class="grid md:grid-cols-2 gap-10">
                                <div class="space-y-6">
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1">Event Name</label>
                                        <input type="text" id="new-ev-name" class="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-100 outline-none font-medium">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label>
                                        <textarea id="new-ev-desc" class="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-100 outline-none text-sm" rows="3"></textarea>
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="space-y-2">
                                            <label class="text-[10px] font-black uppercase text-slate-400 ml-1">Start</label>
                                            <input type="datetime-local" id="new-ev-start" class="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-xs font-bold text-slate-600">
                                        </div>
                                        <div class="space-y-2">
                                            <label class="text-[10px] font-black uppercase text-slate-400 ml-1">End</label>
                                            <input type="datetime-local" id="new-ev-end" class="w-full p-3 bg-slate-50 rounded-xl border-none outline-none text-xs font-bold text-slate-600">
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-6 bg-slate-50 p-8 rounded-[2.5rem]">
                                    <h4 class="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-2">Target Students</h4>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1">Department</label>
                                        <select id="new-ev-dept" class="w-full p-4 bg-white rounded-2xl border-none outline-none font-bold text-slate-600 text-sm shadow-sm">
                                            <option value="Education Dept">Education Dept</option>
                                            <option value="Industrial Technology Dept">Industrial Technology Dept</option>
                                            <option value="Other Dept">Other Dept</option>
                                            <option value="All Dept">All Dept</option>
                                        </select>
                                    </div>
                                    <div class="space-y-2">
                                        <label class="text-[10px] font-black uppercase text-slate-400 ml-1">Year Level</label>
                                        <select id="new-ev-year" class="w-full p-4 bg-white rounded-2xl border-none outline-none font-bold text-slate-600 text-sm shadow-sm">
                                            <option value="All Year">All Year Levels</option>
                                            <option value="1st Year">1st Year</option>
                                            <option value="2nd Year">2nd Year</option>
                                            <option value="3rd Year">3rd Year</option>
                                            <option value="4th Year">4th Year</option>
                                        </select>
                                    </div>
                                    <div class="pt-6 flex flex-col gap-3">
                                        <button id="save-ev-btn" class="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:scale-[1.02] transition-all">Confirm & Publish</button>
                                        <!-- FIX #9: cancel uses dirty-check guard via confirmCancelForm() -->
                                        <button id="btn-cancel-event" class="w-full py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors">Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Detail modal -->
                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl">
                    <!-- FIX #8: backdrop click closes detail modal too -->
                    <div class="modal-backdrop absolute inset-0" data-close-modal="modal-event-detail"></div>
                    <div class="bg-white rounded-[3.5rem] w-full max-w-5xl p-10 md:p-14 max-h-[90vh] overflow-y-auto shadow-2xl relative">
                        <div class="flex justify-between items-start mb-10">
                            <div class="space-y-2">
                                <div class="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest">Campus Event Details</div>
                                <h2 id="detail-title" class="text-4xl font-black text-slate-900 tracking-tight"></h2>
                            </div>
                            <button id="btn-close-detail" class="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><i data-lucide="x"></i></button>
                        </div>

                        <div class="grid md:grid-cols-3 gap-12">
                            <div class="md:col-span-2 space-y-8">
                                <div class="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                                    <h4 class="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">About this event</h4>
                                    <p id="detail-desc" class="text-slate-600 leading-relaxed text-sm"></p>
                                </div>
                                <div id="qr-container" class="hidden p-8 bg-indigo-600 rounded-[2rem] text-center text-white shadow-xl shadow-indigo-100 flex flex-col gap-6">
                                    <div>
                                        <div id="qr-code-img" class="bg-white p-4 rounded-3xl inline-block mb-2 shadow-inner"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="space-y-6">
                                <div>
                                    <h4 class="text-[10px] font-black uppercase text-indigo-600 mb-4 tracking-widest">Student Inquiries</h4>
                                    <div id="inquiry-list" class="space-y-3"></div>
                                </div>
                                <div class="pt-6 border-t border-slate-50 space-y-3">
                                    <button id="btn-generate-qr" class="w-full py-4 bg-white border border-slate-200 text-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2"><i data-lucide="qr-code" class="w-4 h-4"></i> Generate QRs</button>
                                    <button id="btn-edit-active" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">Edit Details</button>
                                    <button id="btn-delete-active" class="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all">Cancel Event</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    // ─── Modals ──────────────────────────────────────────────────────────────

    async openDetailModal(event) {
        this.state.selectedEvent = event;
        const q = id => document.getElementById(id);
        q('detail-title').innerText = event.event_name;
        q('detail-desc').innerText  = event.description || 'No description provided.';
        q('qr-container').classList.add('hidden');
        q('btn-edit-active').style.display   = this.can('manage')     ? 'block' : 'none';
        q('btn-delete-active').style.display = this.can('manage')     ? 'block' : 'none';
        q('btn-generate-qr').style.display   = this.can('attendance') ? 'flex'  : 'none';
        q('modal-event-detail').classList.remove('hidden');
        await this.fetchInquiries(event.id);
        if (window.lucide) window.lucide.createIcons();
    },

    closeModal(id) {
        document.getElementById(id)?.classList.add('hidden');
    },

    // FIX #9: guard cancel with a dirty-check confirmation
    async confirmCancelForm() {
        const hasData = ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end']
            .some(id => document.getElementById(id)?.value?.trim());

        if (!hasData) return this.closeModal('modal-event');

        const result = await Swal.fire({
            title: 'Discard changes?',
            text: 'Your unsaved changes will be lost.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Yes, discard',
            color: '#0f172a',
            background: '#ffffff',
            customClass: {
                popup:         'rounded-[2rem]',
                confirmButton: 'rounded-xl px-6 py-3 font-bold',
                cancelButton:  'rounded-xl px-6 py-3 font-bold text-slate-500',
            },
        });
        if (result.isConfirmed) this.closeModal('modal-event');
    },

    // ─── Inquiries ───────────────────────────────────────────────────────────

    async fetchInquiries(eventId) {
        const list = document.getElementById('inquiry-list');
        if (!list) return;

        // FIX #12: show "not authorized" instead of silently leaving blank
        if (!this.can('finance') && !this.can('manage')) {
            list.innerHTML = '<p class="text-center text-slate-300 text-[10px] font-bold py-8 uppercase tracking-widest">Not authorized to view inquiries</p>';
            return;
        }

        const { data, error } = await supabase
            .from('event_inquiries').select('*')
            .eq('event_id', eventId).order('created_at', { ascending: false });

        if (error) {
            list.innerHTML = `<p class="text-center text-red-300 text-[10px] font-bold py-8 uppercase tracking-widest">Failed to load inquiries</p>`;
            return;
        }

        list.innerHTML = data?.length
            ? data.map(iq => `
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                    <div class="text-[9px] font-black text-indigo-600 mb-1">STUDENT #${this._escapeHtml(String(iq.student_id))}</div>
                    <p class="text-[11px] text-slate-500 font-medium leading-tight">${this._escapeHtml(iq.question_1)}</p>
                </div>`).join('')
            : '<p class="text-center text-slate-300 text-[10px] font-bold py-8 uppercase tracking-widest">No inquiries</p>';
    },

    // ─── Event Listeners ─────────────────────────────────────────────────────

    initEventListeners() {
        const q = id => document.getElementById(id);

        if (q('btn-add-event')) {
            q('btn-add-event').onclick = () => {
                this.state.isEditMode = false;
                this.resetForm();
                q('modal-event').classList.remove('hidden');
            };
        }

        if (q('ev-search')) {
            q('ev-search').oninput = e => {
                this.state.searchTerm = e.target.value;
                this.applyFilters();
                this.renderGrid();
            };
        }

        if (q('save-ev-btn'))      q('save-ev-btn').onclick      = () => this.deployMission();
        if (q('btn-edit-active'))  q('btn-edit-active').onclick  = () => this.openEditMode();
        if (q('btn-close-detail')) q('btn-close-detail').onclick = () => this.closeModal('modal-event-detail');

        if (q('btn-delete-active')) {
            q('btn-delete-active').onclick = () => this.deleteEvent(this.state.selectedEvent.id);
        }
        if (q('btn-generate-qr')) {
            q('btn-generate-qr').onclick = () => this.generateQR(this.state.selectedEvent.id);
        }

        // FIX #9: cancel button now uses the dirty-check guard
        if (q('btn-cancel-event')) {
            q('btn-cancel-event').onclick = () => this.confirmCancelForm();
        }

        // FIX #8: backdrop click closes whichever modal owns the backdrop
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.onclick = () => this.closeModal(backdrop.dataset.closeModal);
        });

        // FIX #3: delegated click on event cards — no inline JSON or global onclick
        const grid = q('events-grid');
        if (grid) {
            grid.addEventListener('click', e => {
                const card = e.target.closest('.event-card');
                if (!card) return;
                const ev = this._eventMap?.[card.dataset.eventId];
                if (ev) this.openDetailModal(ev);
            });
        }

        document.querySelectorAll('.filter-tab').forEach(t => {
            t.onclick = () => {
                this.state.currentFilter = t.dataset.filter;
                this.applyFilters();
                this.renderGrid();
                document.querySelectorAll('.filter-tab').forEach(btn =>
                    btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm', 'rounded-lg'));
                t.classList.add('bg-white', 'text-indigo-600', 'shadow-sm', 'rounded-lg');
            };
        });
    },

    // ─── QR ──────────────────────────────────────────────────────────────────

    generateQR(eventId) {
        // FIX #6: compare userOrgId (not eventId) against the master org constant
        const MASTER_ORG_ID = '3c435a81-16c0-4472-92fd-3ff5949fc9ed';
        const baseUrl  = window.location.href.split('index.html')[0];
        const finalUrl = this.state.userOrgId === MASTER_ORG_ID
            ? `${baseUrl}general.html`
            : `${baseUrl}ask.html?id=${eventId}`;

        const qrImg    = document.getElementById('qr-code-img');
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(finalUrl)}`;
        qrImg.innerHTML = `<img src="${qrApiUrl}" alt="QR Code" class="mx-auto shadow-sm rounded-lg">`;
        document.getElementById('qr-container').classList.remove('hidden');
    },

    // ─── Edit Mode ───────────────────────────────────────────────────────────

    openEditMode() {
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');
        const ev = this.state.selectedEvent;
        this.state.isEditMode = true;
        this.closeModal('modal-event-detail');
        document.getElementById('modal-title').innerHTML  = 'Update <span class="text-indigo-600">Event</span>';
        document.getElementById('new-ev-name').value      = ev.event_name;
        document.getElementById('new-ev-desc').value      = ev.description ?? '';
        // FIX #5: convert UTC timestamps to local time before setting input value
        document.getElementById('new-ev-start').value     = this._toLocalInput(ev.start_time);
        document.getElementById('new-ev-end').value       = this._toLocalInput(ev.end_time);
        if (ev.target_dept) document.getElementById('new-ev-dept').value = ev.target_dept;
        if (ev.target_year) document.getElementById('new-ev-year').value = ev.target_year;
        document.getElementById('modal-event').classList.remove('hidden');
    },

    // ─── Filters & Stats ─────────────────────────────────────────────────────

    applyFilters() {
        let f = this.state.events;
        if (this.state.searchTerm)
            f = f.filter(e => e.event_name.toLowerCase().includes(this.state.searchTerm.toLowerCase()));
        if (this.state.currentFilter !== 'all')
            f = f.filter(e => e.status === this.state.currentFilter);
        this.state.filteredEvents = f;
    },

    updateDashboardStats() {
        const s = document.getElementById('event-stats');
        if (s) s.innerText = `${this.state.events.filter(e => e.status === 'active').length} Active • ${this.state.events.length} Total`;
    },

    // ─── Loading ─────────────────────────────────────────────────────────────

    // FIX #1 & #7: replaced broken Swal.showLoading() with a skeleton loader
    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        const grid   = document.getElementById('events-grid');
        const skelly = document.getElementById('events-loading');
        if (grid)   grid.style.display   = isLoading ? 'none' : '';
        if (skelly) skelly.style.display = isLoading ? ''     : 'none';
    },

    // ─── Notifications ───────────────────────────────────────────────────────

    notify(m, t) {
        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
        }).fire({ icon: t, title: m });
    },

    // ─── Conflict Check ──────────────────────────────────────────────────────

    // FIX #4: also filter by org so cross-org events never falsely conflict
    checkConflicts(s, e) {
        return this.state.events.some(ev =>
            ev.organization_id === this.state.userOrgId &&
            this.state.selectedEvent?.id !== ev.id &&
            new Date(s) < new Date(ev.end_time) &&
            new Date(e) > new Date(ev.start_time)
        );
    },

    // ─── Form Reset ──────────────────────────────────────────────────────────

    resetForm() {
        document.getElementById('modal-title').innerHTML = 'Event <span class="text-indigo-600">Planner</span>';
        ['name', 'desc', 'start', 'end'].forEach(f => {
            const el = document.getElementById(`new-ev-${f}`);
            if (el) el.value = '';
        });
        const dept = document.getElementById('new-ev-dept');
        const year = document.getElementById('new-ev-year');
        if (dept) dept.selectedIndex = 0;
        if (year) year.selectedIndex = 0;
    },
};
