import { supabase } from './auth.js';

export const eventManager = {
    // --- DATABASE LOGIC ---
    async getEvents() {
        const { data } = await supabase
            .from('events')
            .select('*')
            .order('event_date', { ascending: false });
        return data || [];
    },

    async setStatus(id, status) {
        return await supabase.from('events').update({ status }).eq('id', id);
    },

    // --- ROLE-BASED UI GENERATOR ---
    async render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        // 1. Get current user role from your auth session/localStorage
        const userRole = localStorage.getItem('user_role'); // e.g., 'super_admin', 'admin', 'staff_attendance', 'staff_finance'

        container.innerHTML = `
            <div class="p-8 animate-in fade-in duration-700">
                <div class="flex justify-between items-center mb-10">
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
        `;

        this.populateEvents(userRole);
    },

    async populateEvents(role) {
        const events = await this.getEvents();
        const grid = document.getElementById('events-grid');
        
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
                                    <button onclick="window.location.hash='#attendance'; sessionStorage.setItem('active_event', '${event.id}')" 
                                            class="py-3 bg-blue-50 text-[#000080] rounded-xl text-[10px] font-black uppercase hover:bg-[#000080] hover:text-white transition-all">
                                        Attendance
                                    </button>
                                ` : ''}
                                ${(role !== 'staff_attendance') ? `
                                    <button onclick="window.location.hash='#finance'; sessionStorage.setItem('active_event', '${event.id}')" 
                                            class="py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all">
                                        Finance
                                    </button>
                                ` : ''}
                            </div>
                        ` : `<p class="text-[10px] text-center text-slate-400 font-bold uppercase py-2 bg-slate-50 rounded-xl">Event Not Active</p>`}

                        ${(role === 'super_admin' || role === 'admin') ? `
                            <div class="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between">
                                <span class="text-[9px] font-bold text-slate-400 uppercase">System Control</span>
                                <select onchange="eventManager.updateStatus('${event.id}', this.value)" 
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

    async updateStatus(id, newStatus) {
        const { error } = await this.setStatus(id, newStatus);
        if (!error) this.render(); // Refresh UI
    }
};
