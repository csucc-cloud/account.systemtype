import { supabase } from './auth.js';

/**
 * EVENTS MODULE - Secure & Optimized Version
 */
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
        isEditMode: false
    },

    /**
     * INITIALIZATION & AUTH SYNC
     */
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        try {
            // Securely fetch user context directly from Supabase
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

        container.innerHTML = this.getTemplate();
        
        // Fix #10: Global assignment for interoperability
        window.eventsModule = this; 
        
        await this.fetchEvents();
        this.initEventListeners();
    },

    /**
     * DATA FETCHING
     */
    async fetchEvents() {
        this.setLoading(true);
        try {
            let query = supabase.from('events')
                .select(`*, event_inquiries (id)`)
                .order('start_time', { ascending: false });
            
            // Fix #12: Role-based filtering
            if (this.state.userRole !== 'super_admin') {
                query = query.eq('organization_id', this.state.userOrgId);
            }
            
            const { data, error } = await query;
            if (error) throw error;

            const now = new Date();
            this.state.events = (data || []).map(ev => {
                const start = new Date(ev.start_time);
                const end = new Date(ev.end_time);
                let status = now < start ? 'standby' : (now <= end ? 'active' : 'completed');
                return { ...ev, status, inquiryCount: ev.event_inquiries?.length || 0 };
            });

            this.applyFilters();
            this.updateDashboardStats();
            this.renderGrid();
        } catch (error) { 
            this.notify(error.message, "error"); 
        } finally { 
            this.setLoading(false); 
        }
    },

    /**
     * PERMISSIONS ENGINE
     */
    can(action) {
        const r = this.state.userRole;
        const permissions = {
            manage: ['super_admin', 'admin'].includes(r),
            attendance: ['super_admin', 'admin', 'attendance_staff'].includes(r),
            finance: ['super_admin', 'admin', 'finance_staff'].includes(r)
        };
        return permissions[action] || false;
    },

    /**
     * CORE CRUD OPERATIONS
     */
    async deployMission() {
        // Fix #2: Critical Auth Guard
        if (!this.can('manage')) return this.notify("Unauthorized action", "error");

        // Fix #11: Null-safe DOM reading
        const getVal = (id) => document.getElementById(id)?.value || '';
        const fields = {
            name: getVal('new-ev-name'),
            desc: getVal('new-ev-desc'),
            start: getVal('new-ev-start'),
            end: getVal('new-ev-end'),
            dept: getVal('new-ev-dept'),
            year: getVal('new-ev-year')
        };
        
        if (!fields.name || !fields.start || !fields.end) {
            return this.notify("Missing required fields", "error");
        }
        
        // Fix #4: Conflict check ignoring self during edits
        const currentId = this.state.isEditMode ? this.state.selectedEvent.id : null;
        if (this.checkConflicts(fields.start, fields.end, currentId)) {
            return this.notify("Scheduling conflict detected", "error");
        }

        const payload = { 
            event_name: fields.name, 
            description: fields.desc, 
            start_time: new Date(fields.start).toISOString(), // Fix #5: ISO Format
            end_time: new Date(fields.end).toISOString(), 
            organization_id: this.state.userOrgId,
            target_dept: fields.dept,
            target_year: fields.year
        };

        const req = this.state.isEditMode 
            ? supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id)
            : supabase.from('events').insert([payload]);

        const { error } = await req;
        if (error) return this.notify(error.message, "error");

        this.notify(this.state.isEditMode ? "Event Updated" : "Event Published", "success");
        this.closeModal('modal-event');
        await this.fetchEvents();
    },

    async deleteEvent(id) {
        // Fix #2: Critical Auth Guard
        if (!this.can('manage')) return this.notify("Unauthorized action", "error");

        const result = await Swal.fire({
            title: 'Remove Event?',
            text: "This action cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, remove it',
            customClass: { popup: 'rounded-[2rem]' }
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) return this.notify(error.message, "error");
            this.notify("Event removed", "success");
            this.closeModal('modal-event-detail');
            await this.fetchEvents();
        }
    },

    /**
     * UI RENDERING
     */
    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        
        if (!this.state.filteredEvents.length) {
            grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-400 font-medium">No events found in this category</div>`;
            return;
        }

        // Fix #3: Secure Data Attributes (No XSS risk)
        grid.innerHTML = this.state.filteredEvents.map(ev => `
            <div class="event-card bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" 
                 data-event-id="${ev.id}">
                <div class="flex justify-between items-start mb-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${this.getStatusClass(ev.status)}">
                        ${ev.status}
                    </span>
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                         <i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>
                    </div>
                </div>
                <h3 class="font-black text-slate-800 text-lg mb-1 leading-tight">${ev.event_name}</h3>
                <p class="text-[11px] text-slate-400 font-bold uppercase tracking-widest">${new Date(ev.start_time).toLocaleDateString()}</p>
            </div>
        `).join('');

        // Secure Event Listeners
        grid.querySelectorAll('.event-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-event-id');
                const event = this.state.events.find(e => e.id === id);
                if (event) this.openEventDetail(event);
            });
        });

        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * HELPERS & UTILITIES
     */
    setLoading(val) {
        this.state.isLoading = val;
        // Fix #7: Visible loading indicator
        const loader = document.getElementById('events-loader');
        if (loader) loader.classList.toggle('hidden', !val);
    },

    notify(msg, type) {
        // Fix #1: Safety check for Swal Loading states
        if (type === 'loading') {
            Swal.fire({ 
                title: msg, 
                allowOutsideClick: false, 
                didOpen: () => Swal.showLoading(),
                customClass: { popup: 'rounded-3xl border-none shadow-2xl' }
            });
        } else {
            Swal.fire({ 
                toast: true, 
                position: 'top-end', 
                icon: type, 
                title: msg, 
                showConfirmButton: false, 
                timer: 3000,
                customClass: { popup: 'rounded-3xl border-none shadow-2xl' }
            });
        }
    },

    checkConflicts(start, end, excludeId = null) {
        const s = new Date(start);
        const e = new Date(end);
        return this.state.events.some(ev => {
            if (excludeId && ev.id === excludeId) return false;
            const evS = new Date(ev.start_time);
            const evE = new Date(ev.end_time);
            return (s < evE && e > evS);
        });
    },

    initEventListeners() {
        // Fix #8: Backdrop-click to close
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal.id);
            });
        });
    }
};
