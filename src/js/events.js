import { supabase } from './auth.js';

export const eventsModule = {
    // --- DATABASE LOGIC ---
    async getEvents() {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('event_date', { ascending: false });
        
        if (error) {
            console.error("Error fetching events:", error);
            return [];
        }
        return data || [];
    },

    async setStatus(id, status) {
        return await supabase.from('events').update({ status }).eq('id', id);
    },

    // --- UI RENDERER ---
    async render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        const userRole = localStorage.getItem('user_role') || 'staff';

        container.innerHTML = `
            <div class="p-8 animate-in fade-in duration-700">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h2 class="text-2xl font-black text-slate-800 tracking-tight">Command Center</h2>
                        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Active Operations & Event Management</p>
                    </div>
                    
                    ${(userRole === 'super_admin' || userRole === 'admin') ? `
                        <button id="btn-add-event" class="px-5 py-2.5 bg-[#000080] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:shadow-xl transition-all flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> Create New Event
                        </button>
                    ` : ''}
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    </div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div class="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
                    <h3 class="text-xl font-black text-slate-800 mb-4">New Operation</h3>
                    <div class="space-y-4">
                        <input type="text" id="new-ev-name" placeholder="Event Name" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm">
                        <input type="date" id="new-ev-date" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm">
                        <div class="flex gap-2 pt-4">
                            <button id="close-ev-modal" class="flex-1 py-3 text-slate-400 font-bold text-xs uppercase">Cancel</button>
                            <button id="save-ev-btn" class="flex-1 py-3 bg-[#000080] text-white rounded-xl font-black text-xs uppercase">Save Event</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.populateEvents(userRole);
        this.initEventListeners(userRole);
    },

    async populateEvents(role) {
        const events = await this.getEvents();
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        
        if (events.length === 0) {
            grid.innerHTML = `<p class="col-span-full text-center py-10 text-slate-400 italic text-sm">No events found.</p>`;
            return;
        }

        grid.innerHTML = events.map(event => {
            const isActive = event.status === 'active';
            
            return `
                <div class="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group relative overflow-hidden">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-emerald-500' : 'text-slate-400'}">
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
                                ${(role !== 'staff_finance') ? `
                                    <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${event.id}')" 
                                            class="py-3 bg-blue-50 text-[#000080] rounded-xl text-[10px] font-black uppercase hover:bg-[#000080] hover:text-white transition-all">
                                        Attendance
                                    </button>
                                ` : ''}
                                ${(role !== 'staff_attendance') ? `
                                    <button onclick="window.showSection('finance'); sessionStorage.setItem('active_event', '${event.id}')" 
                                            class="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all">
                                        Finance
                                    </button>
                                ` : ''}
                            </div>
                        ` : `<p class="text-[10px] text-center text-slate-400 font-bold uppercase py-2 bg-slate-50 rounded-xl">Event Not Active</p>`}

                        ${(role === 'super_admin' || role === 'admin') ? `
                            <div class="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between">
                                <span class="text-[9px] font-bold text-slate-400 uppercase">System Control</span>
                                <select onchange="window.updateEventStatus('${event.id}', this.value)" 
                                        class="text-[10px] font-bold bg-transparent border-none text-[#000080] cursor-pointer focus:ring-0">
                                    <option value="upcoming" ${event.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                    <option value="active" ${event.status === 'active' ? 'selected' : ''}>Set Active</option>
                                    <option value="completed" ${event.status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners(role) {
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

                if (!name || !date) return alert("Fill all fields");

                const { error } = await supabase.from('events').insert([{ 
                    event_name: name, 
                    event_date: date, 
                    status: 'upcoming' 
                }]);

                if (!error) {
                    modal.classList.add('hidden');
                    this.render();
                } else {
                    alert(error.message);
                }
            };
        }

        // Global function for the select dropdown
        window.updateEventStatus = async (id, status) => {
            await this.setStatus(id, status);
            this.render();
        };
    }
};
