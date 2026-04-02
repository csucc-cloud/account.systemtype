import { supabase } from './auth.js';

export const eventsModule = {
    // --- DATABASE LOGIC ---
    async getEvents() {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('event_date', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Database Fetch Error:", error.message);
            return [];
        }
    },

    async setStatus(id, status) {
        return await supabase.from('events').update({ status }).eq('id', id);
    },

    // --- UI RENDERER ---
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

        // 1. Get the Source of Truth: Fetch role/org directly from DB for the current user
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, organization_id')
            .eq('id', user?.id)
            .single();

        const userRole = profile?.role || 'staff';
        const userOrgId = profile?.organization_id;

        container.innerHTML = `
            <div class="p-8 animate-in fade-in duration-700">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h2 class="text-2xl font-black text-slate-800 tracking-tight">Command Center</h2>
                        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                            Role: <span class="text-[#000080]">${userRole.replace('_', ' ')}</span>
                        </p>
                    </div>
                    
                    ${(userRole === 'super_admin' || userRole === 'admin') ? `
                        <button id="btn-add-event" class="px-5 py-2.5 bg-[#000080] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:shadow-xl transition-all flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> Create New Event
                        </button>
                    ` : ''}
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="col-span-full text-center py-20">
                        <div class="w-6 h-6 border-2 border-slate-200 border-t-[#000080] rounded-full animate-spin mx-auto mb-4"></div>
                        <p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Syncing with Database...</p>
                    </div>
                </div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div class="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                    <h3 class="text-xl font-black text-slate-800 mb-2">New Operation</h3>
                    <p class="text-xs text-slate-400 mb-6 font-medium">Create a new event session for staff to join.</p>
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Event Title</label>
                            <input type="text" id="new-ev-name" placeholder="e.g. General Assembly" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100 transition-all">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Schedule Date</label>
                            <input type="date" id="new-ev-date" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100 transition-all">
                        </div>
                        <div class="flex gap-2 pt-4">
                            <button id="close-ev-modal" class="flex-1 py-4 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-all">Cancel</button>
                            <button id="save-ev-btn" class="flex-1 py-4 bg-[#000080] text-white rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">Confirm Event</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initEventListeners(userRole, userOrgId);
        await this.populateEvents(userRole);
    },

    async populateEvents(role) {
        const events = await this.getEvents();
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        
        if (events.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                    <i data-lucide="calendar-x-2" class="w-10 h-10 text-slate-200 mx-auto mb-4"></i>
                    <p class="text-slate-400 font-bold text-sm uppercase tracking-tight">No Events Scheduled</p>
                    ${(role === 'super_admin' || role === 'admin') ? 
                        `<p class="text-[10px] text-[#000080] font-medium mt-1 uppercase">Click "Create New Event" to start a session.</p>` : ''}
                </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = events.map(event => {
            const isActive = event.status === 'active';
            return `
                <div class="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500' : 'text-slate-300'}">
                                ${event.status}
                            </span>
                            <h3 class="text-xl font-black text-slate-800 leading-tight">${event.event_name}</h3>
                        </div>
                        <div class="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                            <i data-lucide="calendar" class="w-5 h-5 text-slate-400 group-hover:text-[#000080]"></i>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${isActive ? `
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${event.id}')" 
                                        class="py-3 bg-blue-50 text-[#000080] rounded-xl text-[10px] font-black uppercase hover:bg-[#000080] hover:text-white transition-all">
                                    Attendance
                                </button>
                                <button onclick="window.showSection('finance'); sessionStorage.setItem('active_event', '${event.id}')" 
                                        class="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all">
                                    Finance
                                </button>
                            </div>
                        ` : `<div class="py-3 bg-slate-50 rounded-xl text-center"><p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">Awaiting Activation</p></div>`}

                        ${(role === 'super_admin' || role === 'admin') ? `
                            <div class="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between">
                                <span class="text-[9px] font-bold text-slate-300 uppercase">Manage Mode</span>
                                <select onchange="window.updateEventStatus('${event.id}', this.value)" 
                                        class="text-[10px] font-bold bg-transparent border-none text-[#000080] cursor-pointer focus:ring-0">
                                    <option value="upcoming" ${event.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                    <option value="active" ${event.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="completed" ${event.status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                            </div>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners(role, orgId) {
        const modal = document.getElementById('modal-event');
        const addBtn = document.getElementById('btn-add-event');
        const closeBtn = document.getElementById('close-ev-modal');
        const saveBtn = document.getElementById('save-ev-btn');

        if (addBtn) addBtn.onclick = () => modal.classList.remove('hidden');
        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

        if (saveBtn) {
            saveBtn.onclick = async () => {
                const name = document.getElementById('new-ev-name').value;
                const date = document.getElementById('new-ev-date').value;

                if (!name || !date) return alert("Missing Info: Event name and date are required.");

                // Automatically include the organization_id from the profile we fetched
                const { error } = await supabase.from('events').insert([{ 
                    event_name: name, 
                    event_date: date, 
                    status: 'upcoming',
                    organization_id: orgId 
                }]);

                if (!error) {
                    modal.classList.add('hidden');
                    this.render();
                } else {
                    console.error(error.message);
                    alert("Error creating event: " + error.message);
                }
            };
        }

        window.updateEventStatus = async (id, status) => {
            await this.setStatus(id, status);
            this.render();
        };
    }
};
