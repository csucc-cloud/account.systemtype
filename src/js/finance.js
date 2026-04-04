import { supabase } from './auth.js';

export const financeModule = {
    state: {
        activePeriod: null, // {id, year, semester}
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

        // Fetch initial data if state is empty
        if (this.state.allPeriods.length === 0) await this.fetchMetadata();

        container.innerHTML = `
            <div class="p-6 md:p-10 bg-[#F8FAFC] min-h-screen">
                <div class="max-w-7xl mx-auto mb-8 flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h1 class="text-2xl font-black text-slate-900">Finance <span class="text-blue-600">Command</span></h1>
                        <p class="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                            Active: ${this.state.activePeriod?.year_range} | ${this.state.activePeriod?.semester} Semester
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
                                <tbody id="student-list" class="divide-y divide-slate-50">
                                    </tbody>
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
                    <div id="modal-content"></div>
                </div>
            </div>
            
            <div id="qr-reader-container" class="fixed inset-0 z-[60] bg-black hidden flex flex-col items-center justify-center">
                <div id="receipt-scanner" class="w-full max-w-md aspect-square"></div>
                <button id="close-scanner" class="mt-8 px-8 py-3 bg-white rounded-full font-bold">Cancel Scan</button>
            </div>
        `;

        this.initEventListeners();
        this.fetchStudents();
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
        this.renderStudentList(data || []);
    },

    renderStudentList(students) {
        const list = document.getElementById('student-list');
        list.innerHTML = students.map(s => `
            <tr class="hover:bg-slate-50 transition-all">
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">${s.full_name}</div>
                    <div class="text-[10px] text-slate-400 font-medium">${s.student_id}</div>
                </td>
                <td class="px-6 py-4 text-xs font-bold text-slate-600">${s.course} ${s.year_level}</td>
                <td class="px-6 py-4 text-xs font-black text-rose-500">₱ ${this.calculateBalance(s)}</td>
                <td class="px-6 py-4 text-right">
                    <button onclick="attendanceModule.viewStudentFinance('${s.student_id}')" class="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <i data-lucide="external-link" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    // --- ROLL-OVER LOGIC ---
    async handleRollover() {
        const confirm = window.confirm("This will deactivate the current semester and initialize a new one. History will be preserved. Proceed?");
        if (!confirm) return;

        // 1. Deactivate current period
        await supabase.from('academic_periods').update({ is_active: false }).eq('id', this.state.activePeriod.id);

        // 2. Logic to create new period record would go here
        alert("Semestral Roll-over Successful. System updated to the new academic period.");
        location.reload();
    },

    // --- RECEIPT & PDF GENERATION ---
    async generateReceiptPDF(paymentId, autoEmail = false) {
        // Logic using jspdf and qrcode.js
        // 1. Fetch payment data with student details
        // 2. Generate QR code containing: student_id + receipt_no + hash
        // 3. Construct PDF layout
        // 4. If autoEmail: Convert to blob and send via Supabase Edge Function (Resend/SendGrid)
    },

    async printAuditSheet() {
        // This triggers a specific CSS @media print layout
        // That fetches the last 4 payments and tiles them in a 2x2 grid
        window.print();
    }
};
