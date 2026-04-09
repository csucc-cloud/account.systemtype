import { supabase } from './auth.js';

export const financeModule = {
    state: { activePeriod: null, allPeriods: [], students: [], selectedStudent: null, userRole: 'staff', userOrgId: null, userOrgName: null, scanner: null },

    // --- SECURITY & HELPERS ---
    _safe(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); },
    
    notify(msg, icon = 'info') { 
        if (typeof Swal !== 'undefined') Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true }).fire({ icon, title: msg });
    },

    can(action) {
        const r = this.state.userRole;
        return { manage: ['super_admin', 'admin'].includes(r), finance: ['super_admin', 'admin', 'finance_staff'].includes(r), rollover: ['super_admin'].includes(r) }[action] ?? false;
    },

    // --- MAIN RENDERER ---
    async render() {
        const container = document.getElementById('mod-finance');
        if (!container) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: prof } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
            Object.assign(this.state, { userRole: prof?.role || 'staff', userOrgId: prof?.organization_id, userOrgName: prof?.organization_name || 'CITTE LSG' });
            if (!this.state.allPeriods.length) await this.fetchMetadata();
        } catch (e) { console.error(e); }

        container.innerHTML = `
            <style>
                @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
                .scanner-laser { position: absolute; width: 100%; height: 2px; background: #2563eb; box-shadow: 0 0 15px #3b82f6; animation: scan 2s infinite linear; z-index: 10; }
                .receipt-font { font-family: 'Courier New', Courier, monospace; }
                .glass-card { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(10px); }
            </style>

            <div class="p-4 md:p-8 bg-[#F1F5F9] min-h-screen">
                <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur-md p-6 rounded-[2rem] shadow-sm border border-white gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><i data-lucide="wallet"></i></div>
                        <div>
                            <h1 class="text-xl font-black text-slate-800 tracking-tight">Finance <span class="text-indigo-600">Hub</span></h1>
                            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${this.state.activePeriod ? `${this.state.activePeriod.year_range} | ${this.state.activePeriod.semester} Sem` : 'No Active Period'}</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        ${this.can('rollover') ? `<button id="btn-rollover" class="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all">Transition</button>` : ''}
                        <button id="btn-scan-receipt" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Verify QR</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                    <div class="lg:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div class="p-5 border-b border-slate-50 bg-slate-50/50 flex gap-4">
                            <i data-lucide="search" class="w-4 text-slate-400"></i>
                            <input type="text" id="search-finance" placeholder="Search Student..." class="bg-transparent text-sm w-full outline-none font-medium">
                        </div>
                        <div class="overflow-x-auto"><table class="w-full text-left"><tbody id="finance-list-body"></tbody></table></div>
                    </div>
                    <div class="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-xl flex flex-col justify-between items-center text-center">
                        <p class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Collection Balance</p>
                        <h2 class="text-4xl font-black my-4 italic">₱<span id="total-val">0.00</span></h2>
                        <button id="btn-print-audit" class="w-full py-4 bg-white/20 hover:bg-white/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Export Audit</button>
                    </div>
                </div>
            </div>

            <div id="rollover-modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[250] flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
                    <h2 class="text-xl font-black text-slate-800 mb-6 italic">Semester Rollover</h2>
                    <div class="space-y-4">
                        <input type="text" id="roll-year" placeholder="Year (e.g. 2025-2026)" class="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm">
                        <select id="roll-sem" class="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm">
                            <option value="1st">1st Semester</option><option value="2nd">2nd Semester</option>
                        </select>
                        <input type="number" id="roll-fee" placeholder="Base Fee (₱)" class="w-full p-4 bg-slate-50 rounded-xl border-none font-bold text-sm">
                        <div class="flex gap-2 pt-4">
                            <button id="btn-confirm-roll" class="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase">Initialize</button>
                            <button onclick="document.getElementById('rollover-modal').classList.add('hidden')" class="px-6 py-4 bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] uppercase">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="scanner-container" class="hidden fixed inset-0 z-[500] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center flex-col p-4">
                <div class="relative w-72 h-72 rounded-[2.5rem] overflow-hidden border-4 border-indigo-500 shadow-2xl">
                    <div id="reader" class="w-full h-full scale-150"></div>
                    <div class="scanner-laser"></div>
                </div>
                <button id="btn-close-scanner" class="mt-8 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest">Close Scanner</button>
            </div>

            <div id="finance-modal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] items-center justify-center p-4">
                <div id="finance-modal-content" class="w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh] animate-in slide-in-from-bottom-4 duration-300"></div>
            </div>

            <div id="print-area" class="hidden print:block"></div>
        `;

        this._attachShellListeners();
        await this.fetchStudents();
        if (window.lucide) window.lucide.createIcons();
    },

    _attachShellListeners() {
        const d = document;
        d.getElementById('search-finance')?.addEventListener('input', e => this.fetchStudents(e.target.value));
        d.getElementById('btn-scan-receipt')?.addEventListener('click', () => this.initScanner());
        d.getElementById('btn-close-scanner')?.addEventListener('click', () => this.closeScanner());
        d.getElementById('btn-print-audit')?.addEventListener('click', () => this.printAuditSheet());
        d.getElementById('btn-rollover')?.addEventListener('click', () => d.getElementById('rollover-modal').classList.remove('hidden'));
        d.getElementById('btn-confirm-roll')?.addEventListener('click', () => this.executeRollover());
        d.getElementById('finance-list-body')?.addEventListener('click', e => {
            const btn = e.target.closest('.btn-manage-student');
            if (btn) this.viewStudentFinance(btn.closest('tr')?.dataset.studentId);
        });
    },

    async viewStudentFinance(studentId) {
        const student = this.state.students.find(s => String(s.student_id) === String(studentId));
        if (!student) return;

        const currentPeriodId = this.state.activePeriod?.id;
        const totalPaid = student.payments?.filter(p => p.academic_period_id === currentPeriodId).reduce((s, p) => s + p.amount_paid, 0) || 0;
        const themeColor = this.state.userOrgName.includes("HERO") ? "#ef4444" : "#4f46e5";

        const modal = document.getElementById('finance-modal');
        modal.classList.replace('hidden', 'flex');

        document.getElementById('finance-modal-content').innerHTML = `
            <div class="flex-[1.2] p-10 flex flex-col bg-slate-50 border-r border-slate-100">
                <div class="mb-6 flex justify-between items-center">
                    <h3 class="font-black text-slate-400 uppercase tracking-widest text-[10px]">Transaction Logs</h3>
                    <span class="px-3 py-1 bg-white rounded-lg text-[9px] font-bold text-indigo-600 shadow-sm border border-slate-100">${this.state.activePeriod?.semester} Sem</span>
                </div>
                <div class="flex-1 overflow-y-auto pr-2 space-y-2">
                    ${student.payments?.length ? student.payments.sort((a,b) => b.id - a.id).map(p => `
                        <div class="p-4 bg-white rounded-2xl border border-slate-200 flex justify-between items-center group hover:border-indigo-400 transition-all shadow-sm">
                            <span class="font-bold text-slate-600 text-xs">${p.receipt_number}</span>
                            <span class="font-black text-slate-900 text-xs text-right">₱${p.amount_paid.toLocaleString()}</span>
                        </div>
                    `).join('') : '<div class="h-full flex items-center justify-center text-slate-300 italic text-sm">No transactions yet</div>'}
                </div>
                ${this.can('finance') ? `
                <div class="mt-6 flex gap-2">
                    <input type="number" id="pay-amount" placeholder="0.00" class="flex-1 p-4 bg-white rounded-2xl border-2 border-transparent focus:border-indigo-500 font-bold outline-none text-sm shadow-sm transition-all">
                    <button id="btn-add-payment" class="px-8 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">Record</button>
                </div>` : ''}
            </div>

            <div class="flex-1 p-12 flex flex-col justify-between bg-white relative">
                <div class="flex flex-col items-center text-center">
                    <div class="w-24 h-24 rounded-[2.5rem] mb-6 flex items-center justify-center text-white text-3xl font-black shadow-2xl" style="background:${themeColor}">
                        ${student.full_name.charAt(0)}
                    </div>
                    <h2 class="text-2xl font-black text-slate-800 leading-tight">${this._safe(student.full_name)}</h2>
                    <p class="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-[0.3em]">${student.student_id}</p>
                    
                    <div class="grid grid-cols-2 gap-3 w-full mt-10">
                        <div class="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                            <p class="text-[8px] font-black text-indigo-400 uppercase mb-1">Total Paid</p>
                            <p class="text-lg font-black text-indigo-600">₱${totalPaid.toLocaleString()}</p>
                        </div>
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Course</p>
                            <p class="text-xs font-black text-slate-700 truncate">${student.course || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-3 pt-8">
                    <button id="btn-open-receipt-preview" class="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                        <i data-lucide="mail" class="w-4 h-4"></i> Send E-Receipt
                    </button>
                    <button onclick="document.getElementById('finance-modal').classList.replace('flex', 'hidden')" class="w-full py-3 text-slate-300 font-black text-[9px] uppercase tracking-widest hover:text-slate-500 transition-colors">Dismiss</button>
                </div>
            </div>
        `;

        document.getElementById('btn-add-payment')?.addEventListener('click', () => this.submitPayment(student.student_id));
        document.getElementById('btn-open-receipt-preview')?.addEventListener('click', () => this.showEmailPreview(student, totalPaid));
        if (window.lucide) window.lucide.createIcons();
    },

    showEmailPreview(student, amount) {
        const org = this.state.userOrgName;
        const color = org.includes("HERO") ? "#ef4444" : "#4f46e5";
        const lastP = student.payments?.filter(p => p.academic_period_id === this.state.activePeriod?.id).sort((a,b) => b.id - a.id)[0];

        Swal.fire({
            title: '<span class="text-xs font-black uppercase tracking-widest text-slate-400">Digital Receipt Preview</span>',
            html: `
                <div class="text-left mt-4 receipt-font">
                    <div class="bg-white p-8 border-t-[8px] shadow-md text-[11px] mb-6 relative overflow-hidden" style="border-top-color: ${color}">
                        <div class="text-center mb-6">
                            <b style="color: ${color}; font-size: 16px;">${org}</b><br>
                            <span class="text-slate-400 text-[9px] tracking-[0.2em]">OFFICIAL RECEIPT</span>
                        </div>
                        <div class="space-y-2 border-y border-dashed border-slate-200 py-4 my-4">
                            <div class="flex justify-between"><span>OR NO:</span><b>${lastP?.receipt_number || 'PENDING'}</b></div>
                            <div class="flex justify-between"><span>DATE:</span><b>${new Date().toLocaleDateString()}</b></div>
                            <div class="flex justify-between"><span>NAME:</span><b>${student.full_name}</b></div>
                            <div class="flex justify-between text-sm mt-4 border-t border-slate-100 pt-4"><span>TOTAL:</span><b style="color: ${color}">₱${amount.toLocaleString()}</b></div>
                        </div>
                        <p class="text-center text-[8px] text-slate-300 uppercase italic">Validated Proof of Payment</p>
                    </div>
                    <div class="space-y-2 px-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase ml-1">Send to Email:</label>
                        <input type="email" id="manual-email-entry" value="${student.email || ''}" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all text-sm">
                    </div>
                </div>
            `,
            showCancelButton: true, confirmButtonText: 'Send Receipt', confirmButtonColor: color,
            preConfirm: () => {
                const email = document.getElementById('manual-email-entry').value;
                return (email && email.includes('@')) ? email : Swal.showValidationMessage('Valid email required');
            }
        }).then(res => res.isConfirmed && this.sendReceiptEmail({...student, email: res.value}, amount));
    },

    async submitPayment(studentId) {
        const amt = document.getElementById('pay-amount').value;
        if (!amt || amt <= 0) return this.notify("Valid amount required", "error");

        const or = `OR-${studentId.slice(-4)}${Date.now().toString().slice(-4)}`;
        try {
            const { error } = await supabase.from('payments').insert([{ student_id: studentId, amount_paid: parseFloat(amt), receipt_number: or, academic_period_id: this.state.activePeriod?.id }]);
            if (error) throw error;
            this.notify(`Success: ${or}`, "success");
            await this.fetchStudents();
            this.viewStudentFinance(studentId);
        } catch (e) { this.notify(e.message, "error"); }
    },

    async sendReceiptEmail(student, amount) {
        this.notify("Sending Receipt...", "info");
        const lastP = student.payments?.filter(p => p.academic_period_id === this.state.activePeriod?.id).sort((a,b) => b.id - a.id)[0];
        const payload = { recipientEmail: student.email, studentName: student.full_name, studentId: student.student_id, orNumber: lastP?.receipt_number || 'N/A', amount: amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), orgName: this.state.userOrgName, semester: `${this.state.activePeriod?.semester} ${this.state.activePeriod?.year_range}`, date: new Date().toLocaleDateString() };

        try {
            const GAS_URL = "https://script.google.com/macros/s/AKfycbwg4qrxrd85O2WvfAQkvpu43iKcLpeyYDTlMzwWMpYg4ovBrRcjr4SyJTtY-QXf2p77MA/exec";
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
            this.notify("Receipt sent to " + student.email, "success");
        } catch (e) { this.notify("Email Error", "error"); }
    },

    initScanner() {
        const con = document.getElementById('scanner-container');
        con.classList.replace('hidden', 'flex');
        this.state.scanner = new Html5QrcodeScanner("reader", { fps: 20, qrbox: 200 });
        this.state.scanner.render(text => { this.notify("Verified: " + text, "success"); this.closeScanner(); });
    },

    closeScanner() {
        if (this.state.scanner) this.state.scanner.clear().catch(e => console.error(e));
        document.getElementById('scanner-container').classList.replace('flex', 'hidden');
    },

    async executeRollover() {
        const year = document.getElementById('roll-year').value, sem = document.getElementById('roll-sem').value, fee = document.getElementById('roll-fee').value;
        if (!year || !fee) return this.notify("Complete all fields", "warning");

        const res = await Swal.fire({ title: 'Rollover?', text: `Reset collection for ${sem} Sem ${year}?`, icon: 'warning', showCancelButton: true });
        if (res.isConfirmed) {
            try {
                await supabase.from('academic_periods').update({ is_active: false }).eq('is_active', true);
                await supabase.from('academic_periods').insert([{ year_range: year, semester: sem, target_amount: parseFloat(fee), is_active: true }]);
                this.notify("System Updated", "success");
                setTimeout(() => location.reload(), 1500);
            } catch (err) { this.notify(err.message, "error"); }
        }
    },

    printAuditSheet() {
        const activeId = this.state.activePeriod?.id;
        const rows = this.state.students.map(s => `<tr><td style="border:1px solid #ddd;padding:8px">${s.full_name}</td><td style="border:1px solid #ddd;padding:8px">${s.student_id}</td><td style="border:1px solid #ddd;padding:8px">₱${(s.payments?.filter(p => p.academic_period_id === activeId).reduce((sum, p) => sum + p.amount_paid, 0) || 0).toLocaleString()}</td></tr>`).join('');
        document.getElementById('print-area').innerHTML = `<div style="padding:40px; font-family:sans-serif;"><h2>${this.state.userOrgName} Audit (${this.state.activePeriod?.semester} Sem)</h2><table style="width:100%; border-collapse:collapse; margin-top:20px;"><thead><tr style="background:#f2f2f2"><th>Name</th><th>ID</th><th>Paid</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        window.print();
    },

    async fetchStudents(search = '') {
        let q = supabase.from('students').select('*, payments(*)').contains('organization_owner', [this.state.userOrgName]);
        if (search) q = q.or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`);
        const { data } = await q.limit(50);
        this.state.students = data || [];
        this.renderStudentRows();
        this.updateStats();
    },

    renderStudentRows() {
        const body = document.getElementById('finance-list-body'), activeId = this.state.activePeriod?.id;
        if (!body) return;
        body.innerHTML = this.state.students.map(s => {
            const paid = s.payments?.filter(p => p.academic_period_id === activeId).reduce((sum, p) => sum + p.amount_paid, 0) || 0;
            return `<tr class="group hover:bg-indigo-50/50 transition-all border-b border-slate-50" data-student-id="${s.student_id}">
                <td class="p-5">
                    <div class="font-black text-slate-800 text-sm">${this._safe(s.full_name)}</div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${s.student_id}</div>
                </td>
                <td class="p-5 text-right font-black italic ${paid > 0 ? 'text-indigo-600' : 'text-slate-300'} text-sm">₱${paid.toLocaleString()}</td>
                <td class="p-5 text-right"><button class="btn-manage-student px-4 py-2 bg-slate-100 rounded-xl text-[9px] font-black uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all">Manage</button></td>
            </tr>`;
        }).join('');
    },

    updateStats() {
        const activeId = this.state.activePeriod?.id;
        const total = this.state.students.reduce((acc, s) => acc + (s.payments?.filter(p => p.academic_period_id === activeId).reduce((sum, p) => sum + p.amount_paid, 0) || 0), 0);
        const el = document.getElementById('total-val');
        if (el) el.innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    },

    async fetchMetadata() {
        const { data } = await supabase.from('academic_periods').select('*').order('created_at', { ascending: false });
        this.state.allPeriods = data || [];
        this.state.activePeriod = data?.find(p => p.is_active) || data?.[0];
    }
};

window.financeModule = financeModule;
