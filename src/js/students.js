import { supabase, currentUserRole, currentUserOrg } from './auth.js';

export const studentModule = {
    allStudents: [], // Store data for local filtering/export

    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        const isStaff = currentUserRole === 'staff';
        const isSuperAdmin = currentUserRole === 'super_admin';

        container.innerHTML = `
            <div class="space-y-6 p-6 animate-in fade-in duration-500">
                <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h2 class="text-2xl font-black text-[#000080]">Student Management</h2>
                        <p class="text-slate-400 text-sm">Manage, filter, and export student records.</p>
                    </div>

                    <div class="flex flex-wrap gap-3 w-full lg:w-auto">
                        <div class="relative flex-1 md:w-80">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </span>
                            <input type="text" id="student-search" placeholder="Search name or ID..." 
                                   class="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#000080]/10 transition-all">
                        </div>

                        <div class="flex gap-2 w-full md:w-auto ${isStaff ? 'hidden' : ''}">
                            <button id="btn-export" class="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export CSV
                            </button>

                            <button id="btn-import" class="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Import
                            </button>

                            <button id="btn-open-modal" class="flex items-center justify-center gap-2 px-6 py-3 bg-[#000080] text-white rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-[#000080]/20">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                Add Student
                            </button>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50/50 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                                    <th class="p-5">ID Number</th>
                                    <th class="p-5">Student Name</th>
                                    <th class="p-5">${isSuperAdmin ? 'Org Membership' : 'Department'}</th>
                                    <th class="p-5">Course & Year</th>
                                    <th class="p-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body" class="divide-y divide-slate-50">
                                </tbody>
                        </table>
                    </div>
                </div>

                ${this.renderModals()}
                <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
            </div>
        `;
        
        setTimeout(() => this.setupEventListeners(), 100);
    },

    renderModals() {
        return `
            <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
                <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in duration-300">
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h3 id="modal-title" class="text-2xl font-black text-[#000080]">New Student</h3>
                            <p class="text-slate-400 text-sm">Fill in the student details below.</p>
                        </div>
                        <button id="btn-close-modal" class="bg-slate-100 text-slate-400 hover:text-red-500 p-3 rounded-2xl transition-colors">✕</button>
                    </div>
                    <form id="student-form" class="space-y-4">
                        <input type="text" id="stud-id" placeholder="ID Number (e.g. 2023-00001)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] focus:bg-white transition-all text-sm">
                        <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] focus:bg-white transition-all text-sm">
                        
                        <div class="grid grid-cols-2 gap-4">
                             <select id="stud-dept" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] text-sm appearance-none">
                                <option value="Education Dept.">Education Dept.</option>
                                <option value="Industrial Technology Dept.">Industrial Tech Dept.</option>
                                <option value="Vocational Tech Dept.">Vocational Tech Dept.</option>
                                <option value="Other Department">Other Dept.</option>
                            </select>
                            <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] text-sm appearance-none">
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>
                        
                        <input type="text" id="stud-course" placeholder="Course (e.g. BTLED)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none border border-transparent focus:border-[#000080] text-sm">
                        
                        <button type="button" id="btn-save-manual" class="w-full py-5 bg-[#000080] text-white rounded-3xl font-black shadow-xl shadow-[#000080]/30 hover:scale-[1.02] active:scale-95 transition-all mt-4">
                            Save Student Record
                        </button>
                    </form>
                </div>
            </div>

            <div id="import-progress" class="hidden fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                <div class="bg-white p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl">
                    <div class="inline-block animate-spin rounded-full h-14 w-14 border-[6px] border-[#000080] border-t-transparent mb-6"></div>
                    <h3 class="text-xl font-black text-slate-800 mb-2">Syncing Database</h3>
                    <p id="progress-text" class="text-slate-400 font-mono text-lg font-bold mb-6">0 / 0</p>
                    <div class="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                        <div id="progress-bar" class="bg-[#000080] h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        // Modal Toggles
        const modal = document.getElementById('modal-student');
        document.getElementById('btn-open-modal')?.addEventListener('click', () => {
            document.getElementById('student-form').reset();
            document.getElementById('modal-title').innerText = "New Student";
            modal.classList.remove('hidden');
        });
        document.getElementById('btn-close-modal')?.addEventListener('click', () => modal.classList.add('hidden'));

        // Save & Import
        document.getElementById('btn-save-manual')?.addEventListener('click', () => this.handleManualSave());
        document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('bulk-upload').click());
        document.getElementById('bulk-upload')?.addEventListener('change', (e) => this.handleExcelImport(e.target.files[0]));
        
        // Export
        document.getElementById('btn-export')?.addEventListener('click', () => this.handleExport());

        // Search
        let searchTimer;
        document.getElementById('student-search')?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.fetchAndRenderList(e.target.value), 400);
        });
    },

    async fetchAndRenderList(searchTerm = "") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });
            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query.limit(500);
            if (error) throw error;
            
            this.allStudents = data; // Cache for export

            tbody.innerHTML = data.map(s => {
                const orgTags = Array.isArray(s.organization_owner) 
                    ? s.organization_owner.join(' • ') 
                    : (s.organization_owner || 'Unassigned');

                return `
                    <tr class="group hover:bg-slate-50/80 transition-all">
                        <td class="p-5 text-sm font-mono font-bold text-slate-400">${s.student_id}</td>
                        <td class="p-5">
                            <div class="font-black text-slate-700 text-sm">${s.full_name}</div>
                            <div class="text-[10px] text-slate-400 uppercase tracking-tighter">${s.course || 'No Course'}</div>
                        </td>
                        <td class="p-5">
                            ${currentUserRole === 'super_admin' ? 
                                `<span class="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase italic border border-purple-100">${orgTags}</span>` :
                                `<span class="text-xs font-bold text-slate-500">${s.department || 'N/A'}</span>`
                            }
                        </td>
                        <td class="p-5">
                             <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 bg-[#000080]/5 text-[#000080] rounded-md text-[10px] font-black">YEAR ${s.year_level}</span>
                             </div>
                        </td>
                        <td class="p-5 text-right">
                            <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                ${currentUserRole === 'super_admin' ? `
                                    <button onclick="studentModule.deleteStudent('${s.student_id}')" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                ` : `
                                    <span class="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Locked</span>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error("Fetch Error:", err);
        }
    },

    async handleManualSave() {
        const id = document.getElementById('stud-id').value.trim();
        const name = document.getElementById('stud-name').value.trim();
        const dept = document.getElementById('stud-dept').value;
        const course = document.getElementById('stud-course').value.trim();
        const year = document.getElementById('stud-year').value;

        if (!id || !name) return alert("Student ID and Name are required.");

        const { error } = await supabase.from('students').upsert({
            student_id: id,
            full_name: name,
            department: dept,
            course: course,
            year_level: parseInt(year)
        }, { onConflict: 'student_id' });

        if (error) return alert("Save Error: " + error.message);

        document.getElementById('modal-student').classList.add('hidden');
        this.fetchAndRenderList();
    },

    async deleteStudent(id) {
        if (!confirm(`Delete student ${id}? This cannot be undone.`)) return;
        
        const { error } = await supabase.from('students').delete().eq('student_id', id);
        if (error) alert("Delete Error: " + error.message);
        else this.fetchAndRenderList();
    },

    handleExport() {
        if (this.allStudents.length === 0) return alert("No data to export.");
        
        const headers = ["ID Number", "Student Name", "Department", "Course", "Year"];
        const csvContent = [
            headers.join(","),
            ...this.allStudents.map(s => [
                `"${s.student_id}"`, 
                `"${s.full_name}"`, 
                `"${s.department}"`, 
                `"${s.course}"`, 
                s.year_level
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Student_List_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    async handleExcelImport(file) {
        if (!file || !window.XLSX) return alert("XLSX Library not loaded.");

        const progressModal = document.getElementById('import-progress');
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            progressModal.classList.remove('hidden');

            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                const sId = String(row['ID Number'] || row['ID'] || '').trim();
                if (!sId) continue;

                document.getElementById('progress-text').innerText = `${i + 1} / ${json.length}`;
                document.getElementById('progress-bar').style.width = `${((i + 1) / json.length) * 100}%`;

                // The Database Trigger handles the 'organization_owner' automatically!
                await supabase.from('students').upsert({
                    student_id: sId,
                    full_name: String(row['Student Name'] || row['Name'] || '').trim(),
                    department: row['Department'] || 'Other Department',
                    course: row['Course'] || '',
                    year_level: parseInt(String(row['Year'] || '1').replace(/\D/g, '')) || 1
                }, { onConflict: 'student_id' });

                if (i % 25 === 0) await new Promise(r => setTimeout(r, 1));
            }
            
            progressModal.classList.add('hidden');
            alert("Import Complete!");
            this.fetchAndRenderList();
        };
        reader.readAsArrayBuffer(file);
    }
};
