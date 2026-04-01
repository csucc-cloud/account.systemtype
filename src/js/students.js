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
        
        // Use a tiny delay to ensure DOM is ready
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
        
        // Open Modal
        const btnOpen = document.getElementById('btn-open-modal');
        if (btnOpen) {
            btnOpen.onclick = function() {
                modal.classList.remove('hidden');
            };
        }

        // Close Modal
        const btnClose = document.getElementById('btn-close-modal');
        if (btnClose) {
            btnClose.onclick = function() {
                modal.classList.add('hidden');
            };
        }

        // Save Button
        const btnSave = document.getElementById('btn-save-manual');
        if (btnSave) {
            btnSave.onclick = () => {
                this.handleManualSave();
            };
        }

        // Import Button
        const btnImport = document.getElementById('btn-import');
        const fileInput = document.getElementById('bulk-upload');
        if (btnImport && fileInput) {
            btnImport.onclick = function() {
                fileInput.click();
            };
            fileInput.onchange = (e) => {
                this.handleExcelImport(e.target.files[0]);
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
    }
};
