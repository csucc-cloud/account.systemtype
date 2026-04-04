import { supabase } from './auth.js';

export const financeModule = {
    state: {
        activePeriod: null,
        allPeriods: [],
        students: [],
        selectedStudent: null,
        isScannerActive: false
    },

    async render() {
        const container = document.getElementById('mod-finance');
        if (!container) return;

        // 1. Show immediate loading feedback
        container.innerHTML = `<div class="p-20 text-center font-black text-slate-300 animate-pulse">LOADING FINANCE LEDGER...</div>`;

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
                                ${this.state.activePeriod ? `${this.state.activePeriod.year_range} | ${this.state.activePeriod.semester} Semester` : 'Initializing Period...'}
                            </p>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="financeModule.handleRollover()" class="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                            Roll-over Semester
                        </button>
                        <button id="btn-scan-receipt" class="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                            Verify Receipt
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
                    <div class="lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div class="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <input type="text" id="search-finance" placeholder="Search Name or ID..." class="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500 outline-none">
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Live Ledger</div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="bg-slate-50/50">
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Student Detail</th>
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Balance</th>
                                        <th class="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="finance-list-body" class="divide-y divide-slate-50">
                                    <tr><td colspan="3" class="p-10 text-center text-slate-400 italic">Fetching student records...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="lg:col-span-4">
                        <div class="bg-gradient-to-br from-slate-800 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl sticky top-10">
                            <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">System Collection</p>
                            <h2 class="text-4xl font-black mt-4 italic tracking-tighter">₱ <span id="total-val">0.00</span></h2>
                            <div class="mt-10 space-y-3">
                                <button onclick="financeModule.printAuditSheet()" class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                    Print A4 Audit (4-per-sheet)
                                </button>
                                <p class="text-center text-[9px] text-slate-500 font-bold uppercase">Super Admin Access Verified</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="finance-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">
                    <div id="finance-modal-content" class="flex-1 overflow-y-auto"></div>
                </div>
            </div>

            <div id="print-area" class="hidden"></div>
        `;

        document.getElementById('search-finance')?.addEventListener('input', (e) => this.fetchStudents(e.target.value));
        await this.fetchStudents();
        if (window.lucide) window.lucide.createIcons();
    },

    async fetchMetadata() {
        try {
            const { data } = await supabase.from('academic_periods').select('*').order('created_at', { ascending: false });
            this.state.allPeriods = data || [];
            this.state.activePeriod = data?.find(p => p.is_active) || data?.[0];
        } catch (e) { console.error("Metadata fetch failed", e); }
    },

    async fetchStudents(searchTerm = '') {
        let query = supabase.from('students').select('*, payments(*)');
        if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
        const { data, error } = await query.limit(20);
        if (error) return;
        this.state.students = data || [];
        this.renderStudentRows();
        this.updateCollectionTotal();
    },

    updateCollectionTotal() {
        const total = this.state.students.reduce((acc, s) => {
            return acc + (s.payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0);
        }, 0);
        const el = document.getElementById('total-val');
        if (el) el.innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    },

    renderStudentRows() {
        const body = document.getElementById('finance-list-body');
        if (!body) return;
        body.innerHTML = this.state.students.map(s => {
            const balance = s.payments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
            return `
                <tr class="group hover:bg-blue-50/30 transition-all">
                    <td class="px-8 py-5">
                        <div class="font-black text-slate-800 text-sm">${s.full_name}</div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${s.student_id}</div>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <span class="text-sm font-black text-rose-500 italic">₱ ${balance.toLocaleString()}</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <button onclick="financeModule.viewStudentFinance('${s.student_id}')" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 group-hover:text-white transition-all">
                            Manage
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    async viewStudentFinance(studentId) {
        const student = this.state.students.find(s => s.student_id === studentId);
        const modal = document.getElementById('finance-modal');
        const content = document.getElementById('finance-modal-content');
        
        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="flex h-full">
                <div class="w-1/3 bg-slate-50 p-10 border-r border-slate-100">
                    <div class="w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-xl shadow-blue-100 flex items-center justify-center text-white text-2xl font-black">
                        ${student.full_name.charAt(0)}
                    </div>
                    <h2 class="text-2xl font-black text-slate-900 leading-tight">${student.full_name}</h2>
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">${student.student_id}</p>
                    
                    <div class="mt-10 space-y-4">
                        <button onclick="financeModule.showAddPaymentForm('${student.id}')" class="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg">New Payment</button>
                        <div class="p-4 bg-white rounded-2xl border border-slate-100">
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Status</p>
                            <p class="text-xs font-bold text-slate-700 mt-1">${student.email || 'NO EMAIL PROVIDED'}</p>
                        </div>
                    </div>
                </div>
                <div class="flex-1 p-10 flex flex-col">
                    <div class="flex justify-between items-center mb-10">
                        <h3 class="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Payment History</h3>
                        <button onclick="document.getElementById('finance-modal').classList.add('hidden')" class="p-2 hover:bg-slate-100 rounded-full transition-all">
                            <i data-lucide="x" class="w-6 h-6 text-slate-400"></i>
                        </button>
                    </div>
                    <div id="payment-history-list" class="flex-1 overflow-y-auto space-y-4">
                        ${student.payments?.length ? student.payments.map(p => `
                            <div class="p-6 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center shadow-sm">
                                <div>
                                    <p class="text-xs font-black text-slate-800">₱ ${p.amount_paid.toLocaleString()}</p>
                                    <p class="text-[9px] font-bold text-slate-400 mt-1">${p.receipt_number} | ${new Date(p.created_at).toLocaleDateString()}</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="financeModule.reprintReceipt('${p.id}')" class="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><i data-lucide="printer" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        `).join('') : '<div class="text-center py-20 text-slate-300 italic font-bold">No payments found for this semester.</div>'}
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    },

    // --- NEW PAYMENT LOGIC ---
    showAddPaymentForm(studentUUID) {
        const student = this.state.students.find(s => s.id === studentUUID);
        const historyList = document.getElementById('payment-history-list');
        
        historyList.innerHTML = `
            <div class="bg-slate-50 p-8 rounded-[2rem] animate-in slide-in-from-right-4 duration-300">
                <h4 class="text-lg font-black text-slate-900 mb-6">Record New Payment</h4>
                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase">Amount to Pay</label>
                        <input type="number" id="new-pay-amount" value="${this.state.activePeriod?.target_amount || 0}" class="w-full mt-1 p-4 rounded-xl border-none ring-1 ring-slate-200 text-xl font-black">
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-slate-400 uppercase">Remarks</label>
                        <input type="text" id="new-pay-remarks" placeholder="Optional notes..." class="w-full mt-1 p-4 rounded-xl border-none ring-1 ring-slate-200">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button onclick="financeModule.submitPayment('${studentUUID}')" class="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Confirm Payment</button>
                        <button onclick="financeModule.viewStudentFinance('${student.student_id}')" class="px-6 py-4 bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px]">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    },

    async submitPayment(studentUUID) {
        const amount = document.getElementById('new-pay-amount').value;
        const remarks = document.getElementById('new-pay-remarks').value;
        const receiptNo = `OR-${Date.now().toString().slice(-8)}`;

        const { data, error } = await supabase.from('payments').insert([{
            student_id: studentUUID,
            amount_paid: parseFloat(amount),
            receipt_number: receiptNo,
            academic_period_id: this.state.activePeriod.id,
            remarks: remarks
        }]).select().single();

        if (error) return alert(error.message);
        
        alert("Payment Recorded Successfully");
        await this.fetchStudents(); // Refresh background
        this.generateQRReceipt(data); // Trigger Print
        document.getElementById('finance-modal').classList.add('hidden');
    },

    generateQRReceipt(payment) {
        const student = this.state.students.find(s => s.id === payment.student_id);
        const printArea = document.getElementById('print-area');
        
        printArea.innerHTML = `
            <div class="receipt-print-wrapper p-10 bg-white border-2 border-dashed border-slate-300 w-[80mm] text-center">
                <h2 class="text-lg font-black uppercase">Official Receipt</h2>
                <p class="text-[10px] font-bold text-slate-400 mb-4">${this.state.activePeriod.year_range} | ${this.state.activePeriod.semester} Sem</p>
                <div class="border-y border-slate-100 py-4 mb-4">
                    <p class="text-sm font-black">${student.full_name}</p>
                    <p class="text-[9px] text-slate-400">${student.student_id}</p>
                </div>
                <p class="text-2xl font-black italic">₱${payment.amount_paid.toLocaleString()}</p>
                <div id="receipt-qr-code" class="flex justify-center my-6"></div>
                <p class="text-[8px] font-mono uppercase">${payment.receipt_number}</p>
            </div>
        `;

        // Ensure QRCode library is loaded in index.html
        new QRCode(document.getElementById("receipt-qr-code"), {
            text: `VERIFY:${payment.receipt_number}:${student.student_id}:${payment.amount_paid}`,
            width: 128,
            height: 128
        });

        setTimeout(() => { window.print(); }, 500);
    },

    // --- ROLL-OVER LOGIC ---
    async handleRollover() {
        if(!confirm("DANGER: This will deactivate the current semester and set up a new collection period. Continue?")) return;

        const newYear = prompt("Enter Academic Year (e.g., 2026-2027):");
        const newSem = prompt("Enter Semester (1st, 2nd, Summer):");
        const newFee = prompt("Set Semestral Fee Amount (e.g., 500):");

        if(!newYear || !newSem || !newFee) return alert("All fields are required for Roll-over.");

        // 1. Deactivate current
        await supabase.from('academic_periods').update({ is_active: false }).eq('is_active', true);

        // 2. Create New
        const { error } = await supabase.from('academic_periods').insert([{
            year_range: newYear,
            semester: newSem,
            target_amount: parseFloat(newFee),
            is_active: true
        }]);

        if (error) alert(error.message);
        else {
            alert("New Semester Initialized.");
            location.reload();
        }
    }
};

window.financeModule = financeModule;
