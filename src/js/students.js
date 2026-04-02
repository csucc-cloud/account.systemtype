import { supabase, currentUserRole, currentUserOrg } from './auth.js';

export const studentModule = {
    allStudentsData: [],
    selectedStudents: new Set(), // Feature: Batch Actions Storage

    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        const isStaff = currentUserRole === 'staff';
        const isSuperAdmin = currentUserRole === 'super_admin';

        container.innerHTML = `
            <div class="space-y-6 p-4 animate-in fade-in duration-500">
                
                <div id="student-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 transition-transform hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</p>
                        <h2 id="stat-total" class="text-3xl font-black text-[#000080] mt-1">0</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 transition-transform hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Education Dept</p>
                        <h2 id="stat-edu" class="text-3xl font-black text-slate-700 mt-1">0</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 transition-transform hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-orange-500 uppercase tracking-widest">Ind. Tech Dept</p>
                        <h2 id="stat-tech" class="text-3xl font-black text-slate-700 mt-1">0</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 transition-transform hover:scale-[1.02]">
                        <p class="text-[10px] font-black text-purple-500 uppercase tracking-widest">New Today</p>
                        <h2 id="stat-new" class="text-3xl font-black text-slate-700 mt-1">0</h2>
                    </div>
                </div>

                <div class="flex flex-col gap-4 bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="relative w-full md:w-96">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input type="text" id="student-search" placeholder="Search by name or ID..." 
                                   class="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#000080]/10 transition-all">
                        </div>
                        
                        <div class="flex flex-wrap gap-2 w-full md:w-auto ${isStaff ? 'hidden' : ''}">
                            <button id="btn-batch-delete" class="hidden items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all scale-in">
                                Delete Selected (<span id="selected-count">0</span>)
                            </button>

                            <button id="btn-export" class="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export
                            </button>

                            <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
                            
                            <button id="btn-import" class="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Import
                            </button>

                            <button id="btn-open-modal" class="flex items-center justify-center gap-2 bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-[#000080]/20">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                Add Student
                            </button>
                        </div>
                    </div>

                    <div id="dept-filters" class="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                        <button class="filter-pill active" data-dept="all">All Records</button>
                        <button class="filter-pill" data-dept="Education Dept.">Education</button>
                        <button class="filter-pill" data-dept="Industrial Technology Dept.">Industrial Tech</button>
                        <button class="filter-pill" data-dept="Vocational Tech Dept.">Vocational Tech</button>
                    </div>
                </div>

                <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50/50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th class="p-5 w-10">
                                        <input type="checkbox" id="select-all" class="rounded border-slate-300 text-[#000080] focus:ring-[#000080]">
                                    </th>
                                    <th class="p-5">ID Number</th>
                                    <th class="p-5">Student Name</th>
                                    ${isSuperAdmin ? '<th class="p-5 text-purple-600">Org Membership</th>' : '<th class="p-5">College</th>'}
                                    <th class="p-5">Course</th>
                                    <th class="p-5">Year</th>
                                    <th class="p-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body" class="divide-y divide-slate-50"></tbody>
                        </table>
                    </div>
                </div>

                ${this.renderModals()}
            </div>

            <style>
                .filter-pill { @apply px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight transition-all border border-slate-100 text-slate-400 bg-white hover:bg-slate-50; }
                .filter-pill.active { @apply bg-[#000080] text-white border-[#000080] shadow-md shadow-[#000080]/10; }
                
                /* Highlight effect */
                mark { padding: 0; background: #fef08a; color: black; border-radius: 2px; }
            </style>
        `;
        
        setTimeout(() => this.setupEventListeners(), 200);
    },

    renderModals() {
        return `
            <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in duration-300">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-2xl font-black text-[#000080]">New Student</h3>
                        <button id="btn-close-modal" class="text-slate-300 hover:text-red-500 transition-colors p-2 text-xl">✕</button>
                    </div>
                    <div class="space-y-4">
                        <input type="text" id="stud-id" placeholder="ID Number" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] transition-all">
                        <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] transition-all">
                        <input type="text" id="stud-college" placeholder="College" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] transition-all">
                        <input type="text" id="stud-course" placeholder="Course" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] transition-all">
                        <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] transition-all">
                            <option value="1">1st Year</option><option value="2">2nd Year</option>
                            <option value="3">3rd Year</option><option value="4">4th Year</option>
                        </select>
                        <button type="button" id="btn-save-manual" class="w-full py-5 bg-[#000080] text-white rounded-2xl font-black shadow-xl shadow-[#000080]/20 hover:scale-[1.02] active:scale-95 transition-all mt-4">Save Student Record</button>
                    </div>
                </div>
            </div>

            <div id="modal-profile" class="hidden fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
                <div id="profile-card" class="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                    <div class="h-24 bg-[#000080] flex justify-end p-4">
                         <button onclick="document.getElementById('modal-profile').classList.add('hidden')" class="text-white/50 hover:text-white">✕</button>
                    </div>
                    <div class="px-8 pb-8 -mt-12 text-center">
                        <div class="w-24 h-24 bg-white rounded-full mx-auto p-1 shadow-lg overflow-hidden">
                            <div class="w-full h-full bg-slate-100 rounded-full flex items-center justify-center text-[#000080] font-black text-2xl" id="prof-initials">--</div>
                        </div>
                        <h4 class="text-xl font-black text-slate-800 mt-4" id="prof-name">Student Name</h4>
                        <p class="text-sm font-bold text-slate-400 font-mono" id="prof-id">ID: ----</p>
                        
                        <div id="profile-qr-container" class="my-4 flex justify-center bg-slate-50 p-3 rounded-2xl border border-dashed border-slate-200">
                            </div>

                        <div class="grid grid-cols-2 gap-2 mt-6 text-left">
                            <div class="p-3 bg-slate-50 rounded-2xl"><p class="text-[9px] uppercase font-black text-slate-400">Course</p><p class="text-xs font-bold text-slate-700" id="prof-course">--</p></div>
                            <div class="p-3 bg-slate-50 rounded-2xl"><p class="text-[9px] uppercase font-black text-slate-400">Year</p><p class="text-xs font-bold text-slate-700" id="prof-year">--</p></div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="import-progress" class="hidden fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                <div class="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl">
                    <div class="inline-block animate-spin rounded-full h-14 w-14 border-4 border-[#000080] border-t-transparent mb-6"></div>
                    <h3 class="text-xl font-black text-slate-800 mb-2">Importing Data</h3>
                    <p id="progress-text" class="text-slate-400 font-mono text-lg font-bold">0 / 0</p>
                    <div class="w-full bg-slate-100 h-3 rounded-full mt-6 overflow-hidden">
                        <div id="progress-bar" class="bg-[#000080] h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
    },

    classifyDepartment(course) {
        if (!course) return 'Other Department';
        const c = String(course).toUpperCase();
        if (c.includes('BTLED')) return 'Education Dept.';
        if (c.includes('BSINDTECH')) return 'Industrial Technology Dept.';
        if (c.includes('BTVTED')) return 'Vocational Tech Dept.';
        return 'Other Department';
    },

    async init() {
        this.render();
        await this.fetchAndRenderList();
    },

    setupEventListeners() {
        const modal = document.getElementById('modal-student');
        const openBtn = document.getElementById('btn-open-modal');
        if (openBtn) openBtn.onclick = () => modal.classList.remove('hidden');
        const closeBtn = document.getElementById('btn-close-modal');
        if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
        
        const saveBtn = document.getElementById('btn-save-manual');
        if (saveBtn) saveBtn.onclick = () => this.handleManualSave();

        const fileInput = document.getElementById('bulk-upload');
        const importBtn = document.getElementById('btn-import');
        if (importBtn) importBtn.onclick = () => fileInput.click();
        if (fileInput) fileInput.onchange = (e) => this.handleExcelImport(e.target.files[0]);

        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) exportBtn.onclick = () => this.handleExportCSV();

        // FEATURE 1: FILTER LISTENERS
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                this.fetchAndRenderList(document.getElementById('student-search').value, btn.dataset.dept);
            };
        });

        // FEATURE 2: BATCH SELECTION LOGIC
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.onchange = (e) => {
                const checkboxes = document.querySelectorAll('.student-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    this.toggleStudentSelection(cb.dataset.id, e.target.checked);
                });
                this.updateBatchUI();
            };
        }

        const batchDelete = document.getElementById('btn-batch-delete');
        if (batchDelete) batchDelete.onclick = () => this.handleBatchDelete();

        const searchInput = document.getElementById('student-search');
        let searchTimer;
        if (searchInput) {
            searchInput.oninput = (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    const activeDept = document.querySelector('.filter-pill.active').dataset.dept;
                    this.fetchAndRenderList(e.target.value, activeDept);
                }, 400);
            };
        }

        window.studentModule = this;
    },

    updateDashboardStats(data) {
        document.getElementById('stat-total').innerText = data.length;
        document.getElementById('stat-edu').innerText = data.filter(s => s.department === 'Education Dept.').length;
        document.getElementById('stat-tech').innerText = data.filter(s => s.department === 'Industrial Technology Dept.').length;
        
        const today = new Date().toISOString().split('T')[0];
        const newToday = data.filter(s => s.created_at && s.created_at.startsWith(today)).length;
        document.getElementById('stat-new').innerText = newToday;
    },

    async fetchAndRenderList(searchTerm = "", deptFilter = "all") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });
            
            if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            if (deptFilter !== "all") query = query.eq('department', deptFilter);

            const { data, error } = await query.limit(500);
            if (error) throw error;

            this.allStudentsData = data;
            this.updateDashboardStats(data);

            tbody.innerHTML = data.map(s => {
                const orgTags = Array.isArray(s.organization_owner) 
                    ? s.organization_owner.join(' | ') 
                    : (s.organization_owner || 'None');

                // Feature: Search Highlighting
                let displayName = s.full_name;
                if(searchTerm) {
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    displayName = s.full_name.replace(regex, '<mark>$1</mark>');
                }

                return `
                <tr class="border-b border-slate-50 hover:bg-slate-50/80 transition-all group">
                    <td class="p-5 text-center">
                        <input type="checkbox" class="student-checkbox rounded border-slate-300 text-[#000080]" 
                               data-id="${s.student_id}" ${this.selectedStudents.has(s.student_id) ? 'checked' : ''} 
                               onchange="studentModule.toggleStudentSelection('${s.student_id}', this.checked)">
                    </td>
                    <td class="p-5 text-sm font-mono text-slate-400 font-medium">${s.student_id}</td>
                    <td class="p-5 font-bold text-sm text-slate-700">
                        <button onclick="studentModule.viewProfile('${s.student_id}')" class="hover:text-[#000080] transition-colors">
                            ${displayName}
                        </button>
                    </td>
                    ${currentUserRole === 'super_admin' ? 
                        `<td class="p-5 text-[10px] font-black text-purple-600 uppercase italic"><span class="bg-purple-50 px-2 py-1 rounded-lg border border-purple-100">${orgTags}</span></td>` :
                        `<td class="p-5 text-xs font-bold text-slate-500 uppercase">${s.college || 'N/A'}</td>`
                    }
                    <td class="p-5 text-sm text-slate-600">${s.course || ''}</td>
                    <td class="p-5">
                        <span class="px-3 py-1 bg-[#000080]/5 text-[#000080] rounded-full text-[10px] font-black tracking-tight">YR ${s.year_level}</span>
                    </td>
                    <td class="p-5 text-right">
                        ${currentUserRole === 'super_admin' ? `
                            <button class="text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-xl" 
                                    onclick="studentModule.deleteStudent('${s.student_id}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        ` : `
                            <svg class="ml-auto text-slate-200" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        `}
                    </td>
                </tr>
            `}).join('');
        } catch (err) {
            console.error("Fetch Error:", err);
        }
    },

    toggleStudentSelection(id, isSelected) {
        if (isSelected) this.selectedStudents.add(id);
        else this.selectedStudents.delete(id);
        this.updateBatchUI();
    },

    updateBatchUI() {
        const btn = document.getElementById('btn-batch-delete');
        const count = document.getElementById('selected-count');
        if (this.selectedStudents.size > 0) {
            btn.classList.remove('hidden');
            btn.classList.add('flex');
            count.innerText = this.selectedStudents.size;
        } else {
            btn.classList.add('hidden');
            btn.classList.remove('flex');
        }
    },

    async handleBatchDelete() {
        if (!confirm(`Delete ${this.selectedStudents.size} selected students?`)) return;
        const ids = Array.from(this.selectedStudents);
        const { error } = await supabase.from('students').delete().in('student_id', ids);
        if (error) alert(error.message);
        else {
            this.selectedStudents.clear();
            this.updateBatchUI();
            this.fetchAndRenderList();
        }
    },

    viewProfile(id) {
        const s = this.allStudentsData.find(x => x.student_id === id);
        if (!s) return;
        document.getElementById('prof-name').innerText = s.full_name;
        document.getElementById('prof-id').innerText = `ID: ${s.student_id}`;
        document.getElementById('prof-course').innerText = s.course || 'N/A';
        document.getElementById('prof-year').innerText = `${s.year_level}nd Year`;
        
        // Initials Logic
        const initials = s.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('prof-initials').innerText = initials.substring(0,2);
        
        // Feature: QR Code Generation
        const qrContainer = document.getElementById('profile-qr-container');
        qrContainer.innerHTML = ""; // Clear old QR
        if(window.QRCode) {
            new QRCode(qrContainer, {
                text: s.student_id,
                width: 120,
                height: 120,
                colorDark : "#000080",
                colorLight : "#f8fafc",
                correctLevel : QRCode.CorrectLevel.H
            });
        }

        document.getElementById('modal-profile').classList.remove('hidden');
    },

    async deleteStudent(id) {
        if (!confirm(`Are you sure you want to delete student ${id}?`)) return;
        const { error } = await supabase.from('students').delete().eq('student_id', id);
        if (error) alert("Delete Error: " + error.message);
        else this.fetchAndRenderList();
    },

    handleExportCSV() {
        if (this.allStudentsData.length === 0) return alert("No data to export");
        const headers = ["Student ID", "Full Name", "College", "Course", "Year Level", "Department"];
        const rows = this.allStudentsData.map(s => [s.student_id, s.full_name, s.college, s.course, s.year_level, s.department]);
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Student_List_${currentUserOrg}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    async handleManualSave() {
        const id = document.getElementById('stud-id').value.trim();
        const name = document.getElementById('stud-name').value.trim();
        const college = document.getElementById('stud-college').value.trim();
        const course = document.getElementById('stud-course').value.trim();
        const year = document.getElementById('stud-year').value;

        if (!id || !name) return alert("Please fill in at least ID and Name");

        const isDuplicate = this.allStudentsData.some(s => s.student_id === id);
        if (isDuplicate && !confirm("ID already exists. Update existing record?")) return;

        const { error } = await supabase.from('students').upsert({
            student_id: id,
            full_name: name,
            college: college,
            course: course,
            department: this.classifyDepartment(course),
            year_level: parseInt(year)
        }, { onConflict: 'student_id' });

        if (error) return alert("Database Error: " + error.message);

        await supabase.rpc('append_org_to_student', { s_id: id, new_org: currentUserOrg });
        document.getElementById('modal-student').classList.add('hidden');
        this.fetchAndRenderList();
    },

    async handleExcelImport(file) {
        if (!file || !window.XLSX) return alert("Excel library missing.");
        const progressModal = document.getElementById('import-progress');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                progressModal.classList.remove('hidden');

                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    const sId = String(row['ID Number'] || row['ID'] || '').trim();
                    if (!sId) continue;

                    progressText.innerText = `${i + 1} / ${json.length}`;
                    progressBar.style.width = `${((i + 1) / json.length) * 100}%`;

                    await supabase.from('students').upsert({
                        student_id: sId,
                        full_name: String(row['Student Name'] || row['Name'] || '').trim(),
                        college: row['College'] || '',
                        course: row['Course'] || '',
                        department: this.classifyDepartment(row['Course']),
                        year_level: parseInt(String(row['Year'] || '1').replace(/\D/g, '')) || 1
                    }, { onConflict: 'student_id' });

                    await supabase.rpc('append_org_to_student', { s_id: sId, new_org: currentUserOrg });
                    if (i % 20 === 0) await new Promise(r => setTimeout(r, 10));
                }
                alert("Import Finished!");
            } catch (err) {
                alert("Import Error: " + err.message);
            } finally {
                progressModal.classList.add('hidden');
                this.fetchAndRenderList();
            }
        };
        reader.readAsArrayBuffer(file);
    }
};
