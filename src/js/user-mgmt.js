import { supabase } from './auth.js';

export const userMgmt = {
    async init() {
        const container = document.getElementById('mod-manage-users');
        if (!container) return;

        container.innerHTML = `<div class="p-20 text-center animate-pulse font-black text-slate-300 italic uppercase">Fetching Admins...</div>`;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'admin') // STRICT: Admins lang
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.render(container, data || []);
        } catch (e) {
            container.innerHTML = `<div class="p-20 text-center text-red-500 font-bold uppercase">Database Error: Check connection</div>`;
        }
    },

    render(container, admins) {
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="bg-[#000080] rounded-[40px] p-10 text-white shadow-2xl flex justify-between items-center">
                    <div>
                        <h1 class="text-3xl font-black italic tracking-tighter uppercase">Admin Registry</h1>
                        <p class="text-blue-200/60 text-[10px] font-bold uppercase tracking-[0.3em]">System Level Access</p>
                    </div>
                    <button id="add-admin-btn" class="bg-white text-[#000080] px-8 py-4 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl">
                        + REGISTER ADMIN
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${admins.map(a => `
                        <div class="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
                            <div class="flex items-center gap-4 mb-4">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(a.full_name)}&background=000080&color=fff" class="w-14 h-14 rounded-2xl">
                                <div>
                                    <h3 class="font-black text-slate-800 text-sm uppercase leading-tight">${a.full_name}</h3>
                                    <p class="text-blue-600 text-[9px] font-black uppercase tracking-widest">${a.department || 'Education Dept.'}</p>
                                </div>
                            </div>
                            <div class="pt-4 border-t border-slate-50 text-[10px] text-slate-400 font-bold italic truncate">📧 ${a.email}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        // Event listener para sa admin registration form
        document.getElementById('add-admin-btn').onclick = () => this.showCreateForm();
    }
};
