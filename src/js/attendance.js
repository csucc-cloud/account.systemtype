import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        activeEventName: '',
        activeDay: 1,
        attendanceList: [],
        isLoading: false
    },

    // --- SMART SCANNER LOGIC ---
    async processScan(studentId) {
        if (!this.state.activeEventId) return this.notify("Select an event first", "error");
        
        try {
            // Check if student has scanned in today for this event
            const { data: record, error: fetchErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('event_id', this.state.activeEventId)
                .eq('event_day', this.state.activeDay)
                .maybeSingle();

            if (!record) {
                // FIRST SCAN: Create record (Time In)
                const { error } = await supabase.from('attendance').insert([{
                    student_id: studentId,
                    event_id: this.state.activeEventId,
                    event_name: this.state.activeEventName,
                    event_day: this.state.activeDay,
                    time_in: new Date().toISOString(),
                    status: 'In Venue'
                }]);
                if (error) throw error;
                this.notify(`TIME IN: ${studentId}`, "success");
            } 
            else if (record && !record.time_out) {
                // SECOND SCAN: Update record (Time Out)
                const { error } = await supabase.from('attendance')
                    .update({ 
                        time_out: new Date().toISOString(),
                        status: 'Completed' 
                    })
                    .eq('id', record.id);
                if (error) throw error;
                this.notify(`TIME OUT: ${studentId}`, "success");
            } 
            else {
                this.notify("Attendance already completed.", "info");
            }

            this.fetchAttendance(this.state.activeEventId);
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

    // --- DATABASE SYNC ---
    async fetchAttendance(eventId) {
        this.state.activeEventId = eventId;
        const { data, error } = await supabase
            .from('attendance')
            .select(`*, profiles:student_id (full_name, course, year_level)`)
            .eq('event_id', eventId)
            .eq('event_day', this.state.activeDay)
            .order('time_in', { ascending: false });

        if (!error) {
            this.state.attendanceList = data || [];
            this.renderList();
        }
    },

    // --- EXPORT TO CSV ---
    exportToCSV() {
        if (this.state.attendanceList.length === 0) return;
        
        const headers = ["Event", "Day", "Name", "ID", "Course/Year", "In", "Out", "Status"];
        const rows = this.state.attendanceList.map(entry => [
            this.state.activeEventName,
            entry.event_day,
            entry.profiles?.full_name || 'N/A',
            entry.student_id,
            `${entry.profiles?.course || ''} ${entry.profiles?.year_level || ''}`,
            entry.time_in ? new Date(entry.time_in).toLocaleTimeString() : '',
            entry.time_out ? new Date(entry.time_out).toLocaleTimeString() : '',
            entry.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_${this.state.activeEventName}_Day${this.state.activeDay}.csv`;
        a.click();
    },

    // --- UI RENDER (Professional Light Theme) ---
    render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        container.innerHTML = `
            <div class="p-6 lg:p-10 bg-[#f8fafc] min-h-screen space-y-8">
                <div class="flex justify-between items-end">
                    <div>
                        <h1 class="text-5xl font-black italic tracking-tighter uppercase">Registry<span class="text-blue-800/30">Master</span></h1>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connected to Supabase Live</p>
                    </div>
                    <div class="flex gap-4">
                        <select id="day-selector" class="px-6 py-3 bg-white border border-slate-200 rounded-xl font-black text-[10px] outline-none">
                            ${[1,2,3].map(d => `<option value="${d}">Day ${d}</option>`).join('')}
                        </select>
                        <button id="btn-export-csv" class="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Export CSV</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div class="lg:col-span-1 bg-white p-8 rounded-[2rem] border-2 border-blue-900 shadow-xl">
                        <p class="text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest">Scanner Ready</p>
                        <input type="text" id="scanner-input" autofocus placeholder="SCAN ID..." 
                            class="w-full p-4 bg-slate-50 rounded-xl font-black text-center text-lg border-2 border-transparent focus:border-blue-500 outline-none uppercase">
                        <div class="mt-4 h-1 w-full bg-slate-100 overflow-hidden rounded-full">
                            <div class="h-full bg-blue-900 animate-progress w-1/2"></div>
                        </div>
                    </div>

                    <div class="lg:col-span-3 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 border-b border-slate-100">
                                <tr class="text-[9px] font-black text-slate-400 uppercase">
                                    <th class="p-5">Student</th>
                                    <th class="p-5">Program</th>
                                    <th class="p-5 text-center">Time In</th>
                                    <th class="p-5 text-center">Time Out</th>
                                    <th class="p-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody id="att-table-body" class="divide-y divide-slate-50"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        this.initListeners();
    },

    renderList() {
        const body = document.getElementById('att-table-body');
        if (!body) return;

        body.innerHTML = this.state.attendanceList.map(entry => `
            <tr class="text-xs font-bold text-slate-700 hover:bg-blue-50/50 transition-colors">
                <td class="p-5">
                    <div class="flex flex-col">
                        <span class="uppercase font-black text-blue-900">${entry.profiles?.full_name || 'Unknown'}</span>
                        <span class="text-[10px] font-mono text-slate-400">${entry.student_id}</span>
                    </div>
                </td>
                <td class="p-5 text-[10px] uppercase">${entry.profiles?.course || ''} ${entry.profiles?.year_level || ''}</td>
                <td class="p-5 text-center font-black text-blue-600">${entry.time_in ? new Date(entry.time_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                <td class="p-5 text-center font-black text-blue-600">${entry.time_out ? new Date(entry.time_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                <td class="p-5 text-center">
                    <span class="px-4 py-1 rounded-full text-[8px] font-black uppercase ${entry.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">
                        ${entry.status}
                    </span>
                </td>
            </tr>
        `).join('');
    },

    initListeners() {
        const input = document.getElementById('scanner-input');
        const daySelect = document.getElementById('day-selector');
        const exportBtn = document.getElementById('btn-export-csv');

        if (input) {
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.processScan(input.value.trim());
                    input.value = '';
                }
            };
        }

        if (daySelect) {
            daySelect.onchange = (e) => {
                this.state.activeDay = e.target.value;
                this.fetchAttendance(this.state.activeEventId);
            };
        }

        if (exportBtn) exportBtn.onclick = () => this.exportToCSV();
    },

    notify(msg, type) {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-blue-900' : 'bg-red-600';
        toast.className = `fixed bottom-10 right-10 px-8 py-4 rounded-full text-white font-black uppercase text-[10px] tracking-widest shadow-2xl ${color}`;
        toast.innerText = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};
