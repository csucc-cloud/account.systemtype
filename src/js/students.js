import { supabase } from './auth.js';

export const studentModule = {
    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div class="relative w-full md:w-96">
                        <input type="text" id="student-search" placeholder="Search by name or ID..." 
                               class="w-full pl-4 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none">
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
                        <button id="btn-import" class="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold">Import Excel</button>
                        <button id="btn-open-modal" class="flex-1 bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold">Add Student</button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400">
                                    <th class="p-4">ID Number</th>
                                    <th class="p-4">Student Name</th>
                                    <th class="p-4">College</th>
                                    <th class="p-4">Course</th>
                                    <th class="p-4">Year</th>
                                    <th class="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body"></tbody>
                        </table>
                    </div>
                </div>

                <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-black text-[#000080]">New Student</h3>
                            <button id="btn-close-modal" class="text-slate-400 p-2">✕</button>
                        </div>
                        <div class="space-y-4">
                            <input type="text" id="stud-id" placeholder="ID Number" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-college" placeholder="College" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-course" placeholder="Course" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                            <button type="button" id="btn-save-manual" class="w-full py-4 bg-[#000080] text-white rounded-2xl font-black">Save Student</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => this.setupEventListeners(), 200);
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
        
        document.getElementById('btn-open-modal').onclick = () => modal.classList.remove('hidden');
        document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
        document.getElementById('btn-save-manual').onclick = () => this.handleManualSave();

        const fileInput = document.getElementById('bulk-upload');
        document.getElementById('btn-import').onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleExcelImport(e.target.files[0]);

        const searchInput = document.getElementById('student-search');
        let searchTimer;
        searchInput.oninput = (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.fetchAndRenderList(e.target.value), 400);
        };
    },

    async fetchAndRenderList(searchTerm = "") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });
            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query.limit(100);
            if (error) throw error;

            tbody.innerHTML = data.map(s => `
                <tr class="border-b border-slate-50">
                    <td class="p-4 text-sm font-mono">${s.student_id}</td>
                    <td class="p-4 font-bold text-sm">${s.full_name}</td>
                    <td class="p-4 text-xs uppercase">${s.college || ''}</td>
                    <td class="p-4 text-sm">${s.course || ''}</td>
                    <td class="p-4 text-xs font-black">YR ${s.year_level}</td>
                    <td class="p-4 text-right text-slate-300">...</td>
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
            year_level: parseInt(year)
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
        if (!window.XLSX) return alert("Excel library (SheetJS) is not loaded.");

import { supabase } from './auth.js';

export const studentModule = {
    render() {
        const container = document.getElementById('mod-students');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div class="relative w-full md:w-96">
                        <input type="text" id="student-search" placeholder="Search by name or ID..." 
                               class="w-full pl-4 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none">
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <input type="file" id="bulk-upload" accept=".xlsx, .csv" class="hidden">
                        <button id="btn-import" class="flex-1 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold">Import Excel</button>
                        <button id="btn-open-modal" class="flex-1 bg-[#000080] text-white px-6 py-2 rounded-xl text-sm font-bold">Add Student</button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-slate-50 border-b border-slate-100">
                                <tr class="text-[10px] font-black uppercase text-slate-400">
                                    <th class="p-4">ID Number</th>
                                    <th class="p-4">Student Name</th>
                                    <th class="p-4">College</th>
                                    <th class="p-4">Course</th>
                                    <th class="p-4">Year</th>
                                    <th class="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="student-table-body"></tbody>
                        </table>
                    </div>
                </div>

                <div id="modal-student" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-black text-[#000080]">New Student</h3>
                            <button id="btn-close-modal" class="text-slate-400 p-2">✕</button>
                        </div>
                        <div class="space-y-4">
                            <input type="text" id="stud-id" placeholder="ID Number" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-name" placeholder="Full Name" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-college" placeholder="College" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <input type="text" id="stud-course" placeholder="Course" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                            <select id="stud-year" class="w-full p-4 bg-slate-50 rounded-xl outline-none">
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                            <button type="button" id="btn-save-manual" class="w-full py-4 bg-[#000080] text-white rounded-2xl font-black">Save Student</button>
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
                        <p class="text-[10px] text-slate-400 mt-4 uppercase font-bold tracking-widest">Processing database rows...</p>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => this.setupEventListeners(), 200);
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
        
        document.getElementById('btn-open-modal').onclick = () => modal.classList.remove('hidden');
        document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');
        document.getElementById('btn-save-manual').onclick = () => this.handleManualSave();

        const fileInput = document.getElementById('bulk-upload');
        document.getElementById('btn-import').onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleExcelImport(e.target.files[0]);

        const searchInput = document.getElementById('student-search');
        let searchTimer;
        searchInput.oninput = (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this.fetchAndRenderList(e.target.value), 400);
        };
    },

    async fetchAndRenderList(searchTerm = "") {
        const tbody = document.getElementById('student-table-body');
        if (!tbody) return;

        try {
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });
            if (searchTerm) {
                query = query.or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query.limit(100);
            if (error) throw error;

            tbody.innerHTML = data.map(s => `
                <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td class="p-4 text-sm font-mono text-slate-500">${s.student_id}</td>
                    <td class="p-4 font-bold text-sm text-slate-700">${s.full_name}</td>
                    <td class="p-4 text-xs uppercase text-slate-400">${s.college || ''}</td>
                    <td class="p-4 text-sm text-slate-600">${s.course || ''}</td>
                    <td class="p-4 text-xs font-black text-[#000080]">YR ${s.year_level}</td>
                    <td class="p-4 text-right text-slate-300">...</td>
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
            year_level: parseInt(year)
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
        if (!window.XLSX) return alert("Excel library (SheetJS) is not loaded.");

        const progressModal = document.getElementById('import-progress');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const totalRows = json.length;
                if (totalRows === 0) return alert("File is empty.");

                // Show Progress UI
                progressModal.classList.remove('hidden');
                let successCount = 0;
                let errorCount = 0;

                for (let i = 0; i < totalRows; i++) {
                    const row = json[i];
                    
                    // Update Progress UI
                    const currentStatus = i + 1;
                    progressText.innerText = `${currentStatus} / ${totalRows}`;
                    progressBar.style.width = `${(currentStatus / totalRows) * 100}%`;

                    const sId = String(row['ID'] || '').trim();
                    if (!sId) continue;

                    const studentData = {
                        student_id: sId,
                        full_name: String(row['Name'] || '').trim(),
                        college: row['College'] || '',
                        course: row['Course/Program'] || '',
                        department: this.classifyDepartment(row['Course/Program']),
                        year_level: parseInt(String(row['Year Level'] || '1').replace(/\D/g, '')) || 1
                    };

                    const { error } = await supabase
                        .from('students')
                        .upsert(studentData, { onConflict: 'student_id' });

                    if (error) {
                        errorCount++;
                        console.error(`Error at Row ${i + 2}:`, error);
                        // We alert and stop ONLY if you want to see every error. 
                        // Otherwise, it continues to try the rest.
                    } else {
                        successCount++;
                    }

                    // Stability: Every 20 rows, pause for 50ms to prevent browser/network hang
                    if (i % 20 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                alert(`Import Finished!\n✅ Successfully Saved: ${successCount}\n❌ Conflicts/Errors: ${errorCount}`);

            } catch (err) {
                console.error("Critical Import Error:", err);
                alert("System Error: " + err.message);
            } finally {
                // Hide Progress UI and refresh
                progressModal.classList.add('hidden');
                this.fetchAndRenderList();
            }
        };
        reader.readAsArrayBuffer(file);
    }
};
