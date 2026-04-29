import { supabase } from './auth.js';

export const staffMgmt = {
    async init(orgId, orgName) {
        const container = document.getElementById('mod-manage-staff');
        if (!container) return;

        container.innerHTML = `<div class="p-20 text-center animate-pulse font-black text-emerald-200 italic uppercase">Accessing Staff Records...</div>`;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'staff') // STRICT: Staff lang
                .eq('organization_id', orgId) // Filtered by Org
                .order('full_name', { ascending: true });

            if (error) throw error;
            this.render(container, data || [], orgId, orgName);
        } catch (e) {
            container.innerHTML = `<div class="p-20 text-center text-red-500 font-bold uppercase">Sync Failed</div>`;
        }
    },

    render(container, staff, orgId, orgName) {
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="bg-emerald-600 rounded-[40px] p-10 text-white shadow-2xl flex justify-between items-center">
                    <div>
                        <p class="text-emerald-100/60 text-[9px] font-black uppercase tracking-[0.4em] mb-1">${orgName}</p>
                        <h1 class="text-3xl font-black italic tracking-tighter uppercase">Personnel Directory</h1>
                    </div>
                    <button id="add-staff-btn" class="bg-white text-emerald-700 px-8 py-4 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl">
                        + REGISTER STAFF
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${staff.length ? staff.map(s => `
                        <div class="bg-white p-6 rounded-[35px] border border-emerald-50 shadow-sm hover:shadow-lg transition-all">
                            <div class="flex items-center gap-4 mb-4">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=10b981&color=fff" class="w-14 h-14 rounded-2xl">
                                <div>
                                    <h3 class="font-black text-slate-800 text-sm uppercase leading-tight">${s.full_name}</h3>
                                    <p class="text-emerald-600 text-[9px] font-black uppercase tracking-widest italic">Finance Staff</p>
                                </div>
                            </div>
                            <div class="pt-4 border-t border-emerald-50 text-[10px] text-slate-400 font-bold truncate italic">📧 ${s.email}</div>
                        </div>
                    `).join('') : `
                        <div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic">Empty Personnel Registry</div>
                    `}
                </div>
            </div>
        `;
        document.getElementById('add-staff-btn').onclick = () => this.showCreateForm(orgId);
    }
};
