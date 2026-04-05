import { supabase } from './auth.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

/** Convert a UTC ISO string to a value suitable for datetime-local inputs */
const toLocalInput = (iso) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
};

/** Safely read .value from a DOM element; returns '' if element not found */
const val = (id) => $(id)?.value ?? '';

/** Escape a string for safe use inside an HTML attribute */
const escAttr = (str) =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

// ─── Module ───────────────────────────────────────────────────────────────────

export const eventsModule = {
    state: {
        events: [],
        filteredEvents: [],
        selectedEvent: null,
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all',
        isLoading: false,
        isEditMode: false,
    },

    // ── Auth ──────────────────────────────────────────────────────────────────

    async syncAuth() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, organization_id')
                .eq('id', user?.id)
                .single();
            this.state.userRole  = profile?.role           || 'staff';
            this.state.userOrgId = profile?.organization_id || null;
        } catch (e) {
            console.error('Auth sync failed', e);
        }
    },

    can(action) {
        const r = this.state.userRole;
        const map = {
            manage:     ['super_admin', 'admin'].includes(r),
            attendance: ['super_admin', 'admin', 'attendance_staff'].includes(r),
            finance:    ['super_admin', 'admin', 'finance_staff'].includes(r),
        };
        return map[action] ?? false;
    },

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    async render() {
        const container = $('mod-events') || $('mod-dashboard');
        if (!container) return;

        await this.syncAuth();
        container.innerHTML = this.getTemplate();
        this.initEventListeners();
        await this.fetchEvents();

        // Make accessible globally for delegated onclick handlers
        window.eventsModule = this;
    },

    // ── Data ──────────────────────────────────────────────────────────────────

    async fetchEvents() {
        this.setLoading(true);
        try {
            let query = supabase
                .from('events')
                .select('*, event_inquiries(id)')
                .order('start_time', { ascending: false });

            if (this.state.userRole !== 'super_admin') {
                query = query.eq('organization_id', this.state.userOrgId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map((ev) => {
                const start = new Date(ev.start_time);
                const end   = new Date(ev.end_time);
                const status =
                    now < start ? 'standby' :
                    now <= end  ? 'active'  : 'completed';
                return { ...ev, status, inquiryCount: ev.event_inquiries?.length || 0 };
            });

            this.applyFilters();
            this.updateStats();
            this.renderGrid();
        } catch (err) {
            this.notify(err.message, 'error');
        } finally {
            this.setLoading(false);
        }
    },

    applyFilters() {
        let f = [...this.state.events];
        if (this.state.searchTerm) {
            const q = this.state.searchTerm.toLowerCase();
            f = f.filter((e) => e.event_name.toLowerCase().includes(q));
        }
        if (this.state.currentFilter !== 'all') {
            f = f.filter((e) => e.status === this.state.currentFilter);
        }
        this.state.filteredEvents = f;
    },

    // ── CRUD ──────────────────────────────────────────────────────────────────

    async deployMission() {
        // FIX #2 — enforce role check before any DB call
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');

        // FIX #11 — validate DOM elements exist before reading
        const requiredIds = ['new-ev-name', 'new-ev-start', 'new-ev-end'];
        for (const id of requiredIds) {
            if (!$(id)) return this.notify(`UI error: missing field #${id}`, 'error');
        }

        const fields = {
            name: val('new-ev-name'),
            desc: val('new-ev-desc'),
            start: val('new-ev-start'),
            end:   val('new-ev-end'),
            dept:  val('new-ev-dept'),
            year:  val('new-ev-year'),
        };

        if (!fields.name || !fields.start || !fields.end) {
            return this.notify('Please fill in all required fields', 'error');
        }
        if (new Date(fields.start) >= new Date(fields.end)) {
            return this.notify('End time must be after start time', 'error');
        }
        if (this.checkConflicts(fields.start, fields.end)) {
            return this.notify('This time slot conflicts with an existing event', 'error');
        }

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

        this.notify(this.state.isEditMode ? 'Event updated!' : 'Event published!', 'success');
        this.closeModal('modal-event');
        await this.fetchEvents();
    },

    async deleteEvent(id) {
        // FIX #2 — enforce role check
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');

        const result = await Swal.fire({
            title: 'Remove this event?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
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

    checkConflicts(start, end) {
        const s = new Date(start);
        const e = new Date(end);
        return this.state.events.some((ev) => {
            // Skip the event being edited
            if (this.state.isEditMode && this.state.selectedEvent?.id === ev.id) return false;
            return s < new Date(ev.end_time) && e > new Date(ev.start_time);
        });
    },

    // ── Render ────────────────────────────────────────────────────────────────

    renderGrid() {
        const grid = $('events-grid');
        if (!grid) return;

        if (!this.state.filteredEvents.length) {
            grid.innerHTML = `
                <div class="col-span-full ev-empty">
                    <div class="ev-empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                    </div>
                    <p class="ev-empty-title">No events found</p>
                    <p class="ev-empty-sub">Try adjusting your search or filters</p>
                </div>`;
            return;
        }

        // FIX #3 — use data attributes instead of inline JSON in onclick
        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const statusMeta = {
                active:    { label: 'Live',     cls: 'status-active'    },
                standby:   { label: 'Upcoming', cls: 'status-standby'   },
                completed: { label: 'Ended',    cls: 'status-completed' },
            }[ev.status] || { label: ev.status, cls: '' };

            const dateStr = new Date(ev.start_time).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
            });
            const timeStr = new Date(ev.start_time).toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit',
            });

            return `
            <div class="ev-card"
                 data-event-id="${escAttr(ev.id)}"
                 style="animation-delay: ${i * 50}ms"
                 tabindex="0"
                 role="button"
                 aria-label="Open ${escAttr(ev.event_name)}">
                <div class="ev-card-header">
                    <span class="ev-status ${statusMeta.cls}">
                        ${ev.status === 'active' ? '<span class="ev-pulse"></span>' : ''}
                        ${statusMeta.label}
                    </span>
                    ${ev.inquiryCount > 0 ? `
                    <span class="ev-inquiry-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ${ev.inquiryCount}
                    </span>` : ''}
                </div>
                <div class="ev-card-body">
                    <h3 class="ev-card-title">${escAttr(ev.event_name)}</h3>
                    <p class="ev-card-desc">${escAttr(ev.description || 'No description provided.')}</p>
                </div>
                <div class="ev-card-footer">
                    <div class="ev-card-date">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        <span>${dateStr}</span>
                        <span class="ev-card-time">${timeStr}</span>
                    </div>
                    <span class="ev-card-arrow">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </span>
                </div>
                ${ev.target_dept && ev.target_dept !== 'All Dept' ? `<div class="ev-card-tag">${escAttr(ev.target_dept)}</div>` : ''}
            </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    updateStats() {
        const s = $('event-stats');
        if (!s) return;
        const active    = this.state.events.filter((e) => e.status === 'active').length;
        const upcoming  = this.state.events.filter((e) => e.status === 'standby').length;
        const total     = this.state.events.length;
        s.innerHTML = `
            <span class="stat-dot active"></span>${active} live
            &nbsp;·&nbsp;
            <span class="stat-dot standby"></span>${upcoming} upcoming
            &nbsp;·&nbsp;
            ${total} total`;
    },

    // ── Modals ────────────────────────────────────────────────────────────────

    async openDetailModal(event) {
        this.state.selectedEvent = event;

        $('detail-title').textContent = event.event_name;
        $('detail-desc').textContent  = event.description || 'No description provided.';
        $('detail-status').className  = `detail-status-badge ${
            { active: 'status-active', standby: 'status-standby', completed: 'status-completed' }[event.status]
        }`;
        $('detail-status').textContent = event.status === 'standby' ? 'Upcoming' : event.status;

        const startFmt = new Date(event.start_time).toLocaleString(undefined, {
            dateStyle: 'medium', timeStyle: 'short',
        });
        const endFmt = new Date(event.end_time).toLocaleString(undefined, {
            dateStyle: 'medium', timeStyle: 'short',
        });
        $('detail-start').textContent = startFmt;
        $('detail-end').textContent   = endFmt;
        $('detail-dept').textContent  = event.target_dept || '—';
        $('detail-year').textContent  = event.target_year || '—';

        $('qr-container').classList.add('hidden');
        $('qr-code-img').innerHTML = '';

        const canManage = this.can('manage');
        $('btn-edit-active').style.display   = canManage ? 'flex' : 'none';
        $('btn-delete-active').style.display = canManage ? 'flex' : 'none';
        $('btn-generate-qr').style.display   = this.can('attendance') ? 'flex' : 'none';

        $('modal-event-detail').classList.remove('hidden');
        $('modal-event-detail').classList.add('modal-visible');

        await this.fetchInquiries(event.id);
    },

    async fetchInquiries(eventId) {
        const list = $('inquiry-list');
        if (!list) return;

        // FIX #12 — show access message for unauthorized roles
        if (!this.can('finance') && !this.can('manage')) {
            list.innerHTML = `<p class="inquiry-restricted">Inquiry access restricted to finance & admin roles.</p>`;
            return;
        }

        list.innerHTML = `<div class="inquiry-loading">
            <span class="loading-spinner"></span> Loading inquiries…
        </div>`;

        const { data, error } = await supabase
            .from('event_inquiries')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error) {
            list.innerHTML = `<p class="inquiry-restricted">Failed to load inquiries.</p>`;
            return;
        }

        list.innerHTML = data?.length
            ? data.map((iq) => `
                <div class="inquiry-card">
                    <div class="inquiry-id">Student #${escAttr(String(iq.student_id))}</div>
                    <p class="inquiry-question">${escAttr(iq.question_1)}</p>
                </div>`).join('')
            : `<div class="inquiry-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>No inquiries yet</p>
               </div>`;
    },

    openEditMode() {
        if (!this.can('manage')) return this.notify('Unauthorized', 'error');
        const ev = this.state.selectedEvent;
        this.state.isEditMode = true;
        this.closeModal('modal-event-detail');

        $('modal-form-title').textContent = 'Edit Event';
        $('save-ev-btn').textContent      = 'Save Changes';

        $('new-ev-name').value  = ev.event_name    || '';
        $('new-ev-desc').value  = ev.description   || '';
        // FIX #5 — proper timezone-aware conversion
        $('new-ev-start').value = ev.start_time ? toLocalInput(ev.start_time) : '';
        $('new-ev-end').value   = ev.end_time   ? toLocalInput(ev.end_time)   : '';
        if (ev.target_dept) $('new-ev-dept').value = ev.target_dept;
        if (ev.target_year) $('new-ev-year').value = ev.target_year;

        $('modal-event').classList.remove('hidden');
        $('modal-event').classList.add('modal-visible');
    },

    openCreateMode() {
        if (!this.can('manage')) return;
        this.state.isEditMode = false;
        this.resetForm();
        $('modal-event').classList.remove('hidden');
        $('modal-event').classList.add('modal-visible');
    },

    generateQR(eventId) {
        // FIX #6 — compare orgId to orgId, not eventId to orgId
        const MASTER_ORG_ID = '3c435a81-16c0-4472-92fd-3ff5949fc9ed';
        const baseUrl = window.location.href.split('index.html')[0];

        const finalUrl = (this.state.userOrgId === MASTER_ORG_ID)
            ? `${baseUrl}general.html`
            : `${baseUrl}ask.html?id=${encodeURIComponent(eventId)}`;

        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(finalUrl)}`;
        $('qr-code-img').innerHTML = `
            <img src="${qrApiUrl}" alt="QR Code" class="qr-image"
                 onerror="this.parentElement.innerHTML='<p style=\'color:var(--clr-danger)\'>Failed to generate QR</p>'">`;
        $('qr-event-url').textContent = finalUrl;
        $('qr-container').classList.remove('hidden');
    },

    resetForm() {
        $('modal-form-title').textContent = 'Create Event';
        $('save-ev-btn').textContent      = 'Publish Event';
        ['new-ev-name', 'new-ev-desc', 'new-ev-start', 'new-ev-end'].forEach((id) => {
            const el = $(id);
            if (el) el.value = '';
        });
        const dept = $('new-ev-dept');
        const year = $('new-ev-year');
        if (dept) dept.selectedIndex = 0;
        if (year) year.selectedIndex = 0;
    },

    // ── Event Listeners ───────────────────────────────────────────────────────

    initEventListeners() {
        // Create button
        $('btn-add-event')?.addEventListener('click', () => this.openCreateMode());

        // Search
        $('ev-search')?.addEventListener('input', (e) => {
            this.state.searchTerm = e.target.value;
            this.applyFilters();
            this.renderGrid();
        });

        // Clear search
        $('ev-search-clear')?.addEventListener('click', () => {
            $('ev-search').value  = '';
            this.state.searchTerm = '';
            this.applyFilters();
            this.renderGrid();
            $('ev-search').focus();
        });

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                this.state.currentFilter = tab.dataset.filter;
                this.applyFilters();
                this.renderGrid();
                document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });

        // FIX #3 — event delegation instead of inline onclick with JSON
        $('events-grid')?.addEventListener('click', (e) => {
            const card = e.target.closest('.ev-card');
            if (!card) return;
            const ev = this.state.events.find((ev) => ev.id === card.dataset.eventId);
            if (ev) this.openDetailModal(ev);
        });
        $('events-grid')?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.ev-card');
            if (!card) return;
            const ev = this.state.events.find((ev) => ev.id === card.dataset.eventId);
            if (ev) this.openDetailModal(ev);
        });

        // Save event
        $('save-ev-btn')?.addEventListener('click', () => this.deployMission());

        // Detail modal buttons
        $('btn-edit-active')?.addEventListener('click', () => this.openEditMode());
        $('btn-delete-active')?.addEventListener('click', () =>
            this.deleteEvent(this.state.selectedEvent.id));
        $('btn-generate-qr')?.addEventListener('click', () =>
            this.generateQR(this.state.selectedEvent.id));

        // FIX #8 — backdrop click closes modals
        ['modal-event', 'modal-event-detail'].forEach((id) => {
            $(id)?.addEventListener('click', (e) => {
                if (e.target === $(id)) this.closeModal(id);
            });
        });

        // FIX #9 — cancel with dirty-check confirmation
        $('btn-cancel-form')?.addEventListener('click', () => this.confirmCancel());

        // Close detail modal
        $('btn-close-detail')?.addEventListener('click', () =>
            this.closeModal('modal-event-detail'));

        // Escape key closes any open modal
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!$('modal-event-detail')?.classList.contains('hidden'))
                this.closeModal('modal-event-detail');
            else if (!$('modal-event')?.classList.contains('hidden'))
                this.confirmCancel();
        });
    },

    async confirmCancel() {
        const isDirty = val('new-ev-name') || val('new-ev-desc') || val('new-ev-start');
        if (!isDirty) return this.closeModal('modal-event');

        const { isConfirmed } = await Swal.fire({
            title: 'Discard changes?',
            text: 'Your unsaved changes will be lost.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, discard',
            cancelButtonText: 'Keep editing',
            confirmButtonColor: '#ef4444',
            background: '#ffffff',
            color: '#0f172a',
            customClass: {
                popup:         'rounded-[2rem]',
                confirmButton: 'rounded-xl px-6 py-3 font-bold',
                cancelButton:  'rounded-xl px-6 py-3 font-bold text-slate-500',
            },
        });
        if (isConfirmed) this.closeModal('modal-event');
    },

    // ── Loading ───────────────────────────────────────────────────────────────

    setLoading(isLoading) {
        this.state.isLoading = isLoading;
        const grid     = $('events-grid');
        const skeleton = $('grid-skeleton');

        if (isLoading) {
            if (grid)     grid.style.display    = 'none';
            if (skeleton) skeleton.style.display = 'grid';
        } else {
            if (grid)     grid.style.display    = '';
            if (skeleton) skeleton.style.display = 'none';
        }
    },

    // ── Utilities ─────────────────────────────────────────────────────────────

    closeModal(id) {
        const el = $(id);
        if (!el) return;
        el.classList.add('hidden');
        el.classList.remove('modal-visible');
    },

    notify(message, type = 'info') {
        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            customClass: { popup: 'ev-toast' },
        }).fire({ icon: type, title: message });
    },

    // ── Templates ─────────────────────────────────────────────────────────────

    getTemplate() {
        const roleBadge = this.state.userRole.replace(/_/g, ' ');

        return `
        <style>
            /* ── Reset & Tokens ── */
            :root {
                --clr-ink:       #0d0f14;
                --clr-ink2:      #3a3d47;
                --clr-muted:     #8a8fa3;
                --clr-border:    #e8eaf0;
                --clr-surface:   #ffffff;
                --clr-bg:        #f4f5f8;
                --clr-accent:    #4f46e5;
                --clr-accent-lt: #eeeeff;
                --clr-active:    #16a34a;
                --clr-active-lt: #dcfce7;
                --clr-standby:   #d97706;
                --clr-standby-lt:#fef3c7;
                --clr-done:      #6b7280;
                --clr-done-lt:   #f3f4f6;
                --clr-danger:    #dc2626;
                --clr-danger-lt: #fee2e2;
                --radius-sm:     8px;
                --radius-md:     14px;
                --radius-lg:     22px;
                --radius-xl:     32px;
                --shadow-card:   0 2px 12px 0 rgba(15,18,36,.06), 0 1px 3px 0 rgba(15,18,36,.04);
                --shadow-hover:  0 8px 30px 0 rgba(79,70,229,.12), 0 2px 8px 0 rgba(15,18,36,.08);
                --shadow-modal:  0 24px 80px 0 rgba(15,18,36,.18);
                --font-ui:       'DM Sans', system-ui, sans-serif;
            }

            /* ── Page Shell ── */
            .ev-page {
                min-height: 100vh;
                background: var(--clr-bg);
                font-family: var(--font-ui);
                padding: 40px 24px 80px;
            }
            .ev-inner { max-width: 1200px; margin: 0 auto; }

            /* ── Header ── */
            .ev-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 32px;
                flex-wrap: wrap;
            }
            .ev-heading { margin: 0; font-size: clamp(2rem, 4vw, 2.8rem); font-weight: 800; letter-spacing: -0.03em; color: var(--clr-ink); line-height: 1; }
            .ev-heading em { font-style: normal; color: var(--clr-accent); }
            .ev-role-badge {
                display: inline-flex; align-items: center; gap: 6px;
                margin-top: 8px;
                padding: 4px 10px; border-radius: 99px;
                background: var(--clr-accent-lt); color: var(--clr-accent);
                font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
            }
            .ev-role-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--clr-accent); }

            .btn-primary {
                display: inline-flex; align-items: center; gap: 8px;
                padding: 12px 22px;
                background: var(--clr-accent); color: #fff;
                border: none; border-radius: var(--radius-md);
                font: 700 13px/1 var(--font-ui);
                letter-spacing: .03em; cursor: pointer;
                box-shadow: 0 4px 14px rgba(79,70,229,.35);
                transition: transform .15s, box-shadow .15s, background .15s;
            }
            .btn-primary:hover  { background: #4338ca; box-shadow: 0 6px 20px rgba(79,70,229,.4); transform: translateY(-1px); }
            .btn-primary:active { transform: translateY(0); box-shadow: none; }

            /* ── Toolbar ── */
            .ev-toolbar {
                display: flex; align-items: center; gap: 12px;
                background: var(--clr-surface);
                border: 1px solid var(--clr-border);
                border-radius: var(--radius-lg);
                padding: 8px 10px;
                margin-bottom: 28px;
                flex-wrap: wrap;
                box-shadow: var(--shadow-card);
            }
            .ev-search-wrap {
                position: relative; flex: 1; min-width: 220px;
            }
            .ev-search-icon {
                position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
                width: 15px; height: 15px; color: var(--clr-muted); pointer-events: none;
            }
            .ev-search-input {
                width: 100%; padding: 10px 36px 10px 38px;
                border: 1.5px solid transparent; border-radius: var(--radius-sm);
                background: var(--clr-bg); color: var(--clr-ink);
                font: 400 14px var(--font-ui); outline: none;
                transition: border-color .15s, background .15s;
            }
            .ev-search-input::placeholder { color: var(--clr-muted); }
            .ev-search-input:focus { border-color: var(--clr-accent); background: #fff; }
            .ev-search-clear {
                position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                background: none; border: none; cursor: pointer;
                color: var(--clr-muted); padding: 2px; line-height: 1;
                opacity: 0; pointer-events: none; transition: opacity .15s;
            }
            .ev-search-wrap:has(.ev-search-input:not(:placeholder-shown)) .ev-search-clear {
                opacity: 1; pointer-events: auto;
            }

            .ev-filters { display: flex; gap: 4px; background: var(--clr-bg); padding: 4px; border-radius: var(--radius-sm); }
            .filter-tab {
                padding: 7px 14px; border: none; border-radius: 6px; cursor: pointer;
                font: 700 11px var(--font-ui); letter-spacing: .05em; text-transform: uppercase;
                color: var(--clr-muted); background: transparent;
                transition: background .15s, color .15s;
            }
            .filter-tab:hover  { color: var(--clr-ink2); }
            .filter-tab.active { background: var(--clr-surface); color: var(--clr-accent); box-shadow: var(--shadow-card); }

            #event-stats {
                font-size: 12px; color: var(--clr-muted); font-weight: 500;
                display: flex; align-items: center; gap: 6px; white-space: nowrap;
            }
            .stat-dot {
                display: inline-block; width: 7px; height: 7px; border-radius: 50%;
            }
            .stat-dot.active  { background: var(--clr-active);  }
            .stat-dot.standby { background: var(--clr-standby); }

            /* ── Skeleton Loader ── */
            #grid-skeleton {
                display: none;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }
            .skel-card {
                background: var(--clr-surface); border-radius: var(--radius-lg);
                padding: 24px; border: 1px solid var(--clr-border); height: 180px;
            }
            .skel-line {
                height: 12px; border-radius: 6px;
                background: linear-gradient(90deg, #e8eaf0 25%, #f4f5f8 50%, #e8eaf0 75%);
                background-size: 200% 100%;
                animation: shimmer 1.4s infinite;
                margin-bottom: 10px;
            }
            @keyframes shimmer { to { background-position: -200% 0; } }

            /* ── Event Grid ── */
            #events-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }

            /* ── Event Card ── */
            .ev-card {
                background: var(--clr-surface);
                border: 1px solid var(--clr-border);
                border-radius: var(--radius-lg);
                padding: 22px 24px 20px;
                cursor: pointer; position: relative; overflow: hidden;
                box-shadow: var(--shadow-card);
                transition: box-shadow .2s, transform .2s, border-color .2s;
                animation: card-in .35s both;
                display: flex; flex-direction: column; gap: 12px;
            }
            @keyframes card-in {
                from { opacity: 0; transform: translateY(10px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .ev-card:hover {
                box-shadow: var(--shadow-hover);
                border-color: rgba(79,70,229,.2);
                transform: translateY(-2px);
            }
            .ev-card:focus-visible { outline: 2px solid var(--clr-accent); outline-offset: 2px; }
            .ev-card::after {
                content: ''; position: absolute; inset: 0;
                border-radius: inherit;
                background: linear-gradient(135deg, rgba(79,70,229,.04) 0%, transparent 60%);
                opacity: 0; transition: opacity .2s; pointer-events: none;
            }
            .ev-card:hover::after { opacity: 1; }

            .ev-card-header { display: flex; align-items: center; justify-content: space-between; }

            .ev-status {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 4px 10px; border-radius: 99px;
                font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
            }
            .status-active    { background: var(--clr-active-lt);  color: var(--clr-active);  }
            .status-standby   { background: var(--clr-standby-lt); color: var(--clr-standby); }
            .status-completed { background: var(--clr-done-lt);    color: var(--clr-done);    }

            .ev-pulse {
                width: 6px; height: 6px; border-radius: 50%;
                background: var(--clr-active);
                animation: pulse 1.5s ease-in-out infinite;
            }
            @keyframes pulse {
                0%,100% { opacity: 1; transform: scale(1); }
                50%      { opacity: .5; transform: scale(1.3); }
            }

            .ev-inquiry-badge {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 9px; border-radius: 99px;
                background: var(--clr-accent-lt); color: var(--clr-accent);
                font-size: 10px; font-weight: 700;
            }

            .ev-card-body { flex: 1; }
            .ev-card-title {
                font-size: 16px; font-weight: 700; color: var(--clr-ink);
                margin: 0 0 6px; line-height: 1.3;
                display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
                transition: color .15s;
            }
            .ev-card:hover .ev-card-title { color: var(--clr-accent); }
            .ev-card-desc {
                font-size: 13px; color: var(--clr-muted); margin: 0; line-height: 1.5;
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            }

            .ev-card-footer {
                display: flex; align-items: center; justify-content: space-between;
                padding-top: 14px; border-top: 1px solid var(--clr-border);
            }
            .ev-card-date {
                display: flex; align-items: center; gap: 5px;
                font-size: 11px; font-weight: 600; color: var(--clr-muted);
            }
            .ev-card-time { color: var(--clr-ink2); }
            .ev-card-arrow {
                color: var(--clr-muted);
                transition: color .15s, transform .15s;
            }
            .ev-card:hover .ev-card-arrow { color: var(--clr-accent); transform: translateX(3px); }

            .ev-card-tag {
                position: absolute; top: 0; right: 0;
                background: var(--clr-accent); color: #fff;
                font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
                padding: 4px 12px; border-bottom-left-radius: var(--radius-sm);
                border-top-right-radius: var(--radius-lg);
            }

            /* ── Empty State ── */
            .ev-empty {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                padding: 80px 20px; text-align: center;
            }
            .ev-empty-icon { color: var(--clr-border); margin-bottom: 16px; }
            .ev-empty-title { font-size: 16px; font-weight: 700; color: var(--clr-ink2); margin: 0 0 6px; }
            .ev-empty-sub   { font-size: 13px; color: var(--clr-muted); margin: 0; }

            /* ── Modal Backdrop ── */
            .ev-modal {
                display: none; position: fixed; inset: 0; z-index: 2000;
                background: rgba(10,11,18,.55);
                backdrop-filter: blur(6px);
                align-items: center; justify-content: center; padding: 20px;
            }
            .ev-modal:not(.hidden) { display: flex; }
            .ev-modal.modal-visible .modal-sheet { animation: sheet-in .28s cubic-bezier(.22,.68,0,1.2); }
            @keyframes sheet-in {
                from { opacity: 0; transform: scale(.94) translateY(10px); }
                to   { opacity: 1; transform: scale(1) translateY(0); }
            }

            .modal-sheet {
                background: var(--clr-surface);
                border-radius: var(--radius-xl);
                box-shadow: var(--shadow-modal);
                width: 100%; max-height: 90vh; overflow-y: auto;
            }

            /* ── Create / Edit Modal ── */
            .form-modal { max-width: 820px; }
            .form-modal-inner { padding: 36px 40px; }
            .form-modal-title {
                font-size: 22px; font-weight: 800; letter-spacing: -.02em;
                color: var(--clr-ink); margin: 0 0 28px;
            }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
            @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }

            .form-group { display: flex; flex-direction: column; gap: 6px; }
            .form-group.full { grid-column: 1 / -1; }
            .form-label {
                font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
                color: var(--clr-muted);
            }
            .form-label span { color: var(--clr-danger); margin-left: 2px; }
            .form-input, .form-select, .form-textarea {
                padding: 11px 14px;
                border: 1.5px solid var(--clr-border);
                border-radius: var(--radius-sm);
                background: var(--clr-bg);
                color: var(--clr-ink);
                font: 400 14px var(--font-ui);
                outline: none;
                transition: border-color .15s, background .15s;
                width: 100%; box-sizing: border-box;
            }
            .form-input:focus, .form-select:focus, .form-textarea:focus {
                border-color: var(--clr-accent); background: #fff;
            }
            .form-textarea { resize: vertical; min-height: 90px; }
            .time-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

            .form-panel {
                background: var(--clr-bg); border-radius: var(--radius-md);
                padding: 24px; display: flex; flex-direction: column; gap: 18px;
            }
            .form-panel-title {
                font-size: 11px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
                color: var(--clr-accent); margin: 0;
            }

            .form-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
            .btn-save {
                padding: 14px; border: none; border-radius: var(--radius-md);
                background: var(--clr-accent); color: #fff;
                font: 700 13px var(--font-ui); letter-spacing: .05em; text-transform: uppercase;
                cursor: pointer; transition: background .15s, transform .1s;
            }
            .btn-save:hover  { background: #4338ca; transform: translateY(-1px); }
            .btn-save:active { transform: translateY(0); }
            .btn-cancel-form {
                padding: 10px; border: none; border-radius: var(--radius-md);
                background: transparent; color: var(--clr-muted);
                font: 600 12px var(--font-ui); cursor: pointer; letter-spacing: .04em;
                transition: color .15s;
            }
            .btn-cancel-form:hover { color: var(--clr-danger); }

            /* ── Detail Modal ── */
            .detail-modal { max-width: 860px; }
            .detail-modal-inner { padding: 36px 40px; }
            .detail-header {
                display: flex; align-items: flex-start; justify-content: space-between;
                gap: 16px; margin-bottom: 28px;
            }
            .detail-header-left { display: flex; flex-direction: column; gap: 8px; }
            .detail-status-badge {
                display: inline-flex; align-items: center; gap: 5px;
                padding: 4px 10px; border-radius: 99px; width: fit-content;
                font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
            }
            .detail-title {
                font-size: clamp(20px, 3vw, 28px); font-weight: 800;
                letter-spacing: -.025em; color: var(--clr-ink); margin: 0;
            }
            .btn-close {
                flex-shrink: 0; width: 36px; height: 36px; border-radius: var(--radius-sm);
                border: 1.5px solid var(--clr-border); background: var(--clr-bg);
                color: var(--clr-muted); cursor: pointer; display: grid; place-items: center;
                transition: background .15s, color .15s, border-color .15s;
            }
            .btn-close:hover { background: var(--clr-danger-lt); color: var(--clr-danger); border-color: var(--clr-danger); }

            .detail-grid { display: grid; grid-template-columns: 1fr 280px; gap: 28px; }
            @media (max-width: 680px) { .detail-grid { grid-template-columns: 1fr; } }

            .detail-section { background: var(--clr-bg); border-radius: var(--radius-md); padding: 22px; }
            .detail-section-title {
                font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
                color: var(--clr-muted); margin: 0 0 14px;
            }
            .detail-desc { font-size: 14px; color: var(--clr-ink2); line-height: 1.65; margin: 0; }

            .detail-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .detail-meta-item { display: flex; flex-direction: column; gap: 3px; }
            .detail-meta-label { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--clr-muted); }
            .detail-meta-value { font-size: 13px; font-weight: 600; color: var(--clr-ink); }

            /* QR block */
            .qr-block {
                background: var(--clr-accent); color: #fff;
                border-radius: var(--radius-md); padding: 22px; text-align: center;
                margin-top: 16px;
            }
            .qr-image { width: 180px; height: 180px; border-radius: 10px; display: block; margin: 0 auto 12px; }
            .qr-url {
                font-size: 10px; word-break: break-all; opacity: .75; line-height: 1.4;
                font-family: monospace;
            }

            /* Sidebar */
            .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }
            .inquiry-list { display: flex; flex-direction: column; gap: 8px; }
            .inquiry-card {
                background: var(--clr-surface); border: 1px solid var(--clr-border);
                border-radius: var(--radius-sm); padding: 12px 14px;
                transition: box-shadow .15s;
            }
            .inquiry-card:hover { box-shadow: var(--shadow-card); }
            .inquiry-id { font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--clr-accent); margin-bottom: 4px; }
            .inquiry-question { font-size: 12px; color: var(--clr-ink2); margin: 0; line-height: 1.4; }
            .inquiry-restricted { font-size: 12px; color: var(--clr-muted); text-align: center; padding: 16px 0; margin: 0; }
            .inquiry-empty {
                display: flex; flex-direction: column; align-items: center; gap: 8px;
                color: var(--clr-border); padding: 20px 0;
            }
            .inquiry-empty p { margin: 0; font-size: 12px; color: var(--clr-muted); }
            .inquiry-loading {
                display: flex; align-items: center; gap: 8px;
                font-size: 12px; color: var(--clr-muted); padding: 12px 0;
            }
            .loading-spinner {
                width: 14px; height: 14px; border-radius: 50%;
                border: 2px solid var(--clr-border);
                border-top-color: var(--clr-accent);
                animation: spin .7s linear infinite; display: inline-block;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* Sidebar action buttons */
            .sidebar-actions { display: flex; flex-direction: column; gap: 8px; }
            .btn-action {
                display: flex; align-items: center; justify-content: center; gap: 8px;
                padding: 12px 16px; border-radius: var(--radius-md); border: none;
                font: 700 11px var(--font-ui); letter-spacing: .05em; text-transform: uppercase;
                cursor: pointer; transition: background .15s, transform .1s;
            }
            .btn-action:active { transform: scale(.98); }
            .btn-action-qr     { background: var(--clr-bg); color: var(--clr-ink2); border: 1.5px solid var(--clr-border); }
            .btn-action-qr:hover { background: var(--clr-accent-lt); color: var(--clr-accent); border-color: var(--clr-accent); }
            .btn-action-edit   { background: var(--clr-ink); color: #fff; }
            .btn-action-edit:hover { background: var(--clr-accent); }
            .btn-action-delete { background: var(--clr-danger-lt); color: var(--clr-danger); }
            .btn-action-delete:hover { background: #fca5a5; }

            /* Toast */
            .ev-toast { border-radius: var(--radius-md) !important; font-family: var(--font-ui) !important; }
        </style>

        <div class="ev-page">
          <div class="ev-inner">

            <!-- Header -->
            <div class="ev-header">
              <div>
                <h1 class="ev-heading">Campus <em>Events</em></h1>
                <div class="ev-role-badge">
                  <span class="ev-role-dot"></span>
                  ${escAttr(roleBadge)}
                </div>
              </div>
              ${this.can('manage') ? `
              <button id="btn-add-event" class="btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Create Event
              </button>` : ''}
            </div>

            <!-- Toolbar -->
            <div class="ev-toolbar">
              <div class="ev-search-wrap">
                <svg class="ev-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input id="ev-search" type="text" class="ev-search-input" placeholder="Search events…" autocomplete="off">
                <button id="ev-search-clear" class="ev-search-clear" aria-label="Clear search">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div class="ev-filters">
                ${['all','active','standby','completed'].map((f) => `
                  <button class="filter-tab${this.state.currentFilter === f ? ' active' : ''}" data-filter="${f}">
                    ${f === 'standby' ? 'Upcoming' : f}
                  </button>`).join('')}
              </div>

              <div id="event-stats"></div>
            </div>

            <!-- Skeleton -->
            <div id="grid-skeleton">
              ${[...Array(6)].map(() => `
                <div class="skel-card">
                  <div class="skel-line" style="width:35%;margin-bottom:16px"></div>
                  <div class="skel-line" style="width:80%"></div>
                  <div class="skel-line" style="width:55%"></div>
                  <div class="skel-line" style="width:40%;margin-top:24px"></div>
                </div>`).join('')}
            </div>

            <!-- Grid -->
            <div id="events-grid"></div>

          </div><!-- /ev-inner -->
        </div><!-- /ev-page -->

        <!-- ── Create / Edit Modal ── -->
        <div id="modal-event" class="ev-modal hidden" role="dialog" aria-modal="true" aria-labelledby="modal-form-title">
          <div class="modal-sheet form-modal">
            <div class="form-modal-inner">
              <h2 class="form-modal-title" id="modal-form-title">Create Event</h2>
              <div class="form-grid">
                <!-- Left column -->
                <div style="display:flex;flex-direction:column;gap:18px;">
                  <div class="form-group full">
                    <label class="form-label" for="new-ev-name">Event Name <span>*</span></label>
                    <input type="text" id="new-ev-name" class="form-input" placeholder="e.g. Freshmen Orientation 2025" autocomplete="off">
                  </div>
                  <div class="form-group full">
                    <label class="form-label" for="new-ev-desc">Description</label>
                    <textarea id="new-ev-desc" class="form-textarea" placeholder="What is this event about?"></textarea>
                  </div>
                  <div class="time-grid">
                    <div class="form-group">
                      <label class="form-label" for="new-ev-start">Start <span>*</span></label>
                      <input type="datetime-local" id="new-ev-start" class="form-input">
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="new-ev-end">End <span>*</span></label>
                      <input type="datetime-local" id="new-ev-end" class="form-input">
                    </div>
                  </div>
                </div>
                <!-- Right panel -->
                <div class="form-panel">
                  <p class="form-panel-title">Target Students</p>
                  <div class="form-group">
                    <label class="form-label" for="new-ev-dept">Department</label>
                    <select id="new-ev-dept" class="form-select">
                      <option value="All Dept">All Departments</option>
                      <option value="Education Dept">Education Dept</option>
                      <option value="Industrial Technology Dept">Industrial Technology Dept</option>
                      <option value="Other Dept">Other Dept</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="new-ev-year">Year Level</label>
                    <select id="new-ev-year" class="form-select">
                      <option value="All Year">All Year Levels</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div class="form-actions">
                    <button id="save-ev-btn" class="btn-save">Publish Event</button>
                    <button id="btn-cancel-form" class="btn-cancel-form">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Detail Modal ── -->
        <div id="modal-event-detail" class="ev-modal hidden" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <div class="modal-sheet detail-modal">
            <div class="detail-modal-inner">
              <div class="detail-header">
                <div class="detail-header-left">
                  <span id="detail-status" class="detail-status-badge status-standby">Upcoming</span>
                  <h2 id="detail-title" class="detail-title"></h2>
                </div>
                <button id="btn-close-detail" class="btn-close" aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div class="detail-grid">
                <!-- Main content -->
                <div style="display:flex;flex-direction:column;gap:16px;">
                  <div class="detail-section">
                    <p class="detail-section-title">About this event</p>
                    <p id="detail-desc" class="detail-desc"></p>
                  </div>
                  <div class="detail-section">
                    <p class="detail-section-title">Schedule & Audience</p>
                    <div class="detail-meta">
                      <div class="detail-meta-item">
                        <span class="detail-meta-label">Start</span>
                        <span id="detail-start" class="detail-meta-value"></span>
                      </div>
                      <div class="detail-meta-item">
                        <span class="detail-meta-label">End</span>
                        <span id="detail-end" class="detail-meta-value"></span>
                      </div>
                      <div class="detail-meta-item">
                        <span class="detail-meta-label">Department</span>
                        <span id="detail-dept" class="detail-meta-value"></span>
                      </div>
                      <div class="detail-meta-item">
                        <span class="detail-meta-label">Year Level</span>
                        <span id="detail-year" class="detail-meta-value"></span>
                      </div>
                    </div>
                  </div>
                  <div id="qr-container" class="qr-block hidden">
                    <div id="qr-code-img"></div>
                    <p class="qr-url" id="qr-event-url"></p>
                  </div>
                </div>

                <!-- Sidebar -->
                <div class="detail-sidebar">
                  <div class="detail-section" style="flex:1">
                    <p class="detail-section-title">Student Inquiries</p>
                    <div id="inquiry-list" class="inquiry-list"></div>
                  </div>
                  <div class="sidebar-actions">
                    <button id="btn-generate-qr" class="btn-action btn-action-qr">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h.01"/></svg>
                      Generate QR
                    </button>
                    <button id="btn-edit-active" class="btn-action btn-action-edit">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Event
                    </button>
                    <button id="btn-delete-active" class="btn-action btn-action-delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      Cancel Event
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    },
};
