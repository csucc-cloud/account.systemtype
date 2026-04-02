import { supabase } from './auth.js';
import { AuditLogger } from './audit-logger.js';

export const eventsModule = {
    state: {
        events: [],
        filteredEvents: [],
        selectedEvents: [],
        attachments: [],
        userRole: 'staff',
        userOrgId: null,
        searchTerm: '',
        currentFilter: 'all',
        isLoading: false,
        viewMode: 'grid',
        isStealthMode: false,
        uploadProgress: 0,
        // NEW STATE
        selectedEvent: null,
        isEditMode: false
    },

    // --- DATA LAYER ---
    async fetchEvents() {
        this.state.isLoading = true;
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
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

                return { ...ev, status: computedStatus };
            });

            this.applyFilters();
            this.updateDashboardStats();
            return true;
        } catch (error) {
            this.notify("Data Retrieval Failed", "error");
            return false;
        } finally {
            this.state.isLoading = false;
        }
    },

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

    // --- UI COMPONENTS ---
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user?.id).single();
        
        this.state.userRole = profile?.role || 'staff';
        this.state.userOrgId = profile?.organization_id;

        const theme = this.state.isStealthMode ? 'stealth-theme' : 'light-theme';

        container.innerHTML = `
            <div class="${theme} min-h-screen transition-all duration-700 font-sans p-4 md:p-10">
                <style>
                    .stealth-theme { background: #050505; color: #f1f5f9; }
                    .light-theme { background: #f8fafc; color: #0f172a; }
                    .text-stroke-custom { -webkit-text-stroke: 1px #000080; color: transparent; }
                    .glass-panel { backdrop-filter: blur(20px); background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.1); }
                    .input-tactical { 
                        background: ${this.state.isStealthMode ? '#111' : '#fff'}; 
                        border: 2px solid ${this.state.isStealthMode ? '#333' : '#e2e8f0'};
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .input-tactical:focus { border-color: #000080; box-shadow: 0 0 0 4px rgba(0,0,128,0.1); }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #000080; border-radius: 10px; }
                </style>

                <div class="max-w-[1600px] mx-auto space-y-10">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div class="space-y-4">
                            <div class="flex items-center gap-4">
                                <span class="h-1 w-16 bg-[#000080] rounded-full"></span>
                                <p class="text-[11px] font-bold uppercase tracking-[0.4em] text-slate-500">Logistics & Deployment</p>
                            </div>
                            <h1 class="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
                                Events<span class="text-stroke-custom opacity-70">Log</span>
                            </h1>
                        </div>

                        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            <div class="relative flex-grow max-w-md">
                                <i data-lucide="search" class="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"></i>
                                <input type="text" id="ev-search" placeholder="Search operational database..." 
                                    class="w-full pl-14 pr-6 py-5 rounded-[2rem] input-tactical text-sm font-bold shadow-sm outline-none">
                            </div>
                            
                            <button id="stealth-toggle" class="p-5 rounded-full input-tactical hover:scale-110 active:scale-95 transition-all">
                                <i data-lucide="${this.state.isStealthMode ? 'sun' : 'moon'}" class="w-5 h-5 text-[#000080]"></i>
                            </button>

                            ${(this.state.userRole === 'admin' || this.state.userRole === 'super_admin') ? `
                                <button id="btn-add-event" class="px-10 py-5 bg-[#000080] text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center gap-3">
                                    <i data-lucide="plus-circle" class="w-5 h-5 text-blue-300"></i> Create Event
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div class="flex flex-col md:flex-row justify-between items-center gap-6 py-4 border-b border-slate-200/60">
                        <div class="flex p-1.5 bg-slate-200/40 rounded-[1.8rem] w-full md:w-auto overflow-x-auto">
                            ${['all', 'active', 'standby', 'completed'].map(f => `
                                <button data-filter="${f}" class="filter-tab px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${this.state.currentFilter === f ? 'bg-white text-[#000080] shadow-md' : 'text-slate-500 hover:text-slate-800'}">${f}</button>
                            `).join('')}
                        </div>
                        <div id="event-stats" class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialising Grid...</div>
                    </div>

                    <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8"></div>
                </div>

                <div id="modal-event" class="hidden fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8">
                    <div class="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"></div>
                    <div class="relative bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div class="sticky top-0 z-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur-sm">
                            <div>
                                <h2 id="modal-title" class="text-2xl md:text-3xl font-black italic tracking-tighter uppercase leading-none">New<span class="text-[#000080]">Mission</span></h2>
                                <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Strategic Asset Deployment</p>
                            </div>
                            <button id="close-ev-modal" class="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all border border-slate-100 shadow-sm">
                                <i data-lucide="x" class="w-6 h-6"></i>
                            </button>
                        </div>
                        <div class="overflow-y-auto p-8 md:p-12 custom-scrollbar">
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                <div class="lg:col-span-7 space-y-8">
                                    <div class="space-y-3">
                                        <label class="flex items-center gap-3 text-[10px] font-black text-[#000080] uppercase tracking-widest ml-2">
                                            <i data-lucide="terminal" class="w-4 h-4"></i> Operation Codename
                                        </label>
                                        <input type="text" id="new-ev-name" placeholder="e.g., NEXUS SUMMIT 2026" 
                                            class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-2xl font-black text-lg focus:bg-white focus:border-blue-100 outline-none transition-all">
                                    </div>
                                    <div class="space-y-3">
                                        <label class="flex items-center gap-3 text-[10px] font-black text-[#000080] uppercase tracking-widest ml-2">
                                            <i data-lucide="file-text" class="w-4 h-4"></i> Mission Parameters
                                        </label>
                                        <textarea id="new-ev-desc" rows="4" placeholder="Describe the mission objectives..." 
                                            class="w-full p-6 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm focus:bg-white focus:border-blue-100 outline-none transition-all resize-none"></textarea>
                                    </div>
                                    <div class="space-y-3">
                                        <label class="text-[10px] font-black text-[#000080] uppercase tracking-widest ml-2">Intelligence Briefing</label>
                                        <div id="drop-zone" class="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer">
                                            <i data-lucide="upload" class="w-8 h-8 text-slate-300"></i>
                                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Drag files to upload tactical assets</p>
                                            <input type="file" id="real-file-input" class="hidden" multiple>
                                        </div>
                                        <div id="file-list" class="flex flex-wrap gap-2 mt-4"></div>
                                    </div>
                                </div>
                                <div class="lg:col-span-5 space-y-6">
                                    <div class="bg-slate-50 rounded-[2.5rem] p-6 space-y-6 border border-slate-100">
                                        <div class="space-y-3">
                                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between px-1">
                                                Commencement <span>00:00 HRS</span>
                                            </label>
                                            <input type="datetime-local" id="new-ev-start" class="w-full p-4 bg-white rounded-xl font-black text-xs shadow-sm border border-slate-100">
                                        </div>
                                        <div class="space-y-3">
                                            <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between px-1">
                                                Conclusion <span>23:59 HRS</span>
                                            </label>
                                            <input type="datetime-local" id="new-ev-end" class="w-full p-4 bg-white rounded-xl font-black text-xs shadow-sm border border-slate-100">
                                        </div>
                                        <div id="conflict-engine" class="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4 transition-all">
                                            <i data-lucide="check" class="w-5 h-5 text-emerald-500" id="conflict-icon"></i>
                                            <p id="conflict-msg" class="text-[9px] font-black text-emerald-700 uppercase leading-tight">Sector Cleared: No conflicts.</p>
                                        </div>
                                    </div>
                                    <button id="save-ev-btn" class="w-full py-6 bg-[#000080] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.4em] shadow-xl hover:bg-blue-900 transition-all active:scale-95">
                                        Deploy Operation to Grid
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="modal-event-detail" class="hidden fixed inset-0 z-[2100] flex items-center justify-center p-4 md:p-8">
                    <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-md"></div>
                    <div class="relative bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div class="p-10 space-y-8">
                            <div class="flex justify-between items-start">
                                <div>
                                    <span class="text-[10px] font-black text-blue-600 uppercase tracking-widest">Mission Intelligence</span>
                                    <h2 id="detail-title" class="text-4xl font-black italic tracking-tighter uppercase text-slate-900"></h2>
                                </div>
                                <button onclick="document.getElementById('modal-event-detail').classList.add('hidden')" class="p-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <i data-lucide="x" class="w-6 h-6 text-slate-400"></i>
                                </button>
                            </div>

                            <div class="space-y-6">
                                <div class="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Strategic Overview</p>
                                    <p id="detail-desc" class="text-sm font-medium text-slate-600 leading-relaxed"></p>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-4 border border-slate-100 rounded-2xl">
                                        <p class="text-[8px] font-black text-slate-400 uppercase">Commence</p>
                                        <p id="detail-start" class="text-xs font-bold text-slate-800"></p>
                                    </div>
                                    <div class="p-4 border border-slate-100 rounded-2xl">
                                        <p class="text-[8px] font-black text-slate-400 uppercase">Conclude</p>
                                        <p id="detail-end" class="text-xs font-bold text-slate-800"></p>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-4 pt-4">
                                <button id="btn-edit-active" class="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#000080] transition-all">Edit Parameters</button>
                                <button id="btn-delete-active" class="px-6 py-4 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">Terminate</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;

        this.initEventListeners();
        await this.fetchEvents();
        this.renderGrid();
    },

    // --- LOGIC ENGINE ---
    initEventListeners() {
        const stealthBtn = document.getElementById('stealth-toggle');
        if (stealthBtn) stealthBtn.onclick = () => {
            this.state.isStealthMode = !this.state.isStealthMode;
            this.render();
        };

        const openBtn = document.getElementById('btn-add-event');
        const modal = document.getElementById('modal-event');
        if (openBtn) openBtn.onclick = () => {
            this.state.isEditMode = false;
            this.state.selectedEvent = null;
            this.resetForm();
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            if (window.lucide) window.lucide.createIcons();
        };

        const closeBtn = document.getElementById('close-ev-modal');
        if (closeBtn) closeBtn.onclick = () => {
            modal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        };

        const startIn = document.getElementById('new-ev-start');
        const endIn = document.getElementById('new-ev-end');
        
        [startIn, endIn].forEach(input => {
            if (input) input.onchange = () => {
                const isConflict = this.checkConflicts(startIn.value, endIn.value);
                const engine = document.getElementById('conflict-engine');
                const msg = document.getElementById('conflict-msg');
                const icon = document.getElementById('conflict-icon');

                if (isConflict) {
                    engine.className = "p-5 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-4 animate-pulse";
                    msg.className = "text-[9px] font-black text-amber-700 uppercase";
                    msg.innerText = "Conflict Alert: Overlapping deployment.";
                    icon.className = "w-5 h-5 text-amber-500";
                } else {
                    engine.className = "p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4";
                    msg.className = "text-[9px] font-black text-emerald-700 uppercase";
                    msg.innerText = "Sector Cleared: No conflicts.";
                }
            };
        });

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('real-file-input');
        if (dropZone) {
            dropZone.onclick = () => fileInput.click();
            fileInput.onchange = (e) => this.handleFiles(e.target.files);
        }

        const search = document.getElementById('ev-search');
        if (search) search.oninput = (e) => {
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

        const saveBtn = document.getElementById('save-ev-btn');
        if (saveBtn) saveBtn.onclick = () => this.deployMission();

        // NEW: Detail Modal Actions
        const editBtn = document.getElementById('btn-edit-active');
        if (editBtn) editBtn.onclick = () => this.openEditMode();

        const deleteBtn = document.getElementById('btn-delete-active');
        if (deleteBtn) deleteBtn.onclick = () => this.deleteEvent(this.state.selectedEvent.id);
    },

    checkConflicts(start, end) {
        if (!start || !end) return false;
        const s = new Date(start);
        const e = new Date(end);
        return this.state.events.some(ev => {
            // If editing, don't conflict with itself
            if (this.state.selectedEvent && ev.id === this.state.selectedEvent.id) return false;
            const exS = new Date(ev.start_time);
            const exE = new Date(ev.end_time);
            return (s < exE && e > exS);
        });
    },

    handleFiles(files) {
        const list = document.getElementById('file-list');
        Array.from(files).forEach(file => {
            this.state.attachments.push(file);
            const chip = document.createElement('div');
            chip.className = "px-4 py-2 bg-[#000080] text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-sm";
            chip.innerHTML = `${file.name} <i data-lucide="x" class="w-3 h-3 cursor-pointer"></i>`;
            list.appendChild(chip);
        });
        if (window.lucide) window.lucide.createIcons();
    },

    async deployMission() {
        const name = document.getElementById('new-ev-name').value;
        const desc = document.getElementById('new-ev-desc').value;
        const start = document.getElementById('new-ev-start').value;
        const end = document.getElementById('new-ev-end').value;

        if (!name || !start || !end) return this.notify("Deployment Failed: Missing parameters", "error");

        try {
            const payload = {
                event_name: name,
                description: desc,
                start_time: start,
                end_time: end,
                organization_id: this.state.userOrgId
            };

            let error;
            if (this.state.isEditMode && this.state.selectedEvent) {
                const result = await supabase.from('events').update(payload).eq('id', this.state.selectedEvent.id);
                error = result.error;
            } else {
                const result = await supabase.from('events').insert([{ ...payload, status: 'active' }]);
                error = result.error;
            }

            if (error) throw error;
            
            this.notify(this.state.isEditMode ? "Operation Updated" : "Operation Logged & Deployed", "success");
            document.getElementById('modal-event').classList.add('hidden');
            document.body.style.overflow = 'auto';
            await this.fetchEvents();
            this.renderGrid();
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    // --- NEW ACTIONS ---
    openDetailModal(event) {
        this.state.selectedEvent = event;
        const modal = document.getElementById('modal-event-detail');
        
        document.getElementById('detail-title').innerText = event.event_name;
        document.getElementById('detail-desc').innerText = event.description || 'No briefing available.';
        document.getElementById('detail-start').innerText = new Date(event.start_time).toLocaleString();
        document.getElementById('detail-end').innerText = new Date(event.end_time).toLocaleString();
        
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    },

    openEditMode() {
        const ev = this.state.selectedEvent;
        if (!ev) return;

        this.state.isEditMode = true;
        document.getElementById('modal-event-detail').classList.add('hidden');
        
        // Fill the Create Modal form
        document.getElementById('modal-title').innerHTML = `Edit<span class="text-[#000080]">Mission</span>`;
        document.getElementById('new-ev-name').value = ev.event_name;
        document.getElementById('new-ev-desc').value = ev.description || '';
        document.getElementById('new-ev-start').value = ev.start_time.slice(0, 16);
        document.getElementById('new-ev-end').value = ev.end_time.slice(0, 16);
        document.getElementById('save-ev-btn').innerText = "Update Mission Parameters";

        document.getElementById('modal-event').classList.remove('hidden');
    },

    async deleteEvent(id) {
        if (!confirm("TERMINATE MISSION: Confirm permanent deletion?")) return;
        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            
            this.notify("Mission Terminated & Purged", "success");
            document.getElementById('modal-event-detail').classList.add('hidden');
            await this.fetchEvents();
            this.renderGrid();
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    resetForm() {
        document.getElementById('modal-title').innerHTML = `New<span class="text-[#000080]">Mission</span>`;
        document.getElementById('new-ev-name').value = '';
        document.getElementById('new-ev-desc').value = '';
        document.getElementById('new-ev-start').value = '';
        document.getElementById('new-ev-end').value = '';
        document.getElementById('save-ev-btn').innerText = "Deploy Operation to Grid";
        document.getElementById('file-list').innerHTML = '';
        this.state.attachments = [];
    },

    renderGrid() {
        const grid = document.getElementById('events-grid');
        if (!grid) return;

        if (this.state.filteredEvents.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-40 text-center opacity-30 font-black uppercase tracking-[1em]">No Records in Database</div>`;
            return;
        }

        grid.innerHTML = this.state.filteredEvents.map((ev, i) => {
            const isActive = ev.status === 'active';
            const themeClass = this.state.isStealthMode ? 'bg-[#0f0f0f] border-white/5 shadow-none' : 'bg-white border-slate-100 shadow-sm';
            
            return `
                <div onclick='eventsModule.openDetailModal(${JSON.stringify(ev).replace(/'/g, "&apos;")})' 
                     class="${themeClass} cursor-pointer rounded-[2.5rem] p-8 group hover:shadow-xl transition-all relative overflow-hidden animate-in slide-in-from-bottom-10" 
                     style="animation-delay: ${i * 50}ms">
                    
                    <div class="flex justify-between items-start mb-6">
                        <div class="px-4 py-1.5 rounded-xl bg-slate-100/50 text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500' : 'text-slate-400'}">
                            ${ev.status}
                        </div>
                        <input type="checkbox" onclick="event.stopPropagation()" class="w-5 h-5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                    </div>

                    <div class="space-y-3 mb-8">
                        <h3 class="text-2xl font-black italic tracking-tighter uppercase leading-none group-hover:text-[#000080] transition-colors">${ev.event_name}</h3>
                        <p class="text-xs text-slate-400 font-medium line-clamp-2">${ev.description || 'No strategic overview.'}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                        <div class="flex flex-col gap-1">
                            <span class="text-[8px] font-black text-slate-300 uppercase">Commence</span>
                            <span class="text-[10px] font-black uppercase">${new Date(ev.start_time).toLocaleDateString()}</span>
                        </div>
                        <div class="flex flex-col gap-1 items-end">
                            <span class="text-[8px] font-black text-slate-300 uppercase">Conclude</span>
                            <span class="text-[10px] font-black uppercase">${new Date(ev.end_time).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    updateDashboardStats() {
        const stats = document.getElementById('event-stats');
        if (stats) stats.innerText = `${this.state.events.length} ACTIVE DEPLOYMENTS RECORDED`;
    },

    notify(msg, type) {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-[#000080]' : 'bg-red-600';
        toast.className = `fixed bottom-10 right-10 px-8 py-4 rounded-full text-white font-black uppercase text-[10px] tracking-widest z-[3000] shadow-2xl animate-in slide-in-from-right-10 ${color}`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};
