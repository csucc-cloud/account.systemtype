import { supabase } from './auth.js';

export const financeModule = {
    state: {
        activePeriod: null,
        allPeriods: [],
        students: [],
        selectedStudent: null,
        userRole: 'staff',
        userOrgId: null,
        userOrgName: null,
        scanner: null
    },

    // --- SECURITY & HELPERS ---
    _escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    notify(message, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, timerProgressBar: true })
                .fire({ icon: type, title: message });
        }
    },

    can(action) {
        const r = this.state.userRole;
        return {
            manage: ['super_admin', 'admin'].includes(r),
            finance: ['super_admin', 'admin', 'finance_staff'].includes(r),
            rollover: ['super_admin'].includes(r)
        }[action] ?? false;
    },

    // --- MAIN RENDERER ---
    async render() {
        const container = document.getElementById('mod-finance');
        if (!container) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
            this.state.userRole = profile?.role || 'staff';
            this.state.userOrgId = profile?.organization_id;
            this.state.userOrgName = profile?.organization_name || 'CITTE LSG';
        } catch (e) { console.error(e); }

        if (this.state.allPeriods.length === 0) await this.fetchMetadata();

        container.innerHTML = `
            <style>
                @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
                .scanner-laser {
                    position: absolute; width: 100%; height: 2px;
                    background: #2563eb; box-shadow: 0 0 15px #3b82f6;
                    animation: scan 2s infinite linear; z-index: 10;
                }
                .qr-overlay {
                    position: absolute; inset: 0; border: 2px solid rgba(255,255,255,0.1);
                    background: linear-gradient(rgba(0,0,0,0.5), transparent 20%, transparent 80%, rgba(0,0,0,0.5));
                }
                .status-pill { padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; }
                .status-paid { background: #dcfce7; color: #166534; }
                .status-partial { background: #fef9c3; color: #854d0e; }
                .text-archived { color: #94a3b8; font-style: italic; }
            </style>

            <div class="p-6 md:p-10 bg-[#F8FAFC] min-h-screen">
                <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                             <i data-lucide="wallet" class="w-7 h-7"></i>
                        </div>
                        <div>
                            <h1 class="text-2xl font-black text-slate-900">Finance <span class="text-blue-600">Command</span></h1>
                            <p class="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                                ${this.state.activePeriod ? `${this.state.activePeriod.year_range} | ${this.state.activePeriod.semester} Sem` : 'No Active Period'}
                            </p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        ${this.can('rollover') ? `<button id="btn-rollover" class="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Roll-over Semester</button>` : ''}
                        <button id="btn-scan-receipt" class="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Verify Receipt</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
                    <div class="lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div class="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <input type="text" id="search-finance" placeholder="Search Name or ID..." class="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <tbody id="finance-list-body" class="divide-y divide-slate-50"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="lg:col-span-4">
                        <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl text-center">
                            <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Total Collection (Current Sem)</p>
                            <h2 class="text-4xl font-black mt-4 italic tracking-tighter">₱ <span id="total-val">0.00</span></h2>
                            <button id="btn-print-audit" class="w-full mt-10 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest">Print Audit</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="rollover-modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[250] flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div class="bg-slate-900 p-10 text-white text-center">
                        <div class="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <i data-lucide="refresh-cw" class="w-8 h-8"></i>
                        </div>
                        <h2 class="text-2xl font-black italic">Semester Transition</h2>
                        <p class="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">Organization Administrative Protocol</p>
                    </div>
                    <div class="p-10 space-y-5">
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Academic Year</label>
                            <input type="text" id="roll-year" placeholder="e.g. 2025-2026" class="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all font-bold">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Active Semester</label>
                            <select id="roll-sem" class="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all font-bold">
                                <option value="1st">1st Semester (Fall)</option>
                                <option value="2nd">2nd Semester (Spring)</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Base Contribution Fee (₱)</label>
                            <input type="number" id="roll-fee" placeholder="0.00" class="w-full p-5 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all font-bold text-blue-600 text-lg">
                        </div>
                        <div class="flex gap-4 pt-6">
                            <button id="btn-confirm-roll" class="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-200">Initialize New Period</button>
                            <button onclick="document.getElementById('rollover-modal').classList.add('hidden')" class="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="scanner-container" class="hidden fixed inset-0 z-[500] bg-slate-900/90 backdrop-blur-2xl flex items-center justify-center flex-col">
                 <div class="relative w-80 h-80 rounded-[3rem] overflow-hidden border-4 border-blue-600 shadow-2xl shadow-blue-500/20">
                     <div id="reader" class="w-full h-full scale-150"></div>
                     <div class="scanner-laser"></div>
                     <div class="qr-overlay"></div>
                 </div>
                 <p class="text-white mt-8 font-black text-xs uppercase tracking-[0.4em] animate-pulse">Align Receipt QR Code</p>
                 <button id="btn-close-scanner" class="mt-12 px-12 py-5 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-transform">Terminate Scan</button>
            </div>

            <div id="finance-modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] items-center justify-center p-4">
                <div id="finance-modal-content" class="w-full max-w-6xl flex flex-col md:flex-row gap-6 h-[85vh]"></div>
            </div>

            <div id="print-area" class="hidden print:block"></div>
        `;

        this._attachShellListeners();
        await this.fetchStudents();
        if (window.lucide) window.lucide.createIcons();
    },

    _attachShellListeners() {
        const q = id => document.getElementById(id);
        q('search-finance')?.addEventListener('input', (e) => this.fetchStudents(e.target.value));
        q('btn-scan-receipt')?.addEventListener('click', () => this.initScanner());
        q('btn-close-scanner')?.addEventListener('click', () => this.closeScanner());
        q('btn-print-audit')?.addEventListener('click', () => this.printAuditSheet());
        q('btn-rollover')?.addEventListener('click', () => q('rollover-modal').classList.remove('hidden'));
        q('btn-confirm-roll')?.addEventListener('click', () => this.executeRollover());

        q('finance-list-body')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-manage-student');
            if (btn) {
                const sid = btn.closest('tr')?.dataset.studentId;
                if (sid) this.viewStudentFinance(sid);
            }
        });
    },

    async viewStudentFinance(studentId) {
        const student = this.state.students.find(s => String(s.student_id) === String(studentId));
        if (!student) return;

        const currentPeriodId = this.state.activePeriod?.id;
        const totalPaidCurrent = student.payments?.filter(p => p.academic_period_id === currentPeriodId)
                                         .reduce((sum, p) => sum + p.amount_paid, 0) || 0;
        
        const targetAmount = this.state.activePeriod?.target_amount || 0;
        const globalStatus = totalPaidCurrent >= targetAmount ? 'Paid' : 'Partial';

        const modal = document.getElementById('finance-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        document.getElementById('finance-modal-content').innerHTML = `
            <div class="flex-[2.5] bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
                <div class="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                    <div>
                        <h3 class="font-black text-slate-900 uppercase tracking-widest text-xs italic">Transaction History</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Payment Ledger Record</p>
                    </div>
                    <span class="status-pill ${globalStatus === 'Paid' ? 'status-paid' : 'status-partial'}">${globalStatus}</span>
                </div>
                
                <div class="flex-1 overflow-y-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="sticky top-0 bg-slate-50/80 backdrop-blur text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                            <tr>
                                <th class="p-6">OR No.</th>
                                <th class="p-6">Period Status</th>
                                <th class="p-6">Amount Paid</th>
                                <th class="p-6 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${student.payments?.length ? student.payments.sort((a,b) => b.id - a.id).map(p => {
                                const isCurrent = p.academic_period_id === currentPeriodId;
                                return `
                                <tr class="hover:bg-slate-50/50 transition-colors ${!isCurrent ? 'opacity-60 grayscale' : ''}">
                                    <td class="p-6 font-bold text-slate-600">${p.receipt_number || '---'}</td>
                                    <td class="p-6">
                                        <div class="font-bold ${isCurrent ? 'text-blue-600' : 'text-slate-400'} text-[11px]">
                                            ${isCurrent ? 'CURRENT SEMESTER' : 'PREVIOUS RECORD'}
                                        </div>
                                    </td>
                                    <td class="p-6 font-black text-blue-600 text-[11px]">₱ ${p.amount_paid.toLocaleString()}</td>
                                    <td class="p-6 text-center">
                                        <span class="status-pill status-paid">${isCurrent ? 'Active' : 'Archived'}</span>
                                    </td>
                                </tr>`;
                            }).join('') : '<tr><td colspan="4" class="p-20 text-center italic text-slate-300 font-bold">No payment history found.</td></tr>'}
                        </tbody>
                    </table>
                </div>

                ${this.can('finance') ? `
                <div class="p-8 bg-slate-50 border-t border-slate-100">
                    <div class="flex gap-4">
                        <input type="number" id="pay-amount" placeholder="Amount" class="flex-1 p-4 bg-white rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold shadow-sm">
                        <button id="btn-add-payment" class="flex-1 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200">Record Payment</button>
                    </div>
                </div>` : ''}
            </div>

            <div class="flex-1 bg-white rounded-[3rem] shadow-2xl p-10 flex flex-col overflow-hidden">
                <div class="flex flex-col items-center text-center mb-8">
                    <div class="w-24 h-24 bg-slate-900 rounded-[2.5rem] mb-6 flex items-center justify-center text-white text-3xl font-black shadow-xl">
                        ${student.full_name.charAt(0)}
                    </div>
                    <h2 class="text-xl font-black text-slate-900 leading-tight">${this._escapeHtml(student.full_name)}</h2>
                    <p class="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2">${student.student_id}</p>
                </div>

                <div class="space-y-4 flex-1">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Course</p>
                            <p class="text-[10px] font-bold text-slate-800 truncate">${student.course || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Year Level</p>
                            <p class="text-[10px] font-bold text-slate-800">${student.year_level || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p class="text-[8px] font-black text-slate-400 uppercase mb-1">Email Address</p>
                        <p class="text-[10px] font-bold text-slate-800 truncate">${student.email || 'No email provided'}</p>
                    </div>

                    <hr class="border-slate-50 my-2">

                    <div class="p-5 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                        <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Paid (Active Sem)</p>
                        <p class="text-lg font-black text-blue-600">₱ ${totalPaidCurrent.toLocaleString()}</p>
                    </div>
                    <div class="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fee Required</p>
                        <p class="text-xs font-black text-slate-800">₱ ${targetAmount.toLocaleString()}</p>
                    </div>
                </div>

                <div class="mt-8 space-y-3">
                    <button class="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="mail" class="w-4 h-4"></i> Send via Email
                    </button>
                    <button onclick="window.print()" class="w-full py-5 bg-white border-2 border-slate-100 text-slate-900 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:border-blue-600 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4"></i> Print Record
                    </button>
                    <button onclick="document.getElementById('finance-modal').classList.add('hidden')" class="w-full py-4 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Close Preview</button>
                </div>
            </div>
        `;

        document.getElementById('btn-add-payment')?.addEventListener('click', () => this.submitPayment(student.student_id));
        if (window.lucide) window.lucide.createIcons();
    },

    async submitPayment(studentId) {
        const amt = document.getElementById('pay-amount').value;
        if (!amt || amt <= 0) return this.notify("Valid amount required", "error");

        const lastFour = String(studentId).slice(-4);
        const ms = Date.now().toString();
        const generatedOR = `OR-${lastFour}${ms}`;

        try {
            const { error } = await supabase.from('payments').insert([{
                student_id: studentId, 
                amount_paid: parseFloat(amt), 
                receipt_number: generatedOR, 
                academic_period_id: this.state.activePeriod?.id
            }]);

            if (error) throw error;
            this.notify(`Payment Recorded: ${generatedOR}`, "success");
            await this.fetchStudents();
            this.viewStudentFinance(studentId);
        } catch (e) { this.notify(e.message, "error"); }
    },

    initScanner() {
        const container = document.getElementById('scanner-container');
        container.classList.remove('hidden');
        container.style.display = 'flex';
        this.state.scanner = new Html5QrcodeScanner("reader", { 
            fps: 20, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0
        });
        this.state.scanner.render((text) => {
            this.notify("Receipt Verified: " + text, "success");
            this.closeScanner();
        }, () => {});
    },

    closeScanner() {
        if (this.state.scanner) this.state.scanner.clear().catch(e => console.error(e));
        document.getElementById('scanner-container').classList.add('hidden');
    },

    async executeRollover() {
        const year = document.getElementById('roll-year').value;
        const sem = document.getElementById('roll-sem').value;
        const fee = document.getElementById('roll-fee').value;
        if (!year || !fee) return this.notify("Complete all fields", "warning");

        const result = await Swal.fire({
            title: 'Confirm Transition?',
            text: `Starting ${sem} Sem ${year}. This resets current collection counts to 0.`,
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Execute'
        });

        if (result.isConfirmed) {
            try {
                await supabase.from('academic_periods').update({ is_active: false }).eq('is_active', true);
                await supabase.from('academic_periods').insert([{ year_range: year, semester: sem, target_amount: parseFloat(fee), is_active: true }]);
                this.notify("System Re-Initialized", "success");
                setTimeout(() => location.reload(), 1500);
            } catch (err) { this.notify(err.message, "error"); }
        }
    },

    printAuditSheet() {
        const activeId = this.state.activePeriod?.id;
        const rows = this.state.students.map(s => {
            const currentTotal = s.payments?.filter(p => p.academic_period_id === activeId)
                                           .reduce((sum, p) => sum + p.amount_paid, 0) || 0;
            return `<tr><td>${s.full_name}</td><td>${s.student_id}</td><td>₱ ${currentTotal.toLocaleString()}</td></tr>`;
        }).join('');
        document.getElementById('print-area').innerHTML = `
            <div style="padding:40px; font-family:sans-serif;">
                <h2>Finance Audit: ${this.state.userOrgName} (${this.state.activePeriod?.semester} Sem)</h2>
                <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                    <thead><tr style="text-align:left; border-bottom:2px solid #000;"><th>Name</th><th>ID</th><th>Paid</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        window.print();
    },

    async fetchStudents(searchTerm = '') {
        let query = supabase.from('students').select('*, payments(*)').contains('organization_owner', [this.state.userOrgName]);
        if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
        const { data } = await query.limit(50);
        this.state.students = data || [];
        this.renderStudentRows();
        this.updateStats();
    },

    renderStudentRows() {
        const body = document.getElementById('finance-list-body');
        if (!body) return;
        const activeId = this.state.activePeriod?.id;

        body.innerHTML = this.state.students.map(s => {
            const currentTotal = s.payments?.filter(p => p.academic_period_id === activeId)
                                             .reduce((sum, p) => sum + p.amount_paid, 0) || 0;
            
            return `
                <tr class="group hover:bg-blue-50/30 transition-all" data-student-id="${s.student_id}">
                    <td class="px-8 py-5">
                        <div class="font-black text-slate-800 text-sm">${this._escapeHtml(s.full_name)}</div>
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${s.student_id}</div>
                    </td>
                    <td class="px-8 py-5 text-right font-black ${currentTotal > 0 ? 'text-blue-600' : 'text-rose-500'} italic">₱ ${currentTotal.toLocaleString()}</td>
                    <td class="px-8 py-5 text-right">
                        <button class="btn-manage-student px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-all">Manage</button>
                    </td>
                </tr>`;
        }).join('');
    },

    updateStats() {
        const activeId = this.state.activePeriod?.id;
        const total = this.state.students.reduce((acc, s) => {
            const currentSum = s.payments?.filter(p => p.academic_period_id === activeId)
                                         .reduce((sum, p) => sum + p.amount_paid, 0) || 0;
            return acc + currentSum;
        }, 0);

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
