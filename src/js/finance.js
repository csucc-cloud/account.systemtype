import { supabase } from './auth.js';

export const financeModule = {
    state: {
        activePeriod: null, 
        allPeriods: [],
        students: [],
        selectedStudent: null,
        paymentHistory: [],
        isScannerActive: false,
        html5QrCode: null
    },

    async render() {
        const container = document.getElementById('mod-finance');
        if (!container) return;

        if (this.state.allPeriods.length === 0) await this.fetchMetadata();

        container.innerHTML = `
            <style>
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 210mm; }
                    .audit-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10mm; padding: 10mm; }
                    .receipt-card { border: 1px dashed #000; padding: 15px; height: 130mm; }
                }
            </style>

            <div class="p-6 md:p-10 bg-[#F8FAFC] min-h-screen">
                <div class="max-w-7xl mx-auto mb-8 flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h1 class="text-2xl font-black text-slate-900">Finance <span class="text-blue-600">Command</span></h1>
                        <p class="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                            Active: ${this.state.activePeriod?.year_range || 'N/A'} | ${this.state.activePeriod?.semester || 'N/A'} Semester
                        </p>
                    </div>
                    <div class="flex gap-3">
                        <button id="btn-rollover" class="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-blue-600 transition-all">
                            Initiate Semestral Roll-over
                        </button>
                        <button id="btn-scan-receipt" class="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-lg">
                            Verify Receipt QR
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div class="lg:col-span-8 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div class="p-6 border-b border-slate-50 flex justify-between items-center">
                            <input type="text" id="search-student" placeholder="Search Name or ID..." class="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm w-64 focus:ring-2 focus:ring-blue-500">
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Ledger</div>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead class="bg-slate-50/50">
                                    <tr>
                                        <th class="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Student</th>
                                        <th class="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Course</th>
                                        <th class="px-6 py-4 text-[10px] font-bold uppercase text-slate-400">Balance</th>
                                        <th class="px-6 py-4 text-right text-[10px] font-bold uppercase text-slate-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="student-list" class="divide-y divide-slate-50"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="lg:col-span-4 space-y-6">
                        <div class="bg-gradient-to-br from-blue-700 to-indigo-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                            <p class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Total Collections</p>
                            <h2 id="total-collected" class="text-4xl font-black mt-2">₱ 0.00</h2>
                            <button id="btn-print-audit" class="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                                Generate A4 Audit (4-per-sheet)
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="finance-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                    <div id="modal-content" class="p-8 overflow-y-auto"></div>
                </div>
            </div>

            <div id="qr-reader-container" class="fixed inset-0 z-[60] bg-black hidden flex flex-col items-center justify-center">
                <div id="receipt-scanner" class="w-full max-w-md aspect-square"></div>
                <button id="close-scanner" class="mt-8 px-8 py-3 bg-white rounded-full font-bold">Cancel Scan</button>
            </div>

            <div id="print-area" class="hidden"></div>
        `;

        this.initEventListeners();
        this.fetchStudents();
    },

    initEventListeners() {
        document.getElementById('search-student')?.addEventListener('input', (e) => this.fetchStudents(e.target.value));
        document.getElementById('btn-rollover')?.addEventListener('click', () => this.handleRollover());
        document.getElementById('btn-print-audit')?.addEventListener('click', () => this.printAuditSheet());
        document.getElementById('btn-scan-receipt')?.addEventListener('click', () => this.toggleScanner());
        document.getElementById('close-scanner')?.addEventListener('click', () => this.toggleScanner());
    },

    async fetchMetadata() {
        const { data: periods } = await supabase.from('academic_periods').select('*').order('created_at', { ascending: false });
        this.state.allPeriods = periods || [];
        this.state.activePeriod = periods.find(p => p.is_active) || periods[0];
    },

    async fetchStudents(searchTerm = '') {
        let query = supabase.from('students').select('*, payments(*)');
        if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
        const { data } = await query.limit(20);
        this.state.students = data || [];
        this.renderStudentList(this.state.students);
    },

    calculateBalance(student) {
        if (!student.payments) return "0.00";
        const total = student.payments.reduce((acc, curr) => acc + (curr.amount_paid || 0), 0);
        return total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    },

    renderStudentList(students) {
        const list = document.getElementById('student-list');
        if (!list) return;
        list.innerHTML = students.map(s => `
            <tr class="hover:bg-slate-50 transition-all">
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">${s.full_name}</div>
                    <div class="text-[10px] text-slate-400 font-medium">${s.student_id}</div>
                </td>
                <td class="px-6 py-4 text-xs font-bold text-slate-600">${s.course} ${s.year_level}</td>
                <td class="px-6 py-4 text-xs font-black text-rose-500">₱ ${this.calculateBalance(s)}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="financeModule.viewStudentFinance('${s.student_id}')" class="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <i data-lucide="external-link" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    async viewStudentFinance(studentId) {
        const student = this.state.students.find(s => s.student_id === studentId);
        this.state.selectedStudent = student;
        const modal = document.getElementById('finance-modal');
        const content = document.getElementById('modal-content');
        
        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="flex flex-col md:flex-row gap-8">
                <div class="w-full md:w-1/3 space-y-6">
                    <h3 class="text-xl font-black">Student Information</h3>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                        <input type="text" id="edit-name" value="${student.full_name}" class="w-full p-3 bg-slate-50 rounded-xl border-none text-sm">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                        <input type="email" id="edit-email" value="${student.email || ''}" placeholder="Manual input if empty" class="w-full p-3 bg-slate-50 rounded-xl border-none text-sm">
                    </div>
                    <button onclick="financeModule.updateStudent()" class="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase">Update Records</button>
                </div>
                <div class="flex-1">
                    <h3 class="text-xl font-black mb-4">Payment History</h3>
                    <div class="space-y-3">
                        ${student.payments?.length ? student.payments.map(p => `
                            <div class="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                                <div>
                                    <div class="font-bold text-sm">₱ ${p.amount_paid}</div>
                                    <div class="text-[10px] text-slate-400">${p.receipt_number} | ${new Date(p.created_at).toLocaleDateString()}</div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="financeModule.printSingleReceipt('${p.id}')" class="p-2 bg-white rounded-lg shadow-sm text-blue-600"><i data-lucide="printer" class="w-4 h-4"></i></button>
                                    <button onclick="financeModule.generateReceiptPDF('${p.id}', true)" class="p-2 bg-white rounded-lg shadow-sm text-emerald-600"><i data-lucide="mail" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        `).join('') : '<p class="text-slate-400 italic">No payments recorded.</p>'}
                    </div>
                </div>
            </div>
            <button onclick="document.getElementById('finance-modal').classList.add('hidden')" class="mt-8 text-slate-400 font-bold text-xs uppercase underline">Close Modal</button>
        `;
        if (window.lucide) window.lucide.createIcons();
    },

    async handleRollover() {
        const confirm = window.confirm("Roll-over to next semester? This archives current payments.");
        if (!confirm) return;
        await supabase.from('academic_periods').update({ is_active: false }).eq('id', this.state.activePeriod.id);
        alert("Roll-over complete.");
        location.reload();
    },

    async printAuditSheet() {
        const printArea = document.getElementById('print-area');
        const recentPayments = this.state.students.flatMap(s => s.payments).slice(0, 4);
        
        printArea.innerHTML = `<div class="audit-grid">
            ${recentPayments.map(p => `
                <div class="receipt-card">
                    <h2 class="font-black">OFFICIAL RECEIPT</h2>
                    <p>Receipt #: ${p.receipt_number}</p>
                    <p>Amount: ₱${p.amount_paid}</p>
                    <div id="qr-${p.id}" class="mt-4"></div>
                </div>
            `).join('')}
        </div>`;
        window.print();
    }
};
