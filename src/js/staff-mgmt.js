import { supabase } from './auth.js';

export const staffMgmt = {
    async init(userOrgId, userOrgName) {
        const container = document.getElementById('mod-manage-staff');
        if (!container) return;

        // Visual feedback habang nag-lo-load
        this.renderSkeleton(container);

        try {
            // DIRECT FETCH: Sinisiguro na fresh data mula sa DB
            const staff = await this.fetchStaffByOrg(userOrgId);
            this.render(container, staff, userOrgId, userOrgName);
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="p-20 text-center text-red-500 font-bold">Failed to sync staff records.</div>`;
        }
    },

    async fetchStaffByOrg(orgId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'staff')
            .eq('organization_id', orgId)
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    renderSkeleton(container) {
        container.innerHTML = `
            <div class="animate-pulse space-y-6">
                <div class="h-24 bg-emerald-50 rounded-[40px] w-full"></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="h-40 bg-emerald-50 rounded-[35px]"></div>
                    <div class="h-40 bg-emerald-50 rounded-[35px]"></div>
                </div>
            </div>
        `;
    },

    render(container, staff, orgId, orgName) {
        container.innerHTML = `
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="bg-emerald-600 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <p class="text-emerald-100 text-[10px] font-black uppercase tracking-[0.4em] mb-2">${orgName}</p>
                            <h1 class="text-3xl font-black tracking-tighter uppercase">Personnel Directory</h1>
                        </div>
                        <button id="btn-create-staff" class="bg-white text-emerald-700 px-8 py-4 rounded-2xl font-black text-xs hover:scale-105 transition-all shadow-xl active:scale-95">
                            + ADD NEW STAFF
                        </button>
                    </div>
                    <div class="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl"></div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${staff.length ? staff.map(s => `
                        <div class="bg-white p-6 rounded-[35px] border border-emerald-50 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-300 group">
                            <div class="flex items-center gap-4 mb-4">
                                <div class="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(s.full_name)}&background=10b981&color=fff" class="w-12 h-12 rounded-2xl shadow-inner">
                                </div>
                                <div>
                                    <h3 class="font-black text-slate-800 text-sm uppercase leading-tight">${s.full_name}</h3>
                                    <p class="text-emerald-600 text-[9px] font-black tracking-widest uppercase mt-0.5">Authorized Staff</p>
                                </div>
                            </div>
                            
                            <div class="pt-4 border-t border-emerald-50 space-y-2">
                                <div class="flex items-center gap-2 text-slate-400">
                                    <span class="text-[11px] font-medium truncate">${s.email}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="col-span-full py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                            <p class="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">No personnel registered for this organization.</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
        document.getElementById('btn-create-staff').onclick = () => this.showCreateForm(orgId, orgName);
    },

    async showCreateForm(orgId, orgName) {
        const { value: form } = await Swal.fire({
            title: '<h2 class="text-xl font-black text-emerald-600 uppercase tracking-tighter pt-4">Register Personnel</h2>',
            html: `
                <div class="space-y-3 pt-4 text-left">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Access Credentials</label>
                    <input id="stf-email" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Corporate Email">
                    <input id="stf-pass" type="password" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Assigned Password">
                    
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest mt-4 block">Official Information</label>
                    <input id="stf-name" class="w-full p-4 bg-slate-50 rounded-2xl border-none text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="Full Legal Name">
                    <div class="p-4 bg-emerald-50 rounded-2xl text-[10px] font-bold text-emerald-700 border border-emerald-100 italic">
                        Assigning to: ${orgName}
                    </div>
                </div>
            `,
            confirmButtonText: 'FINALIZE REGISTRATION',
            showCancelButton: true,
            buttonsStyling: false,
            customClass: {
                confirmButton: 'bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs mx-2 shadow-lg hover:bg-emerald-700 transition-all',
                cancelButton: 'bg-slate-100 text-slate-400 px-8 py-4 rounded-2xl font-black text-xs mx-2 hover:bg-slate-200 transition-all',
                popup: 'rounded-[40px] p-8'
            },
            preConfirm: () => {
                const data = {
                    email: document.getElementById('stf-email').value,
                    name: document.getElementById('stf-name').value,
                    pass: document.getElementById('stf-pass').value
                };
                if (!data.email || !data.pass || !data.name) {
                    Swal.showValidationMessage('Required fields missing');
                    return false;
                }
                return data;
            }
        });

        if (form) {
            Swal.fire({ title: 'Syncing with Database...', didOpen: () => Swal.showLoading() });

            try {
                // 1. Direct Auth Creation
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.pass,
                    options: {
                        data: {
                            full_name: form.name,
                            role: 'staff',
                            organization_id: orgId
                        }
                    }
                });

                if (authError) throw authError;

                // 2. VERIFICATION LOOP (Laban sa Ghost Data)
                let verified = false;
                for (let i = 0; i < 5; i++) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', authData.user.id)
                        .single();
                    
                    if (data) {
                        verified = true;
                        break;
                    }
                    await new Promise(res => setTimeout(res, 1000));
                }

                await Swal.fire({
                    icon: verified ? 'success' : 'info',
                    title: verified ? 'STAFF VERIFIED' : 'SYNC IN PROGRESS',
                    text: verified ? 'Personnel has been added to the database.' : 'Account created, please refresh the list in a moment.',
                    customClass: { popup: 'rounded-[40px]' }
                });
                
                this.init(orgId, orgName); // Direct UI Refresh
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    }
};
