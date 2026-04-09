import { supabase } from './auth.js';

export const financeModule = {
    state: { 
        activePeriod: null, 
        allPeriods: [], 
        students: [], 
        totalStudentsCount: 0, 
        currentPage: 1, 
        pageSize: 10, 
        userRole: 'staff', 
        userOrgId: null, 
        userOrgName: null, 
        scanner: null,
        isFetching: false // NEW: Guard for race conditions
    },

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

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
                    <div class="lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div class="p-5 border-b border-slate-50 bg-slate-50/50 flex gap-4">
                            <i data-lucide="search" class="w-4 text-slate-400"></i>
                            <input type="text" id="search-finance" placeholder="Search Student..." class="bg-transparent text-sm w-full outline-none font-medium">
                        </div>
                        <div class="flex-1 overflow-x-auto">
                            <table class="w-full text-left">
                                <tbody id="finance-list-body"></tbody>
                            </table>
                        </div>
                        <div class="p-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <button id="prev-page" class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase disabled:opacity-30 hover:bg-slate-50 transition-all">Prev</button>
                            <span id="page-info" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page 1</span>
                            <button id="next-page" class="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase disabled:opacity-30 hover:bg-slate-50 transition-all">Next</button>
                        </div>
                    </div>

                    <div class="lg:col-span-4 space-y-4">
                        <div class="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl">
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Total Collected</p>
                            <h2 class="text-3xl font-black mt-2 italic">₱<span id="total-val">0.00</span></h2>
                        </div>

                        <div class="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Student</p>
                            <h2 class="text-3xl font-black mt-2 italic" id="stat-total-students">0</h2>
                        </div>

                        <div class="bg-white p-8 rounded-[2.5rem] text-slate-800 shadow-sm border border-slate-100">
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Needed</p>
                            <h2 class="text-3xl font-black mt-2 italic text-indigo-600">₱<span id="stat-needed">0.00</span></h2>
                        </div>

                        <button id="btn-print-audit" class="w-full py-5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">Export Audit Sheet</button>
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
        let searchTimeout;
        d.getElementById('search-finance')?.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.state.currentPage = 1;
                this.fetchStudents(e.target.value);
            }, 300); // FIX: Debounce logic to prevent race conditions
        });

        d.getElementById('prev-page')?.addEventListener('click', () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.fetchStudents(d.getElementById('search-finance').value);
            }
        });

        d.getElementById('next-page')?.addEventListener('click', () => {
            const maxPage = Math.ceil(this.state.totalStudentsCount / this.state.pageSize);
            if (this.state.currentPage < maxPage) {
                this.state.currentPage++;
                this.fetchStudents(d.getElementById('search-finance').value);
            }
        });

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

    async fetchStudents(search = '') {
        if (this.state.isFetching) return; // FIX: Race condition guard
        this.state.isFetching = true;

        const start = (this.state.currentPage - 1) * this.state.pageSize;
        const end = start + this.state.pageSize - 1;

        try {
            // FIX: Search filter applied to count query for correct pagination
            let countQuery = supabase.from('students').select('*', { count: 'exact', head: true }).contains('organization_owner', [this.state.userOrgName]);
            if (search) countQuery = countQuery.or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`);
            const { count } = await countQuery;
            this.state.totalStudentsCount = count || 0;

            let q = supabase.from('students').select('*, payments(*)').contains('organization_owner', [this.state.userOrgName]);
            if (search) q = q.or(`full_name.ilike.%${search}%,student_id.ilike.%${search}%`);
            
            const { data } = await q.order('full_name', { ascending: true }).range(start, end);
            this.state.students = data || [];

            this.renderStudentRows();
            this.updatePaginationUI();
            await this.updateStats(); // Optimized stats inside
        } finally {
            this.state.isFetching = false;
        }
    },

    updatePaginationUI() {
        const maxPage = Math.ceil(this.state.totalStudentsCount / this.state.pageSize);
        const info = document.getElementById('page-info');
        if (info) info.innerText = `Page ${this.state.currentPage} of ${maxPage || 1}`;
        document.getElementById('prev-page').disabled = this.state.currentPage === 1;
        document.getElementById('next-page').disabled = this.state.currentPage >= maxPage || this.state.totalStudentsCount === 0;
    },

    async updateStats() {
        const activeId = this.state.activePeriod?.id;
        const targetFee = this.state.activePeriod?.target_amount || 0;

        // FIX: Optimized sum aggregation. We only fetch the specific column needed.
        const { data: payments } = await supabase.from('payments').select('amount_paid').eq('academic_period_id', activeId);
        const totalCollected = payments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;

        // Fetch full org count for accurate "Total Needed" (ignores current search)
        const { count: fullOrgCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).contains('organization_owner', [this.state.userOrgName]);
        const totalNeeded = (fullOrgCount || 0) * targetFee;

        document.getElementById('total-val').innerText = totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('stat-total-students').innerText = (fullOrgCount || 0).toLocaleString();
        document.getElementById('stat-needed').innerText = totalNeeded.toLocaleString(undefined, { minimumFractionDigits: 2 });
    },

    // --- REMAINING METHODS (UNTOUCHED LOGIC) ---
    async viewStudentFinance(studentId) {
        const student = this.state.students.find(s => String(s.student_id) === String(studentId));
        if (!student) return;
        const currentPeriodId = this.state.activePeriod?.id;
        const totalPaid = student.payments?.filter(p => p.academic_period_id === currentPeriodId).reduce((s, p) => s + p.amount_paid, 0) || 0;
        const themeColor = this.state.userOrgName.includes("HERO") ? "#ef4444" : "#4f46e5";
        document.getElementById('finance-modal').classList.replace('hidden', 'flex');
        document.getElementById('finance-modal-content').innerHTML = `
            <div class="flex-[1.2] p-10 flex flex-col bg-slate-50 border-r border-slate-100">
                <div class="mb-6 flex justify-between items-center"><h3 class="font-black text-slate-400 uppercase tracking-widest text-[10px]">Logs</h3></div>
                <div class="flex-1 overflow-y-auto pr-2 space-y-2">
                    ${student.payments?.length ? student.payments.sort((a,b) => b.id - a.id).map(p => `<div class="p-4 bg-white rounded-2xl flex justify-between"><b>${p.receipt_number}</b><b>₱${p.amount_paid.toLocaleString()}</b></div>`).join('') : '<div class="text-center text-slate-300 mt-10">No logs</div>'}
                </div>
                ${this.can('finance') ? `<div class="mt-6 flex gap-2"><input type="number" id="pay-amount" placeholder="0.00" class="flex-1 p-4 bg-white rounded-2xl outline-none shadow-sm"><button id="btn-add-payment" class="px-8 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Record</button></div>` : ''}
            </div>
            <div class="flex-1 p-12 flex flex-col justify-between bg-white text-center">
                <div>
                    <div class="w-20 h-20 rounded-[1.5rem] mb-6 mx-auto flex items-center justify-center text-white text-2xl font-black" style="background:${themeColor}">${student.full_name[0]}</div>
                    <h2 class="text-xl font-black text-slate-800">${this._safe(student.full_name)}</h2>
                    <div class="p-4 bg-indigo-50/50 rounded-2xl mt-8">
                        <p class="text-[8px] font-black text-indigo-400 uppercase">Paid</p>
                        <p class="text-lg font-black text-indigo-600">₱${totalPaid.toLocaleString()}</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <button id="btn-open-receipt-preview" class="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase">E-Receipt</button>
                    <button onclick="document.getElementById('finance-modal').classList.replace('flex', 'hidden')" class="w-full py-2 text-slate-300 text-[9px] uppercase font-bold">Dismiss</button>
                </div>
            </div>`;
        document.getElementById('btn-add-payment')?.addEventListener('click', () => this.submitPayment(student.student_id));
        document.getElementById('btn-open-receipt-preview')?.addEventListener('click', () => this.showEmailPreview(student, totalPaid));
        if (window.lucide) window.lucide.createIcons();
    },

    showEmailPreview(student, amount) {
        const org = this.state.userOrgName;
        const color = org.includes("HERO") ? "#ef4444" : "#4f46e5";
        const lastP = student.payments?.filter(p => p.academic_period_id === this.state.activePeriod?.id).sort((a,b) => b.id - a.id)[0];
        Swal.fire({
            title: '<span class="text-xs font-black uppercase tracking-widest text-slate-400">Preview</span>',
            html: `<div class="text-left mt-4 receipt-font"><div class="bg-white p-8 border-t-[8px] shadow-md text-[11px] mb-6" style="border-top-color: ${color}"><div class="text-center mb-6"><b style="color: ${color}">${org}</b></div><div class="flex justify-between"><span>OR NO:</span><b>${lastP?.receipt_number || 'PENDING'}</b></div><div class="flex justify-between"><span>NAME:</span><b>${student.full_name}</b></div><div class="flex justify-between text-sm mt-4 border-t border-slate-100 pt-4"><span>TOTAL:</span><b style="color: ${color}">₱${amount.toLocaleString()}</b></div></div><input type="email" id="manual-email-entry" value="${student.email || ''}" class="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none text-sm"></div>`,
            showCancelButton: true, confirmButtonText: 'Send', confirmButtonColor: color,
            preConfirm: () => { const e = document.getElementById('manual-email-entry').value; return (e && e.includes('@')) ? e : Swal.showValidationMessage('Valid email required'); }
        }).then(res => res.isConfirmed && this.sendReceiptEmail({...student, email: res.value}, amount));
    },

    async submitPayment(studentId) {
        const amt = document.getElementById('pay-amount').value;
        if (!amt || amt <= 0) return this.notify("Valid amount required", "error");
        const or = `OR-${studentId.slice(-4)}${Date.now().toString().slice(-4)}`;
        try {
            await supabase.from('payments').insert([{ student_id: studentId, amount_paid: parseFloat(amt), receipt_number: or, academic_period_id: this.state.activePeriod?.id }]);
            this.notify(`Success: ${or}`, "success");
            await this.fetchStudents(document.getElementById('search-finance').value);
            this.viewStudentFinance(studentId);
        } catch (e) { this.notify(e.message, "error"); }
    },

    async sendReceiptEmail(student, amount) {
        this.notify("Sending Receipt...", "info");
        
        // Kunin ang pinakabagong payment record para sa active period
        const lastP = student.payments?.filter(p => p.academic_period_id === this.state.activePeriod?.id).sort((a,b) => b.id - a.id)[0];
        
        // Ihanda ang data na ipapadala sa Google Apps Script
        const payload = { 
            recipientEmail: student.email, 
            studentName: student.full_name, 
            studentId: student.student_id, 
            orNumber: lastP?.receipt_number || 'N/A', 
            amount: amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), 
            orgName: this.state.userOrgName, 
            semester: `${this.state.activePeriod?.semester} ${this.state.activePeriod?.year_range}`, 
            date: new Date().toLocaleDateString() 
        };

        try {
            // Direct Link na ang ginamit dito sa halip na environment variable
            const GAS_URL = "https://script.google.com/macros/s/AKfycbwg4qrxrd85O2WvfAQkvpu43iKcLpeyYDTlMzwWMpYg4ovBrRcjr4SyJTtY-QXf2p77MA/exec";
            
            await fetch(GAS_URL, { 
                method: "POST", 
                mode: "no-cors", // Standard ito para sa Google Apps Script redirects
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload) 
            });

            this.notify("Receipt sent to " + student.email, "success");
        } catch (e) { 
            console.error("Email Error:", e);
            this.notify("Email Error", "error"); 
        }
    },

    initScanner() {
        document.getElementById('scanner-container').classList.replace('hidden', 'flex');
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
        document.getElementById('print-area').innerHTML = `<div style="padding:40px;"><h2>${this.state.userOrgName} Audit</h2><table style="width:100%; border-collapse:collapse;">${rows}</table></div>`;
        window.print();
    },

    renderStudentRows() {
        const body = document.getElementById('finance-list-body'), activeId = this.state.activePeriod?.id;
        if (!body) return;
        body.innerHTML = this.state.students.map(s => {
            const paid = s.payments?.filter(p => p.academic_period_id === activeId).reduce((sum, p) => sum + p.amount_paid, 0) || 0;
            return `<tr class="group hover:bg-indigo-50/50 border-b border-slate-50" data-student-id="${s.student_id}">
                <td class="p-5">
                    <div class="font-black text-slate-800 text-sm">${this._safe(s.full_name)}</div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${s.student_id}</div>
                </td>
                <td class="p-5 text-right font-black italic ${paid > 0 ? 'text-indigo-600' : 'text-slate-300'} text-sm">₱${paid.toLocaleString()}</td>
                <td class="p-5 text-right"><button class="btn-manage-student px-4 py-2 bg-slate-100 rounded-xl text-[9px] font-black uppercase">Manage</button></td>
            </tr>`;
        }).join('');
    },

    async fetchMetadata() {
        const { data } = await supabase.from('academic_periods').select('*').order('created_at', { ascending: false });
        this.state.allPeriods = data || [];
        this.state.activePeriod = data?.find(p => p.is_active) || data?.[0];
    }
};

window.financeModule = financeModule;
