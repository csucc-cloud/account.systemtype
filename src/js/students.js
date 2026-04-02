import { supabase, currentUserRole, currentUserOrg } from './auth.js';

export const studentModule = {
    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        // Determine if current user has 'write' permissions
        const isStaff = currentUserRole === 'staff';
        const isSuperAdmin = currentUserRole === 'super_admin';

        container.innerHTML = `
            <div class="space-y-6 p-4">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div class="relative w-full md:w-96">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" id="student-search" placeholder="Search by name or ID..." 
                               class="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#000080]/10">
                    </div>
                    
                    <div class="flex gap-2 w-full md:w-auto ${isStaff ? 'hidden' : ''}">
                        <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
                        
                        <button id="btn-import" class="flex items-center justify-center gap-2 flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Import
                        </button>

                        <button id="btn-open-modal" class="flex items-center justify-center gap-2 flex-1 bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-[#000080]/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                            Add Student
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400">
                                    <th class="p-4">ID Number</th>
                                    <th class="p-4">Student Name</th>
                                    ${isSuperAdmin ? '<th class="p-4 text-purple-600">Org Owner</th>' : '<th class="p-4">College</th>'}
                                    <th class="p-4">Course</th>
                                    <th class="p-4">Year</th>
                                    <th class="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body"></tbody>
                        </table>
                    </div>
                </div>

                ${this.renderModals()}
            </div>
        `;
        
        setTimeout(() => this.setupEventListeners(), 200);
    },

    renderModals() {
        return `
            <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-black text-[#000080]">New Student</h3>
                        <button id="btn-close-modal" class="text-slate-400 p-2">✕</button>
                    </div>
                    <div class="space-y-4">
                        <input type="text" id="stud-id" placeholder="ID Number" class="w-full p-4 bg-slate-50 rounded-xl outline-none border focus:border-[#000080]">
                        <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-xl outline-none border focus:border-[#000080]">
                        <input type="text" id="stud-college" placeholder="College" class="w-full p-4 bg-slate-50 rounded-xl outline-none border">
                        <input type="text" id="stud-course" placeholder="Course" class="w-full p-4 bg-slate-50 rounded-xl outline-none border">
                        <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-xl outline-none border">
                            <option value="1">1st Year</option><option value="2">2nd Year</option>
                            <option value="3">3rd Year</option><option value="4">4th Year</option>
                        </select>
                        <button type="button" id="btn-save-manual" class="w-full py-4 bg-[#000080] text-white rounded-2xl font-black shadow-lg">Save Student</button>
                    </div>
                </div>
            </div>

            <div id="import-progress" class="hidden fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                <div class="bg-white p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
                    <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#000080] border-t-transparent mb-4"></div>
                    <h3 class="text-xl font-black text-slate-800 mb-2">Importing Students</h3>
                    <p id="progress-text" class="text-slate-500 font-mono text-lg font-bold">0 / 0</p>
                    <div class="w-full bg-slate-100 h-3 rounded-full mt-4 overflow-hidden">
                        <div id="progress-bar" class="bg-[#000080] h-full transition-all duration-200" style="width: 0%"></div>
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

        const searchInput = document.getElementById('student-search');
        let searchTimer;
        if (searchInput) {
            searchInput.oninput = (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => this.fetchAndRenderList(e.target.value), 400);
            };
        }
    },

    async fetchAndRenderList(searchTerm = "") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });
            
            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query.limit(200);
            if (error) throw error;

            tbody.innerHTML = data.map(s => `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                    <td class="p-4 text-sm font-mono text-slate-500">${s.student_id}</td>
                    <td class="p-4 font-bold text-sm text-slate-700">${s.full_name}</td>
                    ${currentUserRole === 'super_admin' ? 
                        `<td class="p-4 text-[10px] font-bold text-purple-600 uppercase italic">${s.organization_owner || 'Unassigned'}</td>` :
                        `<td class="p-4 text-xs uppercase text-slate-400">${s.college || ''}</td>`
                    }
                    <td class="p-4 text-sm text-slate-600">${s.course || ''}</td>
                    <td class="p-4 text-xs font-black text-[#000080]">YR ${s.year_level}</td>
                    <td class="p-4 text-right">
                        <button class="text-slate-300 hover:text-red-500 transition-colors" onclick="alert('Only Super Admins can delete')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error("Fetch Error:", err);
        }
    },

    async handleManualSave() {
        const id = document.getElementById('stud-id').value.trim();
        const name = document.getElementById('stud-name').value.trim();
        const college = document.getElementById('stud-college').value.trim();
        const course = document.getElementById('stud-course').value.trim();
        const year = document.getElementById('stud-year').value;

        if (!id || !name) return alert("Please fill in at least ID and Name");

        const { error } = await supabase.from('students').upsert({
            student_id: id,
            full_name: name,
            college: college,
            course: course,
            department: this.classifyDepartment(course),
            year_level: parseInt(year),
            organization_owner: currentUserOrg // Tag the creator
        }, { onConflict: 'student_id' });

        if (error) {
            alert("Database Error: " + error.message);
        } else {
            document.getElementById('modal-student').classList.add('hidden');
            this.fetchAndRenderList();
        }
    },

    async handleExcelImport(file) {
        if (!file) return;
        if (!window.XLSX) return alert("Excel library not loaded.");

        const progressModal = document.getElementById('import-progress');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                if (json.length === 0) return alert("File is empty.");
                progressModal.classList.remove('hidden');

                for (let i = 0; i < json.length; i++) {
                    const row = json[i];
                    progressText.innerText = `${i + 1} / ${json.length}`;
                    progressBar.style.width = `${((i + 1) / json.length) * 100}%`;

                    const sId = String(row['ID Number'] || row['ID'] || '').trim();
                    if (!sId) continue;

                    await supabase.from('students').upsert({
                        student_id: sId,
                        full_name: String(row['Student Name'] || row['Name'] || '').trim(),
                        college: row['College'] || '',
                        course: row['Course'] || row['Course/Program'] || '',
                        department: this.classifyDepartment(row['Course'] || row['Course/Program']),
                        year_level: parseInt(String(row['Year'] || row['Year Level'] || '1').replace(/\D/g, '')) || 1,
                        organization_owner: currentUserOrg // Universal tagging
                    }, { onConflict: 'student_id' });

                    if (i % 10 === 0) await new Promise(r => setTimeout(r, 20));
                }
                alert("Import Complete!");
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
