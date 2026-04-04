import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        allEvents: [],
        attendees: [], 
        isScannerActive: false,
        html5QrCode: null 
    },

    async render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        if (this.state.allEvents.length === 0) await this.fetchEventsForDropdown();

        container.innerHTML = `
            <div class="p-4 md:p-10 min-h-screen bg-[#F4F7FA]">
                <div class="max-w-[1600px] mx-auto space-y-8">
                    
                    <div class="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col lg:flex-row justify-between items-center gap-6">
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 bg-gradient-to-br from-[#000080] to-[#0000C8] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20 ring-4 ring-blue-50">
                                <i data-lucide="qr-code" class="w-7 h-7"></i>
                            </div>
                            <div>
                                <h1 class="text-2xl font-black text-slate-900 tracking-tight">Attendance <span class="text-[#000080]">Console</span></h1>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Pro-Optic Scan v2.0
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-center gap-3">
                            <select id="event-selector" class="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-700 outline-none cursor-pointer min-w-[240px]">
                                <option value="">-- Select Active Event --</option>
                                ${this.state.allEvents.map(ev => `
                                    <option value="${ev.id}" ${this.state.activeEventId === ev.id ? 'selected' : ''}>${ev.event_name}</option>
                                `).join('')}
                            </select>

                            <button id="btn-export-excel" class="px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg hover:bg-emerald-700 transition-all">
                                <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
                                Export Excel
                            </button>

                            <button id="btn-toggle-scanner" class="px-8 py-3.5 ${this.state.isScannerActive ? 'bg-rose-500' : 'bg-[#000080]'} text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg">
                                <i data-lucide="${this.state.isScannerActive ? 'camera-off' : 'camera'}" class="w-4 h-4"></i>
                                ${this.state.isScannerActive ? 'Terminate' : 'Initialize'}
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div class="lg:col-span-4 space-y-8">
                            <div class="bg-white p-2 rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden">
                                <div id="reader" class="w-full aspect-square bg-slate-950 rounded-[2.5rem] overflow-hidden relative border-[8px] border-slate-50">
                                    ${!this.state.isScannerActive ? `
                                        <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                                            <i data-lucide="video-off" class="w-8 h-8 text-slate-700"></i>
                                            <p class="text-[10px] font-black uppercase tracking-[0.3em]">Optic Standby</p>
                                        </div>
                                    ` : `
                                        <div class="absolute inset-0 z-10 pointer-events-none border-[40px] border-black/10">
                                            <div class="w-full h-1 bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,1)] absolute top-0 animate-[scan_2s_ease-in-out_infinite]"></div>
                                        </div>
                                    `}
                                </div>
                            </div>

                            <div class="bg-[#000080] p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
                                <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300/60 mb-6">Manual Override</h3>
                                <div class="flex gap-3 relative z-10">
                                    <input type="text" id="manual-student-id" placeholder="STUDENT ID" class="flex-1 bg-white/10 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold outline-none uppercase">
                                    <button id="btn-manual-submit" class="bg-yellow-400 px-6 rounded-2xl">
                                        <i data-lucide="send" class="w-5 h-5 text-[#000080]"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[700px]">
                            <div class="p-10 border-b border-slate-50 flex justify-between items-end">
                                <div>
                                    <h2 class="text-lg font-black text-slate-900 uppercase tracking-tight">Participant Stream</h2>
                                    <p id="fetch-status" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Syncing Database...</p>
                                </div>
                                <div class="text-right">
                                    <span id="attendee-count" class="text-5xl font-black italic text-[#000080] tracking-tighter">00/00</span>
                                </div>
                            </div>
                            <div class="flex-1 overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead>
                                        <tr class="bg-slate-50/50">
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">ID</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Full Name</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="attendance-feed" class="divide-y divide-slate-50"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes scan { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: 2.5rem; }
            </style>
        `;

        this.initEventListeners();
        if (this.state.activeEventId) this.fetchAttendance();
        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        document.getElementById('btn-toggle-scanner').onclick = async () => {
            if (!this.state.activeEventId) return alert("Select event first!");
            this.state.isScannerActive = !this.state.isScannerActive;
            await this.render();
            if (this.state.isScannerActive) this.startScanner();
            else this.stopScanner();
        };

        document.getElementById('btn-export-excel').onclick = () => this.exportToExcel();

        document.getElementById('event-selector').onchange = (e) => {
            this.state.activeEventId = e.target.value;
            this.fetchAttendance();
        };

        document.getElementById('btn-manual-submit').onclick = () => {
            const el = document.getElementById('manual-student-id');
            if (el.value.trim()) {
                this.markAttendance(el.value.trim());
                el.value = '';
            }
        };
    },

    /**
     * EXCEL EXPORT FEATURE
     */
    exportToExcel() {
        if (this.state.attendees.length === 0) return alert("No data to export.");
        
        const eventName = this.state.allEvents.find(e => e.id == this.state.activeEventId)?.event_name || "Event";
        
        // Map data for Excel rows
        const data = this.state.attendees.map(a => ({
            "Student ID": a.student_id,
            "Full Name": a.full_name,
            "Department": a.department,
            "Course": a.course,
            "Year Level": a.year_level,
            "Time In": a.time_in ? new Date(a.time_in).toLocaleString() : "N/A",
            "Time Out": a.time_out ? new Date(a.time_out).toLocaleString() : "N/A",
            "Status": (a.time_in && a.time_out) ? "Present" : (a.time_in ? "In Venue" : "Absent")
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        // Download file
        XLSX.writeFile(workbook, `${eventName}_Attendance_${new Date().toLocaleDateString()}.xlsx`);
    },

    async startScanner() {
        if (!this.state.html5QrCode) this.state.html5QrCode = new Html5Qrcode("reader");
        const config = {
            fps: 20, 
            qrbox: { width: 280, height: 280 },
            videoConstraints: { facingMode: "environment", focusMode: "continuous" }
        };
        try {
            await this.state.html5QrCode.start({ facingMode: "environment" }, config, (text) => this.markAttendance(text));
        } catch (err) {
            this.state.isScannerActive = false;
            this.render();
        }
    },

    async stopScanner() {
        if (this.state.html5QrCode) await this.state.html5QrCode.stop();
    },

    async markAttendance(studentId) {
        const student = this.state.attendees.find(a => a.student_id.toString() === studentId.toString());
        if (!student) return alert("Student not in target list.");

        let data = { student_id: studentId, event_id: this.state.activeEventId };
        if (!student.time_in) data.time_in = new Date().toISOString();
        else if (!student.time_out) data.time_out = new Date().toISOString();
        else return alert("Attendance complete.");

        const { error } = await supabase.from('attendance').upsert(data, { onConflict: 'student_id, event_id' });
        if (!error) await this.fetchAttendance();
    },

    async fetchAllStudents(query) {
        let allData = [];
        let rangeStart = 0;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await query.range(rangeStart, rangeStart + 999);
            if (error || !data) break;
            allData = [...allData, ...data];
            if (data.length < 1000) hasMore = false;
            else rangeStart += 1000;
        }
        return allData;
    },

    async fetchAttendance() {
        if (!this.state.activeEventId) return;
        const { data: event } = await supabase.from('events').select('*').eq('id', this.state.activeEventId).single();
        let query = supabase.from('students').select('*').order('full_name', { ascending: true });
        
        if (event?.target_dept && !['All', 'NULL'].includes(event.target_dept)) query = query.ilike('department', `%${event.target_dept}%`);
        if (event?.target_year && !['All', 'NULL'].includes(event.target_year)) query = query.eq('year_level', parseInt(event.target_year));

        const students = await this.fetchAllStudents(query);
        const { data: logs } = await supabase.from('attendance').select('*').eq('event_id', this.state.activeEventId);

        this.state.attendees = (students || []).map(s => {
            const log = (logs || []).find(l => l.student_id === s.student_id);
            return { ...s, time_in: log?.time_in, time_out: log?.time_out, is_present: !!log };
        });
        this.renderFeed();
    },

    renderFeed() {
        const feed = document.getElementById('attendance-feed');
        const count = document.getElementById('attendee-count');
        if (!feed) return;
        const present = this.state.attendees.filter(a => a.is_present).length;
        count.innerText = `${present.toString().padStart(2, '0')}/${this.state.attendees.length}`;
        const sorted = [...this.state.attendees].sort((a, b) => (b.time_in ? 1 : 0) - (a.time_in ? 1 : 0));

        feed.innerHTML = sorted.map(row => {
            let status = `<span class="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-black uppercase ring-1 ring-slate-200">Pending</span>`;
            if (row.time_in && !row.time_out) status = `<span class="px-4 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase ring-1 ring-amber-100 animate-pulse">In Venue</span>`;
            else if (row.time_in && row.time_out) status = `<span class="px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase ring-1 ring-emerald-100">Present</span>`;
            return `<tr class="hover:bg-slate-50 ${!row.time_in ? 'opacity-60' : ''}">
                <td class="px-8 py-6 font-black text-slate-500 text-[11px]">${row.student_id}</td>
                <td class="px-8 py-6 font-black text-slate-800">${row.full_name} <br> <span class="text-[9px] text-slate-400 uppercase">${row.course}</span></td>
                <td class="px-8 py-6 text-right">${status}</td>
            </tr>`;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    async fetchEventsForDropdown() {
        const { data } = await supabase.from('events').select('id, event_name').order('created_at', { ascending: false });
        this.state.allEvents = data || [];
    }
};
