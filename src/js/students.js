import { supabase } from './auth.js';

export const studentModule = {
    /**
     * 1. THE UI (HTML & MODAL)
     */
    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6 animate-in fade-in duration-500">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div class="relative w-full md:w-96">
                        <i data-lucide="search" class="absolute left-4 top-3 w-4 h-4 text-slate-400"></i>
                        <input type="text" id="student-search" placeholder="Search by name or ID..." 
                               class="w-full pl-12 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#000080]/10">
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
                        <button id="btn-import" class="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                            <i data-lucide="file-up" class="w-4 h-4"></i> Import Excel
                        </button>
                        <button id="btn-open-modal" class="flex-1 bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90">
                            <i data-lucide="plus" class="w-4 h-4"></i> Add Student
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400 tracking-widest text-nowrap">
                                    <th class="p-4">ID Number</th>
                                    <th class="p-4">Student Name</th>
                                    <th class="p-4">College</th>
                                    <th class="p-4">Course/Program</th>
                                    <th class="p-4">Year Level</th>
                                    <th class="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body" class="divide-y divide-slate-50"></tbody>
                        </table>
                    </div>
                </div>

                <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-black text-[#000080]">New Student</h3>
                            <button id="btn-close-modal" class="text-slate-400"><i data-lucide="x"></i></button>
                        </div>
                        <form id="form-student" class="space-y-4">
                            <input type="text" id="stud-id" placeholder="ID Number (e.g. 2026-0001)" required class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm outline-none font-mono">
                            <input type="text" id="stud-name" placeholder="Full Name (Last, First)" required class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm outline-none">
                            <input type="text" id="stud-college" placeholder="College (e.g. CAS)" required class="w-full p-4 bg-slate-50 rounded-xl border-none text-sm outline-none">
                            <div class="grid grid-cols-2 gap-4">
                                <input type="text" id="stud-course" placeholder="Course/Program" required class="p-4 bg-slate-50 rounded-xl border-none text-sm outline-none">
                                <select id="stud-year" required class="p-4 bg-slate-50 rounded-xl border-none text-sm outline-none">
                                    <option value="">Year Level</option>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                    <option value="5">5th Year</option>
                                </select>
                            </div>
                            <button type="submit" class="w-full py-4 bg-[#000080] text-white rounded-2xl font-black shadow-lg">Save Student</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        this.setupEventListeners();
        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * 2. CLASSIFICATION LOGIC
     */
    classifyDepartment(course) {
        if (!course) return 'Other Department';
        const c = course.toUpperCase();

        if (c.includes('BTLED') || c.includes('BTVTED')) {
            return 'Education Dept.';
        } 
        if (c.includes('BSINDTECH') || c.includes('BSINDUSTECH')) {
            return 'Industrial Technology Dept.';
        }
        
        return 'Other Department';
    },

    /**
     * 3. INITIALIZE & LISTENERS
     */
    async init() {
        this.render();
        await this.fetchAndRenderList();
    },

    setupEventListeners() {
        document.getElementById('btn-open-modal')?.addEventListener('click', () => document.getElementById('modal-student').classList.remove('hidden'));
        document.getElementById('btn-close-modal')?.addEventListener('click', () => document.getElementById('modal-student').classList.add('hidden'));
        document.getElementById('form-student')?.addEventListener('submit', (e) => this.handleManualSave(e));
        document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('bulk-upload').click());
        document.getElementById('bulk-upload')?.addEventListener('change', (e) => this.handleExcelImport(e.target.files[0]));

        let searchTimer;
        document.getElementById('student-search')?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.fetchAndRenderList(e.target.value), 300);
        });
    },

    /**
     * 4. DATA OPERATIONS (FETCH WITH RBAC)
     */
    async fetchAndRenderList(searchTerm = "") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        tbody.innerHTML = `
        <tr>
            <td colspan="6" class="p-12 text-center">
                <div class="flex flex-col items-center gap-3 animate-pulse">
                    <div class="w-12 h-12 bg-slate-100 rounded-full"></div>
                    <div class="h-4 w-48 bg-slate-100 rounded-lg"></div>
                </div>
            </td>
        </tr>
    `;

        const { data: { user } } = await supabase.auth.getUser();
        const userOrg = user?.user_metadata?.org_name || "";
        const userRole = user?.user_metadata?.role || "user";

        let query = supabase.from('students').select('*').order('full_name', { ascending: true });

        // ROLE BASED ACCESS CONTROL
        if (userRole !== 'super_admin' && userOrg === 'HERO Organization') {
            query = query.eq('department', 'Education Dept.');
        }

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query.limit(100);
        if (error) return window.showAlert(error.message);

        tbody.innerHTML = data.map(s => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="p-4 text-slate-500 text-sm font-mono">${s.student_id}</td>
                <td class="p-4 font-bold text-slate-700 text-sm">${s.full_name}</td>
                <td class="p-4 text-slate-600 text-xs font-semibold uppercase">${s.college || 'N/A'}</td>
                <td class="p-4 text-slate-600 text-sm">${s.course || 'N/A'}</td>
                <td class="p-4"><span class="px-3 py-1 bg-blue-50 text-[#000080] rounded-full text-[10px] font-black uppercase">YEAR ${s.year_level}</span></td>
                <td class="p-4 text-right"><i data-lucide="more-horizontal" class="w-4 h-4 text-slate-300 inline-block cursor-pointer"></i></td>
            </tr>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    },

    /**
     * 5. SAVE & IMPORT LOGIC
     */
    async handleManualSave(e) {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        const orgId = user?.user_metadata?.org_id;

        const courseVal = document.getElementById('stud-course').value;
        const studentData = {
            student_id: document.getElementById('stud-id').value,
            full_name: document.getElementById('stud-name').value,
            college: document.getElementById('stud-college').value,
            course: courseVal,
            department: this.classifyDepartment(courseVal),
            year_level: document.getElementById('stud-year').value,
            organization_id: orgId
        };

        const { error } = await supabase.from('students').upsert(studentData, { onConflict: 'student_id' });

        if (error) {
            window.showAlert(error.message);
        } else {
            window.showAlert("Student Saved!", "success");
            document.getElementById('modal-student').classList.add('hidden');
            this.fetchAndRenderList();
        }
    },

    async handleExcelImport(file) {
        if (!file) return;
        window.showAlert("Classifying & Importing...", "info");
        
        const { data: { user } } = await supabase.auth.getUser();
        const orgId = user?.user_metadata?.org_id;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = window.XLSX.utils.sheet_to_json(sheet);

                const batch = json.map(row => {
                    const course = row.Course || row.Program || row['Course/Program'] || '';
                    return {
                        student_id: String(row.ID || row.StudentId || row['ID Number'] || ''),
                        full_name: row.Name || row.FullName || row['Student Name'] || '',
                        college: row.College || row['College/School'] || '',
                        course: course,
                        department: this.classifyDepartment(course),
                        year_level: String(row['Year Level'] || row.YearLevel || row.Year || '1'),
                        organization_id: orgId
                    };
                });

                const { error } = await supabase.from('students').upsert(batch, { onConflict: 'student_id' });
                if (error) throw error;

                window.showAlert(`Imported ${batch.length} students!`, "success");
                this.fetchAndRenderList();
            } catch (err) {
                window.showAlert("Import Error: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
};
