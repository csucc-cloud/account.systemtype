import { supabase } from './auth.js';

export const eventsModule = {
    // --- DATABASE LOGIC ---
    async getEvents() {
        try {
            // Fetching from the view that calculates status based on date
            const { data, error } = await supabase
                .from('events_with_status')
                .select('*')
                .order('event_date', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error("Database Fetch Error:", error.message);
            return [];
        }
    },

    // --- UI RENDERER ---
    async render() {
        const container = document.getElementById('mod-events') || document.getElementById('mod-dashboard');
        if (!container) return;

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
                        <h2 class="text-2xl font-black text-slate-800 tracking-tight">Operation Command</h2>
                        <p class="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                            Role: <span class="text-[#000080]">${userRole.replace('_', ' ')}</span>
                        </p>
                    </div>
                    
                    ${(userRole === 'super_admin' || userRole === 'admin') ? `
                        <button id="btn-add-event" class="px-5 py-2.5 bg-[#000080] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:shadow-xl transition-all flex items-center gap-2">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i> New Operation
                        </button>
                    ` : ''}
                </div>

                <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div class="col-span-full text-center py-20">
                        <div class="w-6 h-6 border-2 border-slate-200 border-t-[#000080] rounded-full animate-spin mx-auto mb-4"></div>
                        <p class="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Loading Live Status...</p>
                    </div>
                </div>
            </div>

            <div id="modal-event" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div class="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                    <h3 class="text-xl font-black text-slate-800 mb-2">Deploy Operation</h3>
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Title</label>
                            <input type="text" id="new-ev-name" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Target Date</label>
                            <input type="date" id="new-ev-date" class="w-full p-4 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-100">
                        </div>
                        <div class="flex gap-2 pt-4">
                            <button id="close-ev-modal" class="flex-1 py-4 text-slate-400 font-bold text-xs uppercase">Cancel</button>
                            <button id="save-ev-btn" class="flex-1 py-4 bg-[#000080] text-white rounded-xl font-black text-xs uppercase shadow-lg">Confirm Deployment</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initEventListeners(userOrgId);
        await this.populateEvents();
    },

    async populateEvents() {
        const events = await this.getEvents();
        const grid = document.getElementById('events-grid');
        if (!grid) return;
        
        if (events.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem]"><p class="text-slate-400 font-bold text-sm uppercase">Clear Skies - No Operations</p></div>`;
            return;
        }

        grid.innerHTML = events.map(event => {
            const isActive = event.status === 'active';
            const isCompleted = event.status === 'completed';
            
            return `
                <div class="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group overflow-hidden">
                    <div class="flex justify-between items-start mb-6">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-emerald-500' : isCompleted ? 'text-slate-300' : 'text-blue-500'}">
                                ● ${event.status}
                            </span>
                            <h3 class="text-xl font-black text-slate-800 leading-tight">${event.event_name}</h3>
                            <p class="text-[10px] text-slate-400 font-bold mt-1">${new Date(event.event_date).toDateString()}</p>
                        </div>
                        <div class="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                            <i data-lucide="users" class="w-5 h-5 text-slate-400 group-hover:text-[#000080]"></i>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${isActive ? `
                            <button onclick="window.showSection('attendance'); sessionStorage.setItem('active_event', '${event.id}')" 
                                    class="w-full py-4 bg-blue-50 text-[#000080] rounded-xl text-xs font-black uppercase hover:bg-[#000080] hover:text-white transition-all">
                                Open Attendance Sheet
                            </button>
                        ` : `
                            <div class="py-3 bg-slate-50 rounded-xl text-center">
                                <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    ${isCompleted ? 'Log Archived' : 'Pending Deployment'}
                                </p>
                            </div>
                        `}
                    </div>
                </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners(orgId) {
        const modal = document.getElementById('modal-event');
        if (document.getElementById('btn-add-event')) document.getElementById('btn-add-event').onclick = () => modal.classList.remove('hidden');
        if (document.getElementById('close-ev-modal')) document.getElementById('close-ev-modal').onclick = () => modal.classList.add('hidden');

        document.getElementById('save-ev-btn').onclick = async () => {
            const name = document.getElementById('new-ev-name').value;
            const date = document.getElementById('new-ev-date').value;

            if (!name || !date) return alert("Details required.");

            const { error } = await supabase.from('events').insert([{ 
                event_name: name, event_date: date, organization_id: orgId 
            }]);

            if (!error) {
                modal.classList.add('hidden');
                this.render();
            } else {
                alert(error.message);
            }
        };
    }
};
