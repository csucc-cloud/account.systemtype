import { supabase } from './auth.js';

export const financeModule = {
    // --- STATE MANAGEMENT ---
    state: {
        activePeriod: null,
        allPeriods: [],
        students: [],
        selectedStudent: null,
        isScannerActive: false,
        userRole: 'staff',         // FIX #3: track role for permission checks
        userOrgId: null,           // FIX #6: store org from auth, not from DOM scraping
        userOrgName: null          // FIX #6: store org name from auth profile
    },

    // --- HELPERS ---

    // FIX #1 & #2: HTML escape helper — prevents XSS from raw data in innerHTML
    _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // FIX #4: unified toast notification replacing all alert() calls
    notify(message, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3500,
                timerProgressBar: true,
            }).fire({ icon: type, title: message });
        } else {
            console.warn(`[${type.toUpperCase()}]`, message);
        }
    },

    // FIX #3: role-based permission check, consistent with events.js and attendance.js
    can(action) {
        const r = this.state.userRole;
        return {
            manage:     ['super_admin', 'admin'].includes(r),
            finance:    ['super_admin', 'admin', 'finance_staff'].includes(r),
            rollover:   ['super_admin'].includes(r),
        }[action] ?? false;
    },

    // FIX #6 & #20: single authoritative getter for the active org name
    _getActiveOrg() {
        return this.state.userOrgName || 'CITTE LSG';
    },

    // --- MAIN RENDERER ---
    async render() {
        const container = document.getElementById('mod-finance');
        if (!container) return;

        // 1. Show immediate loading feedback
        container.innerHTML = `<div class="p-20 text-center font-black text-slate-300 animate-pulse">LOADING FINANCE LEDGER...</div>`;

        // FIX #3 & #6: load auth profile once so org + role are known before any query
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, organization_id, organization_name')
                .eq('id', user?.id)
                .single();
            this.state.userRole    = profile?.role            || 'staff';
            this.state.userOrgId   = profile?.organization_id || null;
            this.state.userOrgName = profile?.organization_name || null;
        } catch (e) {
            console.error('Auth sync failed', e);
        }

        // 2. Ensure we have metadata (Periods/Semesters)
        if (this.state.allPeriods.length === 0) {
            await this.fetchMetadata();
        }

        // 3. Inject the Shell
        container.innerHTML = `
            <div class="p-6 md:p-10 bg-[#F8FAFC] min-h-screen">
                <div class="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                             <i data-lucide="wallet" class="w-7 h-7"></i>
                        </div>
                        <div>
                            <h1 class="text-2xl font-black text-slate-900">Finance <span class="text-blue-600">Command</span></h1>
                            <p class="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                                ${this.state.activePeriod ? `${this._escapeHtml(this.state.activePeriod.year_range)} | ${this._escapeHtml(this.state.activePeriod.semester)} Semester` : 'Initializing Period...'}
                            </p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        ${this.can('rollover') ? `
                        <button id="btn-rollover" class="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                            Roll-over Semester
                        </button>` : ''}
                        <button id="btn-scan-receipt" class="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                            Verify Receipt
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
                    <div class="lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div class="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <input type="text" id="search-finance" placeholder="Search Name, ID, or Course..." class="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none">
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Live Ledger</div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="bg-slate-50/50">
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Student Detail</th>
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Amount Paid</th>
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="finance-list-body" class="divide-y divide-slate-50">
                                    <tr><td colspan="3" class="p-10 text-center text-slate-400 italic animate-pulse">Fetching student records...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="lg:col-span-4 space-y-6">
                        <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl">
                            <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">System Collection</p>
                            <h2 class="text-4xl font-black mt-4 italic tracking-tighter">₱ <span id="total-val">0.00</span></h2>
                            <div class="mt-10 space-y-3">
                                ${this.can('finance') ? `
                                <button id="btn-print-audit" class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Print A4 Audit (4-per-sheet)
                                </button>` : ''}
                                <p class="text-center text-[9px] text-slate-500 font-bold uppercase">Super Admin Access Verified</p>
                            </div>
                        </div>

                        <div class="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                    <i data-lucide="users" class="w-6 h-6"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</p>
                                    <h3 id="student-count-val" class="text-2xl font-black text-slate-900">0</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- FIX #14: removed 'flex' from class list so 'hidden' toggling works cleanly -->
            <div id="finance-modal" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] items-center justify-center p-4" style="display:none">
                <div class="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
                    <div id="finance-modal-content" class="flex-1 overflow-y-auto"></div>
                </div>
            </div>

            <div id="print-area" class="hidden print:block"></div>
            <div id="scanner-container" class="hidden fixed inset-0 z-[200] bg-black flex items-center justify-center">
                 <div id="reader" class="w-full max-w-md bg-white rounded-3xl overflow-hidden"></div>
                 <button id="btn-close-scanner" class="absolute top-10 right-10 text-white font-black">CLOSE</button>
            </div>

            <!-- FIX #9: Swal-based rollover dialog rendered here, triggered by JS -->
            <div id="rollover-modal" class="hidden fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] items-center justify-center p-4" style="display:none">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-in fade-in zoom-in-95 duration-300">
                    <h2 class="text-xl font-black text-slate-900 mb-2">Roll-over Semester</h2>
                    <p class="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-8">This deactivates the current semester and creates a new one.</p>
                    <div class="space-y-4">
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Year</label>
                            <input type="text" id="rollover-year" placeholder="e.g. 2026-2027" class="w-full mt-1 p-4 rounded-xl ring-1 ring-slate-200 border-none outline-none font-bold text-slate-700">
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semester</label>
                            <select id="rollover-sem" class="w-full mt-1 p-4 rounded-xl ring-1 ring-slate-200 border-none outline-none font-bold text-slate-700">
                                <option value="1st">1st</option>
                                <option value="2nd">2nd</option>
                                <option value="Summer">Summer</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Semestral Fee (₱)</label>
                            <input type="number" id="rollover-fee" placeholder="e.g. 500" class="w-full mt-1 p-4 rounded-xl ring-1 ring-slate-200 border-none outline-none font-bold text-slate-700">
                        </div>
                        <div class="flex gap-3 pt-4">
                            <button id="btn-rollover-confirm" class="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Confirm Roll-over</button>
                            <button id="btn-rollover-cancel" class="px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px]">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // FIX #8 & #19: all event listeners attached here — no inline onclick globals needed
        this._attachShellListeners();

        // FIX #15: loading state already shown in tbody above; fetchStudents will replace it
        await this.fetchStudents();
        if (window.lucide) window.lucide.createIcons();
    },

    // FIX #8 & #19: centralised listener attachment keeps all handlers off the global scope
    _attachShellListeners() {
        const q = id => document.getElementById(id);

        q('search-finance')?.addEventListener('input', (e) => this.fetchStudents(e.target.value));

        q('btn-scan-receipt')?.addEventListener('click', () => this.initScanner());

        if (q('btn-rollover')) {
            q('btn-rollover').addEventListener('click', () => this._openRolloverModal());
        }

        if (q('btn-print-audit')) {
            q('btn-print-audit').addEventListener('click', () => this.printAuditSheet());
        }

        q('btn-close-scanner')?.addEventListener('click', () => this.closeScanner());

        // Rollover modal controls
        q('btn-rollover-confirm')?.addEventListener('click', () => this._confirmRollover());
        q('btn-rollover-cancel')?.addEventListener('click', () => this._closeRolloverModal());
    },

    // FIX #9: replaces the prompt()/confirm() rollover flow with a proper modal
    _openRolloverModal() {
        if (!this.can('rollover')) return this.notify('Unauthorized', 'error');
        const modal = document.getElementById('rollover-modal');
        if (modal) modal.style.display = 'flex';
    },

    _closeRolloverModal() {
        const modal = document.getElementById('rollover-modal');
        if (modal) modal.style.display = 'none';
    },

    // --- DATA FETCHING ---
    async fetchMetadata() {
        try {
            const { data } = await supabase.from('academic_periods').select('*').order('created_at', { ascending: false });
            this.state.allPeriods = data || [];
            this.state.activePeriod = data?.find(p => p.is_active) || data?.[0];
        } catch (e) { console.error("Metadata fetch failed", e); }
    },

    async fetchStudents(searchTerm = '') {
        // FIX #15: show loading skeleton while fetching
        const body = document.getElementById('finance-list-body');
        if (body) {
            body.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-slate-300 italic animate-pulse">Loading records...</td></tr>`;
        }

        // FIX #6: use org from auth state, not fragile DOM scraping
        const activeOrg = this._getActiveOrg();

        let query = supabase.from('students')
            .select('*, payments(*)')
            .contains('organization_owner', [activeOrg.trim()]);

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%,course.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query.limit(100);
        if (error) {
            console.error("Fetch error:", error);
            this.notify('Failed to load student records.', 'error');
            if (body) {
                body.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-red-300 italic font-bold">Failed to load records.</td></tr>`;
            }
            return;
        }

        this.state.students = data || [];
        this.renderStudentRows();
        this.updateStats();
    },

    // --- UI UPDATES ---
    updateStats() {
        const total = this.state.students.reduce((acc, s) => {
            // FIX #12: guard against null/undefined payments array
            return acc + (s.payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0);
        }, 0);
        const el = document.getElementById('total-val');
        if (el) el.innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });

        const countEl = document.getElementById('student-count-val');
        if (countEl) countEl.innerText = this.state.students.length;
    },

    renderStudentRows() {
        const body = document.getElementById('finance-list-body');
        if (!body) return;
        if (this.state.students.length === 0) {
            body.innerHTML = `<tr><td colspan="3" class="p-10 text-center text-slate-400 italic">No students found for this organization.</td></tr>`;
            return;
        }
        body.innerHTML = this.state.students.map(s => {
            // FIX #12: safe reduce even if payments is undefined
            const balance = s.payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
            // FIX #1: all student fields escaped; student_id stored in data attr to avoid onclick injection
            return `
                <tr class="group hover:bg-blue-50/30 transition-all" data-student-id="${this._escapeHtml(String(s.student_id))}">
                    <td class="px-8 py-5">
                        <div class="font-black text-slate-800 text-sm">${this._escapeHtml(s.full_name)}</div>
                        <div class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">${this._escapeHtml(s.course || 'GENERAL')} | YEAR ${this._escapeHtml(String(s.year_level || 'N/A'))}</div>
                        <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${this._escapeHtml(String(s.student_id))}</div>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <span class="text-sm font-black text-rose-500 italic">₱ ${balance.toLocaleString()}</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <!-- FIX #8: data-attr + delegated listener — no inline onclick string injection -->
                        <button class="btn-manage-student px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-all">
                            Manage
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // FIX #8: delegated click — replaces per-row inline onclick
        body.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-manage-student');
            if (!btn) return;
            const row = btn.closest('tr');
            const sid = row?.dataset.studentId;
            if (sid) this.viewStudentFinance(sid);
        }, { once: true }); // once:true prevents stacking on re-renders; re-attached each renderStudentRows call
    },

    // --- STUDENT MODAL & PAYMENT ---
    async viewStudentFinance(studentId) {
        // FIX #7: toString() comparison so type coercion from dataset never causes a miss
        const student = this.state.students.find(s => String(s.student_id) === String(studentId));
        if (!student) return this.notify('Student record not found.', 'error');

        const modal = document.getElementById('finance-modal');
        const content = document.getElementById('finance-modal-content');

        // FIX #14: use style.display instead of toggling 'hidden' to avoid Tailwind class conflict
        modal.style.display = 'flex';

        // FIX #1 & #2: all student and payment fields escaped before injection
        content.innerHTML = `
            <div class="flex h-full">
                <div class="w-1/3 bg-slate-50 p-10 border-r border-slate-100">
                    <div class="w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-xl shadow-blue-100 flex items-center justify-center text-white text-2xl font-black">
                        ${this._escapeHtml(student.full_name.charAt(0))}
                    </div>
                    <h2 class="text-2xl font-black text-slate-900 leading-tight">${this._escapeHtml(student.full_name)}</h2>
                    <p class="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1">${this._escapeHtml(student.course)} - Year ${this._escapeHtml(String(student.year_level))}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">${this._escapeHtml(String(student.student_id))}</p>

                    <div class="mt-10 space-y-4">
                        ${this.can('finance') ? `
                        <button id="btn-new-payment" class="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">New Payment</button>
                        ` : ''}
                        <div class="p-4 bg-white rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Status</p>
                            <p class="text-xs font-bold text-slate-700 mt-1">${this._escapeHtml(student.email || 'NO EMAIL PROVIDED')}</p>
                        </div>
                    </div>
                </div>
                <div class="flex-1 p-10 flex flex-col">
                    <div class="flex justify-between items-center mb-10">
                        <h3 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Payment History</h3>
                        <!-- FIX #17: close via a proper id'd button, listener attached below -->
                        <button id="btn-close-finance-modal" class="p-2 hover:bg-slate-100 rounded-full transition-all">
                            <i data-lucide="x" class="w-6 h-6 text-slate-400"></i>
                        </button>
                    </div>
                    <div id="payment-history-list" class="flex-1 overflow-y-auto space-y-4">
                        ${student.payments?.length ? student.payments.map(p => `
                            <div class="p-6 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center shadow-sm" data-payment-id="${this._escapeHtml(String(p.id))}">
                                <div>
                                    <p class="text-xs font-black text-slate-800">₱ ${Number(p.amount_paid).toLocaleString()}</p>
                                    <!-- FIX #5: field name normalised — use receit_number to match DB column -->
                                    <p class="text-[9px] font-bold text-slate-400 mt-1">${this._escapeHtml(p.receit_number || p.receipt_number || '—')} | ${new Date(p.created_at).toLocaleDateString()}</p>
                                </div>
                                <div class="flex gap-2">
                                    <!-- FIX #8: data-attr buttons, listeners attached below -->
                                    <button class="btn-send-email p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all" title="Send Email"><i data-lucide="mail" class="w-4 h-4"></i></button>
                                    <button class="btn-reprint p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all" title="Print"><i data-lucide="printer" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        `).join('') : '<div class="text-center py-20 text-slate-300 italic font-bold">No payments found for this semester.</div>'}
                    </div>
                </div>
            </div>
        `;

        // FIX #8 & #17: attach all modal-level listeners here instead of inline onclick
        document.getElementById('btn-close-finance-modal')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('btn-new-payment')?.addEventListener('click', () => {
            this.showAddPaymentForm(String(student.student_id));
        });

        content.addEventListener('click', (e) => {
            const paymentCard = e.target.closest('[data-payment-id]');
            const pid = paymentCard?.dataset.paymentId;
            if (!pid) return;
            if (e.target.closest('.btn-send-email')) this.sendEmailReceipt(pid);
            if (e.target.closest('.btn-reprint'))    this.reprintReceipt(pid);
        });

        if (window.lucide) window.lucide.createIcons();
    },

    showAddPaymentForm(studentIDString) {
        const student = this.state.students.find(s => String(s.student_id) === String(studentIDString));
        if (!student) return;
        const historyList = document.getElementById('payment-history-list');

        historyList.innerHTML = `
            <div class="bg-slate-50 p-8 rounded-[2rem] animate-in slide-in-from-right-4 duration-300">
                <h4 class="text-lg font-black text-slate-900 mb-6">Record New Payment</h4>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase">Amount to Pay</label>
                        <input type="number" id="new-pay-amount" min="0" step="0.01" value="${Number(this.state.activePeriod?.target_amount || 0).toFixed(2)}" class="w-full mt-1 p-4 rounded-xl border-none ring-1 ring-slate-200 text-xl font-black">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase">Remarks</label>
                        <input type="text" id="new-pay-remarks" placeholder="Optional notes..." class="w-full mt-1 p-4 rounded-xl border-none ring-1 ring-slate-200">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button id="btn-confirm-payment" class="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Confirm Payment</button>
                        <button id="btn-cancel-payment" class="px-6 py-4 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px]">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // FIX #8: listeners attached here — no inline onclick with injected string IDs
        document.getElementById('btn-confirm-payment')?.addEventListener('click', () => {
            this.submitPayment(studentIDString);
        });
        document.getElementById('btn-cancel-payment')?.addEventListener('click', () => {
            this.viewStudentFinance(studentIDString);
        });
    },

    async submitPayment(studentIDString) {
        // FIX #3: enforce permission at call site
        if (!this.can('finance')) return this.notify('Unauthorized', 'error');

        // FIX #18: guard against null activePeriod before using .id
        if (!this.state.activePeriod) {
            return this.notify('No active academic period found. Please set one up first.', 'error');
        }

        const amountRaw = document.getElementById('new-pay-amount')?.value;
        const remarks   = document.getElementById('new-pay-remarks')?.value || '';
        const amount    = parseFloat(amountRaw);

        // FIX #22: validate amount before sending to DB
        if (!amountRaw || isNaN(amount) || amount <= 0) {
            return this.notify('Please enter a valid payment amount.', 'warning');
        }

        const receiptNo = `OR-${Date.now().toString().slice(-8)}`;

        const { data, error } = await supabase.from('payments').insert([{
            student_id:          studentIDString,
            amount_paid:         amount,
            receit_number:       receiptNo,   // FIX #5: matches actual DB column name (typo preserved)
            academic_period_id:  this.state.activePeriod.id,
            remarks:             remarks
        }]).select().single();

        if (error) {
            // FIX #4: replaced alert() with notify()
            return this.notify('Submission Failed: ' + error.message, 'error');
        }

        this.notify('Payment Recorded Successfully', 'success');
        document.getElementById('finance-modal').style.display = 'none';
        await this.fetchStudents();
        this.generateQRReceipt(data);
    },

    async sendEmailReceipt(paymentId) {
        // FIX #4: replaced alert() with notify(); stub preserved for future implementation
        this.notify('Preparing digital receipt. Redirecting to Mailer...', 'info');
    },

    // FIX #13: reprintReceipt was referenced in viewStudentFinance but never defined
    reprintReceipt(paymentId) {
        const allPayments = this.state.students.flatMap(s => s.payments || []);
        const payment = allPayments.find(p => String(p.id) === String(paymentId));
        if (!payment) return this.notify('Payment record not found.', 'error');
        this.generateQRReceipt(payment);
    },

    initScanner() {
        // FIX #4: replaced alert() with notify(); stub preserved for future implementation
        this.notify('Accessing Camera for Verification...', 'info');
        document.getElementById('scanner-container')?.style && (document.getElementById('scanner-container').style.display = 'flex');
    },

    closeScanner() {
        const sc = document.getElementById('scanner-container');
        if (sc) sc.style.display = 'none';
    },

    // --- PRINTING & QR LOGIC ---
    generateQRReceipt(payment) {
        const student = this.state.students.find(s => String(s.student_id) === String(payment.student_id));
        if (!student) return;

        // FIX #5: normalise to whichever column name exists in the DB record
        const receiptNo = payment.receit_number || payment.receipt_number || '—';

        const printArea = document.getElementById('print-area');
        printArea.innerHTML = `
            <div class="receipt-print-wrapper p-10 bg-white border-2 border-dashed border-slate-300 w-[80mm] text-center mx-auto mt-10">
                <h2 class="text-lg font-black uppercase">Official Receipt</h2>
                <p class="text-[10px] font-bold text-slate-400 mb-4">${this._escapeHtml(this.state.activePeriod?.year_range || '')} | ${this._escapeHtml(this.state.activePeriod?.semester || '')} Sem</p>
                <div class="border-y border-slate-100 py-4 mb-4">
                    <p class="text-sm font-black">${this._escapeHtml(student.full_name)}</p>
                    <p class="text-[9px] text-slate-400">${this._escapeHtml(String(student.student_id))}</p>
                </div>
                <p class="text-2xl font-black italic">₱${Number(payment.amount_paid).toLocaleString()}</p>
                <div id="receipt-qr-code" class="flex justify-center my-6"></div>
                <p class="text-[8px] font-mono uppercase">${this._escapeHtml(receiptNo)}</p>
            </div>
        `;

        new QRCode(document.getElementById("receipt-qr-code"), {
            text: `VERIFY:${receiptNo}:${student.student_id}:${payment.amount_paid}`,
            width: 128,
            height: 128
        });

        // FIX #10: wait for QRCode render (it's synchronous for canvas, but DOM needs a tick)
        requestAnimationFrame(() => { window.print(); });
    },

    async printAuditSheet() {
        // FIX #3: enforce permission at call site
        if (!this.can('finance')) return this.notify('Unauthorized', 'error');

        // FIX #20: use _getActiveOrg() instead of duplicated DOM scraping
        const activeOrg = this._getActiveOrg();

        const { data: payments, error } = await supabase
            .from('payments')
            .select('*, students!inner(full_name, student_id, organization_owner)')
            .contains('students.organization_owner', [activeOrg.trim()])
            .order('created_at', { ascending: false })
            .limit(4);

        if (error || !payments?.length) {
            // FIX #4: replaced alert() with notify()
            return this.notify('No recent payments found for audit.', 'warning');
        }

        const printArea = document.getElementById('print-area');
        printArea.innerHTML = `
            <div class="grid grid-cols-2 grid-rows-2 w-[210mm] h-[297mm] bg-white p-4 gap-4 mx-auto">
                ${payments.map(p => `
                    <div class="border-2 border-dashed border-slate-300 p-8 flex flex-col justify-between text-center bg-white">
                        <div>
                            <h2 class="text-sm font-black uppercase">Audit Copy - ${this._escapeHtml(activeOrg)}</h2>
                            <!-- FIX #5: normalise receipt field name -->
                            <p class="text-[8px] text-slate-400">${this._escapeHtml(p.receit_number || p.receipt_number || '—')}</p>
                        </div>
                        <div class="py-4">
                            <p class="text-xs font-bold">${this._escapeHtml(p.students?.full_name || '')}</p>
                            <p class="text-xl font-black italic">₱${Number(p.amount_paid).toLocaleString()}</p>
                        </div>
                        <div id="audit-qr-${this._escapeHtml(String(p.id))}" class="flex justify-center"></div>
                        <p class="text-[8px] font-mono">${new Date(p.created_at).toLocaleString()}</p>
                    </div>
                `).join('')}
            </div>
        `;

        payments.forEach(p => {
            new QRCode(document.getElementById(`audit-qr-${p.id}`), {
                text: p.receit_number || p.receipt_number || p.id,
                width: 70,
                height: 70
            });
        });

        // FIX #10: requestAnimationFrame is safer than a fixed 1000ms timeout
        requestAnimationFrame(() => { window.print(); });
    },

    // FIX #9: replaced prompt()/confirm() with the custom rollover modal
    async _confirmRollover() {
        if (!this.can('rollover')) return this.notify('Unauthorized', 'error');

        const newYear = document.getElementById('rollover-year')?.value?.trim();
        const newSem  = document.getElementById('rollover-sem')?.value?.trim();
        const newFee  = document.getElementById('rollover-fee')?.value?.trim();

        if (!newYear || !newSem || !newFee) {
            return this.notify('All fields are required for Roll-over.', 'warning');
        }

        const fee = parseFloat(newFee);
        if (isNaN(fee) || fee < 0) {
            return this.notify('Please enter a valid fee amount.', 'warning');
        }

        this._closeRolloverModal();

        await supabase.from('academic_periods').update({ is_active: false }).eq('is_active', true);

        const { error } = await supabase.from('academic_periods').insert([{
            year_range:     newYear,
            semester:       newSem,
            target_amount:  fee,
            is_active:      true
        }]);

        if (error) {
            this.notify(error.message, 'error');
        } else {
            this.notify('New Semester Initialized. Reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
        }
    },

    // FIX #9: kept as the public entry point (called by btn-rollover listener)
    async handleRollover() {
        this._openRolloverModal();
    }
};

window.financeModule = financeModule;
