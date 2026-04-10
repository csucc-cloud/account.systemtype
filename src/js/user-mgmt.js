import { supabase } from './auth.js';

export const userMgmt = {
    // Main function na tatawagin sa main.js
    async init() {
        try {
            const admins = await this.fetchAllAdmins();
            this.render(admins);
        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'Could not load admins', 'error');
        }
    },

    async fetchAllAdmins() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'admin')
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        return data || [];
    },

    render(admins) {
        Swal.fire({
            title: '<span class="text-sm font-black uppercase tracking-widest text-slate-400">Admin Management</span>',
            html: `
                <div class="text-left space-y-3 max-h-[400px] overflow-y-auto p-2 mt-4">
                    ${admins.length ? admins.map(a => `
                        <div class="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <div>
                                <div class="text-xs font-black text-slate-700 uppercase">${a.full_name}</div>
                                <div class="text-[9px] text-slate-400 font-bold">${a.department || 'No Dept'}</div>
                                <div class="text-[8px] text-indigo-500 font-bold">${a.email}</div>
                            </div>
                        </div>
                    `).join('') : '<p class="text-center text-slate-400 text-[10px] font-bold py-10 uppercase">No admins registered</p>'}
                    
                    <button id="btn-add-admin-modal" class="w-full mt-4 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 hover:text-indigo-500 transition-all">
                        + Add New Admin Account
                    </button>
                </div>
            `,
            showConfirmButton: false,
            didOpen: () => {
                document.getElementById('btn-add-admin-modal').onclick = () => this.showCreateForm();
            }
        });
    },

    async showCreateForm() {
        const { value: form } = await Swal.fire({
            title: '<span class="text-xs font-black uppercase tracking-widest">Create Admin</span>',
            html: `
                <div class="space-y-3 pt-4">
                    <input id="adm-email" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Email Address">
                    <input id="adm-name" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Full Name">
                    <input id="adm-dept" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Department (e.g., Education Dept)">
                    <input id="adm-org" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Organization UUID (ID)">
                    <input id="adm-pass" type="password" class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm font-bold" placeholder="Password">
                </div>
            `,
            confirmButtonText: 'CREATE ACCOUNT',
            confirmButtonColor: '#4f46e5',
            showCancelButton: true,
            preConfirm: () => ({
                email: document.getElementById('adm-email').value,
                name: document.getElementById('adm-name').value,
                dept: document.getElementById('adm-dept').value,
                orgId: document.getElementById('adm-org').value,
                pass: document.getElementById('adm-pass').value
            })
        });

        if (form) {
            if (!form.email || !form.pass) return Swal.fire('Error', 'Missing fields', 'error');
            try {
                const { error } = await supabase.auth.signUp({
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
                if (error) throw error;
                Swal.fire('Success', 'Admin account created!', 'success').then(() => this.init());
            } catch (e) {
                Swal.fire('Failed', e.message, 'error');
            }
        }
    }
};
