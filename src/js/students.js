import { supabase, currentUserRole, currentUserOrg } from './auth.js';
// Assuming your audit-logger exports a logAction function
import { logAction } from './audit-logger.js'; 

export const studentModule = {
    allStudentsData: [],
    selectedStudents: new Set(),
    currentPage: 1,
    itemsPerPage: 10,
    totalCount: 0,

    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        const isStaff = currentUserRole === 'staff';
        const isSuperAdmin = currentUserRole === 'super_admin';

        container.innerHTML = `
            <div class="space-y-6 p-4 animate-in fade-in duration-500">
                
                <div id="student-stats" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Students</p>
                        <h2 id="stat-total" class="text-3xl font-black text-[#000080] mt-1">...</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <p class="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Education Dept</p>
                        <h2 id="stat-edu" class="text-3xl font-black text-slate-700 mt-1">...</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <p class="text-[10px] font-black text-orange-500 uppercase tracking-widest">Ind. Tech Dept</p>
                        <h2 id="stat-tech" class="text-3xl font-black text-slate-700 mt-1">...</h2>
                    </div>
                    <div class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                        <p class="text-[10px] font-black text-purple-500 uppercase tracking-widest">New Today</p>
                        <h2 id="stat-new" class="text-3xl font-black text-slate-700 mt-1">...</h2>
                    </div>
                </div>

                <div class="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex flex-1 gap-3 w-full md:w-auto">
                            <div class="relative flex-1 md:max-w-md">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                </span>
                                <input type="text" id="student-search" placeholder="Search name or ID..." 
                                       class="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#000080]/10 transition-all">
                            </div>

                            <div class="relative min-w-[200px]">
                                <select id="dept-filter-dropdown" class="w-full appearance-none bg-slate-50 border-none rounded-2xl py-3 pl-4 pr-10 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-[#000080]/10 cursor-pointer transition-all">
                                    <option value="all">All Records</option>
                                    <option value="Education Dept.">Education Dept.</option>
                                    <option value="Industrial Technology Dept.">Indus Tech Dept.</option>
                                    <option value="Other Department">Other Dept.</option>
                                </select>
                                <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap gap-2 w-full md:w-auto ${isStaff ? 'hidden' : ''}">
                            <button id="btn-batch-delete" class="hidden items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all">
                                Delete Selected (<span id="selected-count">0</span>)
                            </button>
                            <button id="btn-export" class="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">Export</button>
                            <button id="btn-import" class="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Import</button>
                            <button id="btn-open-modal" class="bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#000080]/20">+ Add Student</button>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50/50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <th class="p-5 w-10"><input type="checkbox" id="select-all" class="rounded border-slate-300"></th>
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

                    <div class="p-5 bg-slate-50/30 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p class="text-xs font-bold text-slate-400">
                            Showing <span id="range-start">0</span> to <span id="range-end">0</span> of <span id="range-total">0</span> entries
                        </p>
                        <div class="flex items-center gap-2">
                            <button id="prev-page" class="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <div id="page-numbers" class="flex gap-1"></div>
                            <button id="next-page" class="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                ${this.renderModals()}
                <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
            </div>

            <style>
                mark { padding: 0; background: #fef08a; color: black; border-radius: 2px; }
                .page-btn { @apply px-3 py-1.5 rounded-lg text-xs font-black border transition-all; }
                .page-btn.active { @apply bg-[#000080] text-white border-[#000080] shadow-md; }
                .page-btn.inactive { @apply bg-white text-slate-400 border-slate-200 hover:bg-slate-50; }
            </style>
        `;
        
        setTimeout(() => this.setupEventListeners(), 200);
    },

    renderModals() {
        return `
            <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8">
                    <h3 class="text-2xl font-black text-[#000080] mb-6">New Student</h3>
                    <div class="space-y-4">
                        <input type="text" id="stud-id" placeholder="ID Number" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
                        <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
                        <input type="text" id="stud-college" placeholder="College" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
                        <input type="text" id="stud-course" placeholder="Course" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
                        <select id="stud-dept" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                            <option value="Education Dept.">Education Dept.</option>
                            <option value="Industrial Technology Dept.">Industrial Technology Dept.</option>
                            <option value="Other Department">Other Department</option>
                        </select>
                        <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
                            <option value="1">1st Year</option><option value="2">2nd Year</option>
                            <option value="3">3rd Year</option><option value="4">4th Year</option>
                        </select>
                        <button id="btn-save-manual" class="w-full py-5 bg-[#000080] text-white rounded-2xl font-black">Save Student</button>
                        <button onclick="document.getElementById('modal-student').classList.add('hidden')" class="w-full py-2 text-slate-400 font-bold">Cancel</button>
                    </div>
                </div>
            </div>

            <div id="modal-profile" class="hidden fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div class="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center">
                    <div id="prof-initials" class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-[#000080] font-black mx-auto mb-4">--</div>
                    <h4 id="prof-name" class="text-xl font-black text-slate-800"></h4>
                    <p id="prof-id" class="text-sm font-bold text-slate-400"></p>
                    <div id="profile-qr-container" class="my-6 flex justify-center"></div>
                    <button onclick="document.getElementById('modal-profile').classList.add('hidden')" class="w-full py-3 bg-slate-100 rounded-2xl font-bold">Close</button>
                </div>
            </div>

            <div id="import-progress" class="hidden fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80">
                <div class="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-[#000080] border-t-transparent mx-auto mb-4"></div>
                    <p id="progress-text" class="font-black text-slate-800">Processing...</p>
                </div>
            </div>
        `;
    },

    async init() {
        this.render();
        await this.updateDashboardStats(); // Initial stats load
        await this.fetchAndRenderList();
    },

    async updateDashboardStats() {
        try {
            // Run counts in parallel for performance
            const [total, edu, tech, newToday] = await Promise.all([
                supabase.from('students').select('*', { count: 'exact', head: true }),
                supabase.from('students').select('*', { count: 'exact', head: true }).eq('department', 'Education Dept.'),
                supabase.from('students').select('*', { count: 'exact', head: true }).eq('department', 'Industrial Technology Dept.'),
                supabase.from('students').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0])
            ]);

            document.getElementById('stat-total').innerText = total.count || 0;
            document.getElementById('stat-edu').innerText = edu.count || 0;
            document.getElementById('stat-tech').innerText = tech.count || 0;
            document.getElementById('stat-new').innerText = newToday.count || 0;
        } catch (err) {
            console.error("Stats Error:", err);
        }
    },

    setupEventListeners() {
        document.getElementById('prev-page').onclick = () => { if(this.currentPage > 1) { this.currentPage--; this.fetchAndRenderList(); } };
        document.getElementById('next-page').onclick = () => { if(this.currentPage < Math.ceil(this.totalCount/this.itemsPerPage)) { this.currentPage++; this.fetchAndRenderList(); } };

        const deptDropdown = document.getElementById('dept-filter-dropdown');
        if(deptDropdown) {
            deptDropdown.onchange = () => {
                this.currentPage = 1;
                this.fetchAndRenderList(document.getElementById('student-search').value, deptDropdown.value);
            };
        }

        const searchInput = document.getElementById('student-search');
        let timer;
        if(searchInput) {
            searchInput.oninput = (e) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.currentPage = 1;
                    this.fetchAndRenderList(e.target.value, deptDropdown.value);
                }, 400);
            };
        }

        document.getElementById('btn-open-modal').onclick = () => document.getElementById('modal-student').classList.remove('hidden');
        document.getElementById('btn-save-manual').onclick = () => this.handleManualSave();
        document.getElementById('btn-import').onclick = () => document.getElementById('bulk-upload').click();
        document.getElementById('bulk-upload').onchange = (e) => this.handleExcelImport(e.target.files[0]);
        document.getElementById('btn-export').onclick = () => this.handleExportCSV();
        
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.onchange = (e) => {
                document.querySelectorAll('.student-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                    this.toggleStudentSelection(cb.dataset.id, e.target.checked);
                });
                this.updateBatchUI();
            };
        }
        document.getElementById('btn-batch-delete').onclick = () => this.handleBatchDelete();

        window.studentModule = this;
    },

    async fetchAndRenderList(searchTerm = "", deptFilter = "all") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;

            let query = supabase.from('students').select('*', { count: 'exact' });
            if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            if (deptFilter !== "all") query = query.eq('department', deptFilter);

            const { data, count, error } = await query
                .order('full_name', { ascending: true })
                .range(from, to);

            if (error) throw error;

            this.allStudentsData = data;
            this.totalCount = count || 0;
            this.updatePaginationUI();

            tbody.innerHTML = data.map(s => {
                const orgTags = Array.isArray(s.organization_owner) ? s.organization_owner.join(' | ') : (s.organization_owner || 'None');
                let displayName = s.full_name;
                if(searchTerm) displayName = s.full_name.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark>$1</mark>');

                return `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-all">
                    <td class="p-5 text-center">
                        <input type="checkbox" class="student-checkbox rounded border-slate-300" 
                               data-id="${s.student_id}" ${this.selectedStudents.has(s.student_id) ? 'checked' : ''} 
                               onchange="studentModule.toggleStudentSelection('${s.student_id}', this.checked)">
                    </td>
                    <td class="p-5 text-sm font-mono text-slate-400">${s.student_id}</td>
                    <td class="p-5 font-bold text-sm text-slate-700">
                        <button onclick="studentModule.viewProfile('${s.student_id}')" class="hover:underline">${displayName}</button>
                    </td>
                    ${currentUserRole === 'super_admin' ? 
                        `<td class="p-5 text-[10px] font-black text-purple-600 uppercase italic">${orgTags}</td>` :
                        `<td class="p-5 text-xs font-bold text-slate-500 uppercase">${s.college || 'N/A'}</td>`
                    }
                    <td class="p-5 text-sm text-slate-600">${s.course || ''}</td>
                    <td class="p-5"><span class="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black">YR ${s.year_level}</span></td>
                    <td class="p-5 text-right">
                        ${currentUserRole === 'super_admin' ? `
                            <button class="text-slate-300 hover:text-red-500" onclick="studentModule.deleteStudent('${s.student_id}')">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        ` : '<svg class="ml-auto text-slate-200" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'}
                    </td>
                </tr>`;
            }).join('');
        } catch (err) { console.error("Fetch Error:", err); }
    },

    updatePaginationUI() {
        const totalPages = Math.ceil(this.totalCount / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, this.totalCount);
        
        document.getElementById('range-start').innerText = this.totalCount === 0 ? 0 : start;
        document.getElementById('range-end').innerText = end;
        document.getElementById('range-total').innerText = this.totalCount;

        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === totalPages || totalPages === 0;

        const pageNumbers = document.getElementById('page-numbers');
        pageNumbers.innerHTML = "";
        
        let startPage = Math.max(1, this.currentPage - 1);
        let endPage = Math.min(totalPages, startPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.innerText = i;
            btn.className = `page-btn ${i === this.currentPage ? 'active' : 'inactive'}`;
            btn.onclick = () => { this.currentPage = i; this.fetchAndRenderList(); };
            pageNumbers.appendChild(btn);
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
            btn.classList.replace('hidden', 'flex');
            count.innerText = this.selectedStudents.size;
        } else {
            btn.classList.replace('flex', 'hidden');
        }
    },

    async handleBatchDelete() {
        if (!confirm(`Delete ${this.selectedStudents.size} selected students?`)) return;
        const ids = Array.from(this.selectedStudents);
        const { error } = await supabase.from('students').delete().in('student_id', ids);
        if (error) alert(error.message);
        else { 
            // AUDIT LOG
            logAction('STUDENT_BATCH_DELETE', `Deleted ${ids.length} students: ${ids.join(', ')}`);
            
            this.selectedStudents.clear(); 
            this.updateBatchUI(); 
            this.updateDashboardStats(); // Refresh stats
            this.fetchAndRenderList(); 
        }
    },

    viewProfile(id) {
        const s = this.allStudentsData.find(x => x.student_id === id);
        if (!s) return;
        document.getElementById('prof-name').innerText = s.full_name;
        document.getElementById('prof-id').innerText = `ID: ${s.student_id}`;
        const initials = s.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('prof-initials').innerText = initials.substring(0,2);
        
        const qrContainer = document.getElementById('profile-qr-container');
        qrContainer.innerHTML = "";
        if(window.QRCode) {
            new QRCode(qrContainer, { text: s.student_id, width: 120, height: 120, colorDark : "#000080" });
        }
        document.getElementById('modal-profile').classList.remove('hidden');
    },

    async deleteStudent(id) {
        if (!confirm(`Delete student ${id}?`)) return;
        const { error } = await supabase.from('students').delete().eq('student_id', id);
        if (error) alert(error.message);
        else {
            // AUDIT LOG
            logAction('STUDENT_DELETE', `Deleted student ID: ${id}`);
            
            this.updateDashboardStats(); // Refresh stats
            this.fetchAndRenderList();
        }
    },

    handleExportCSV() {
        if (this.allStudentsData.length === 0) return alert("No data");
        const headers = ["ID", "Name", "College", "Course", "Year", "Dept"];
        const rows = this.allStudentsData.map(s => [s.student_id, s.full_name, s.college, s.course, s.year_level, s.department]);
        let csv = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csv);
        link.download = `Students.csv`;
        link.click();
    },

    async handleManualSave() {
        const id = document.getElementById('stud-id').value.trim();
        const name = document.getElementById('stud-name').value.trim();
        if (!id || !name) return alert("Required fields missing");

        const studentData = {
            student_id: id, 
            full_name: name,
            college: document.getElementById('stud-college').value,
            course: document.getElementById('stud-course').value,
            department: document.getElementById('stud-dept').value, // Direct from UI
            year_level: parseInt(document.getElementById('stud-year').value)
        };

        const { error } = await supabase.from('students').upsert(studentData, { onConflict: 'student_id' });

        if (error) alert(error.message);
        else {
            // AUDIT LOG
            logAction('STUDENT_SAVE', `Saved/Updated student: ${name} (${id})`);

            await supabase.rpc('append_org_to_student', { s_id: id, new_org: currentUserOrg });
            document.getElementById('modal-student').classList.add('hidden');
            this.updateDashboardStats(); // Refresh stats
            this.fetchAndRenderList();
        }
    },

    async handleExcelImport(file) {
        if (!file || !window.XLSX) return alert("Error");
        const progress = document.getElementById('import-progress');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const workbook = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            progress.classList.remove('hidden');
            
            for (let i = 0; i < json.length; i++) {
                const sId = String(json[i]['ID Number'] || json[i]['ID'] || '').trim();
                if (!sId) continue;
                await supabase.from('students').upsert({
                    student_id: sId,
                    full_name: String(json[i]['Student Name'] || json[i]['Name'] || '').trim(),
                    college: String(json[i]['College'] || '').trim(),
                    course: String(json[i]['Course'] || '').trim(),
                    department: String(json[i]['Department'] || 'Other Department').trim(), // Direct from Excel
                    year_level: parseInt(json[i]['Year']) || 1
                });
                await supabase.rpc('append_org_to_student', { s_id: sId, new_org: currentUserOrg });
            }
            
            // AUDIT LOG
            logAction('STUDENT_IMPORT', `Imported ${json.length} students from file: ${file.name}`);

            progress.classList.add('hidden');
            this.updateDashboardStats(); // Refresh stats
            this.fetchAndRenderList();
        };
        reader.readAsArrayBuffer(file);
    }
};
