import { supabase } from './auth.js';

export const staffMgmt = {
    async init(userOrgId, userOrgName) {
        try {
            const staff = await this.fetchStaffByOrg(userOrgId);
            this.render(staff, userOrgId, userOrgName);
        } catch (e) {
            Swal.fire('Error', 'Could not load staff', 'error');
        }
    },

    async fetchStaffByOrg(orgId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'staff') // or 'finance_staff' base sa roles mo
            .eq('organization_id', orgId);
        
        if (error) throw error;
        return data || [];
    },

    render(staff, orgId, orgName) {
        Swal.fire({
            title: `<span class="text-sm font-black uppercase tracking-widest text-slate-400">Staff: ${orgName}</span>`,
            html: `
                <div class="text-left space-y-3 max-h-[400px] overflow-y-auto p-2 mt-4">
                    ${staff.length ? staff.map(s => `
                        <div class="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm">
                            <div>
                                <div class="text-xs font-black text-slate-700 uppercase">${s.full_name}</div>
                                <div class="text-[9px] text-emerald-600 font-bold">FINANCE STAFF</div>
                            </div>
                        </div>
                    `).join('') : '<p class="text-center text-slate-400 text-[10px] font-bold py-10 uppercase">No staff members</p>'}
                    
                    <button id="btn-add-staff-modal" class="w-full mt-4 py-4 border-2 border-dashed border-emerald-200 rounded-2xl text-[10px] font-black text-emerald-500 uppercase hover:bg-emerald-50 transition-all">
                        + Register New Staff
                    </button>
                </div>
            `,
            showConfirmButton: false,
            didOpen: () => {
                document.getElementById('btn-add-staff-modal').onclick = () => this.showCreateForm(orgId, orgName);
            }
        });
    },

    async showCreateForm(orgId, orgName) {
        const { value: form } = await Swal.fire({
            title: '<span class="text-xs font-black uppercase tracking-widest">Register Staff</span>',
            html: `
                <div class="space-y-3 pt-4">
                    <input id="stf-email" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Email Address">
                    <input id="stf-name" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Full Name">
                    <input id="stf-pass" type="password" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Initial Password">
                </div>
            `,
            confirmButtonText: 'REGISTER',
            confirmButtonColor: '#10b981',
            showCancelButton: true,
            preConfirm: () => ({
                email: document.getElementById('stf-email').value,
                name: document.getElementById('stf-name').value,
                pass: document.getElementById('stf-pass').value
            })
        });

        if (form) {
            try {
                const { error } = await supabase.auth.signUp({
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
                if (error) throw error;
                Swal.fire('Success', 'Staff registered!', 'success').then(() => this.init(orgId, orgName));
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    }
};
