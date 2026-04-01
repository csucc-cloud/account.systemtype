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
        
        setTimeout(() => {
            this.setupEventListeners();
        }, 200);
    },

    classifyDepartment(course) {
        if (!course) return 'Other Department';
        const c = course.toUpperCase();
        if (c.includes('BTLED')) return 'Education Dept.';
        if (c.includes('BSINDTECH')) return 'Industrial Technology Dept.';
        return 'Other Department';
    },

    async init() {
        this.render();
        await this.fetchAndRenderList();
    },

    setupEventListeners() {
        const modal = document.getElementById('modal-student');
        
        // Open/Close
        document.getElementById('btn-open-modal').onclick = () => modal.classList.remove('hidden');
        document.getElementById('btn-close-modal').onclick = () => modal.classList.add('hidden');

        // Save
        document.getElementById('btn-save-manual').onclick = () => this.handleManualSave();

        // Import
        const fileInput = document.getElementById('bulk-upload');
        document.getElementById('btn-import').onclick = () => fileInput.click();
        fileInput.onchange = (e) => this.handleExcelImport(e.target.files[0]);

        // Search
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

            const { data, error } = await query.limit(50);
            if (error) throw error;

            tbody.innerHTML = data.map(s => `
                <tr class="border-b border-slate-50">
                    <td class="p-4 text-sm font-mono">${s.student_id}</td>
                    <td class="p-4 font-bold text-sm">${s.full_name}</td>
                    <td class="p-4 text-xs uppercase">${s.college || ''}</td>
                    <td class="p-4 text-sm">${s.course || ''}</td>
                    <td class="p-4 text-xs font-black">YR ${s.year_level}</td>
                    <td class="p-4 text-right">...</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error(err);
        }
    },

    async handleManualSave() {
        const id = document.getElementById('stud-id').value;
        const name = document.getElementById('stud-name').value;
        const college = document.getElementById('stud-college').value;
        const course = document.getElementById('stud-course').value;
        const year = document.getElementById('stud-year').value;

        if (!id || !name) return alert("Fill ID and Name");

        const { error } = await supabase.from('students').upsert({
            student_id: id,
            full_name: name,
            college: college,
            course: course,
            department: this.classifyDepartment(course),
            year_level: year
        }, { onConflict: 'student_id' });

        if (error) {
            alert("Error: " + error.message);
        } else {
            document.getElementById('modal-student').classList.add('hidden');
            this.fetchAndRenderList();
        }
    },

    async handleExcelImport(file) {

        if (!file) return;

        if (!window.XLSX) return alert("Excel library not loaded. Check index.html");



        const reader = new FileReader();

        reader.onload = async (e) => {

            try {

                const data = new Uint8Array(e.target.result);

                const workbook = window.XLSX.read(data, { type: 'array' });

                const json = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);



                const batch = json.map(row => {

                    const getValue = (names) => {

                        const key = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));

                        return row[key] || '';

                    };



                    const course = getValue(['course', 'program', 'course/program']);

                    

                    // FIX: Convert "1st Year" to integer 1

                    let yearRaw = String(getValue(['year', 'year level', 'yr']) || '1');

                    let yearClean = parseInt(yearRaw.replace(/\D/g, '')) || 1;



                    return {

                        student_id: String(getValue(['id', 'id number', 'student id', 'studentid'])),

                        full_name: getValue(['name', 'full name', 'student name', 'fullname']),

                        college: getValue(['college', 'school', 'dept']),

                        course: course,

                        department: this.classifyDepartment(course),

                        year_level: yearClean 

                    };

                });



                const { error } = await supabase.from('students').upsert(batch, { onConflict: 'student_id' });

                if (error) throw error;



                alert(`Success! Imported ${batch.length} students.`);

                this.fetchAndRenderList();

            } catch (err) {

                alert("Import Error: " + err.message);

            }

        };

        reader.readAsArrayBuffer(file);

    }

};
