import { supabase } from './auth.js';

export const userMgmt = {
    async init() {
        const container = document.getElementById('mod-manage-users');
        if (!container) return;

        this.renderSkeleton(container);

        try {
            // DIRECT FETCH: Walang local cache, diretso sa database
            const admins = await this.fetchAllAdmins();
            this.render(container, admins);
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-20 text-center text-red-500 font-bold">Failed to load system administrators.</div>`;
        }
    },

    async fetchAllAdmins() {
        // Sinisiguro natin na fresh data ang kinukuha
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <div class="animate-pulse space-y-6">
                <div class="h-20 bg-slate-200 rounded-[32px] w-full"></div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="h-32 bg-slate-200 rounded-[32px]"></div>
                    <div class="h-32 bg-slate-200 rounded-[32px]"></div>
                    <div class="h-32 bg-slate-200 rounded-[32px]"></div>
                </div>
            </div>
        `;
    },

    render(container, admins) {
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="bg-[#000080] rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h1 class="text-3xl font-black tracking-tighter">ADMINISTRATORS</h1>
                            <p class="text-blue-200/60 text-xs font-bold uppercase tracking-[0.3em]">System Level Access Management</p>
                        </div>
                        <button id="btn-create-admin" class="bg-white text-[#000080] px-8 py-4 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl active:scale-95">
                            + REGISTER NEW ADMIN
                        </button>
                    </div>
                    <div class="absolute top-[-20%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Admins</p>
                        <p class="text-3xl font-black text-slate-800">${admins.length}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${admins.length ? admins.map(a => `
                        <div class="bg-white p-8 rounded-[35px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                            <div class="flex items-start justify-between mb-6">
                                <div class="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(a.full_name)}&background=000080&color=fff" class="w-10 h-10 rounded-xl">
                                </div>
                                <span class="px-3 py-1 bg-blue-50 text-[#000080] text-[9px] font-black rounded-full uppercase tracking-tighter">Verified Admin</span>
                            </div>
                            <h3 class="font-black text-slate-800 text-lg leading-tight mb-1 uppercase">${a.full_name}</h3>
                            <p class="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4">${a.department || 'General Administration'}</p>
                            <div class="space-y-2 border-t border-slate-50 pt-4 text-slate-400">
                                <div class="flex items-center gap-2">
                                    <span class="text-[11px] font-medium truncate">${a.email}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="col-span-full py-20 text-center">
                            <p class="text-slate-400 font-bold uppercase tracking-[0.2em]">No administrators found.</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
        document.getElementById('btn-create-admin').onclick = () => this.showCreateForm();
    },

    async showCreateForm() {
        const { value: form } = await Swal.fire({
            title: '<h2 class="text-xl font-black text-[#000080] uppercase tracking-tighter pt-4">Register Administrator</h2>',
            html: `
                <div class="space-y-3 pt-4 text-left">
                    <input id="adm-email" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold" placeholder="Email Address">
                    <input id="adm-pass" type="password" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold" placeholder="Security Password">
                    <input id="adm-name" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold" placeholder="Full Name">
                    <input id="adm-dept" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold" placeholder="Department">
                    <input id="adm-org" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-[11px] font-mono" placeholder="Organization UUID">
                </div>
            `,
            confirmButtonText: 'CONFIRM REGISTRATION',
            showCancelButton: true,
            buttonsStyling: false,
            customClass: {
                confirmButton: 'bg-[#000080] text-white px-8 py-4 rounded-2xl font-black text-xs mx-2 shadow-lg',
                cancelButton: 'bg-slate-100 text-slate-400 px-8 py-4 rounded-2xl font-black text-xs mx-2',
                popup: 'rounded-[40px] p-8'
            },
            preConfirm: () => {
                return {
                    email: document.getElementById('adm-email').value,
                    name: document.getElementById('adm-name').value,
                    dept: document.getElementById('adm-dept').value,
                    orgId: document.getElementById('adm-org').value,
                    pass: document.getElementById('adm-pass').value
                };
            }
        });

        if (form) {
            Swal.fire({ title: 'Connecting to Supabase...', didOpen: () => Swal.showLoading() });

            try {
                // 1. Gagawa ng Auth User
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.pass,
                    options: {
                        data: {
                            full_name: form.name,
                            role: 'admin',
                            organization_id: form.orgId,
                            department: form.dept
                        }
                    }
                });

                if (authError) throw authError;

                // 2. IWAS GHOST DATA: Verification Loop
                // Minsan matagal ang trigger sa database, kaya che-check natin kung nandun na talaga.
                let verified = false;
                for (let i = 0; i < 5; i++) { // Retry 5 times
                    const { data } = await supabase.from('profiles').select('id').eq('id', authData.user.id).single();
                    if (data) {
                        verified = true;
                        break;
                    }
                    await new Promise(res => setTimeout(res, 1000)); // Wait 1 second bago mag-check ulit
                }

                await Swal.fire({
                    icon: verified ? 'success' : 'warning',
                    title: verified ? 'REGISTRATION SUCCESS' : 'DELAYED REGISTRATION',
                    text: verified ? 'Admin record is now live.' : 'Auth created, but profile record is still processing. Please refresh in a bit.',
                    customClass: { popup: 'rounded-[40px]' }
                });
                
                this.init(); // Refresh UI direct from DB
            } catch (e) {
                Swal.fire('DATABASE ERROR', e.message, 'error');
            }
        }
    }
};
