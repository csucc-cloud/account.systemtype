import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        activeEventName: '',
        activeDay: 1, // Supports Multi-day
        attendanceList: [],
        isLoading: false,
    },

    /**
     * SMART SCANNER LOGIC: 
     * 1st Scan -> Sets Time In, Status: "In Venue"
     * 2nd Scan -> Sets Time Out, Status: "Completed"
     */
    async processScan(studentId) {
        if (!this.state.activeEventId) return this.notify("Please select an event first", "error");
        
        try {
            // 1. Check for existing record for THIS STUDENT on THIS DAY for THIS EVENT
            const { data: existing, error: fetchErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('event_id', this.state.activeEventId)
                .eq('event_day', this.state.activeDay)
                .single();

            if (!existing) {
                // FIRST SCAN: Time In
                const { error: inErr } = await supabase.from('attendance').insert([{
                    student_id: studentId,
                    event_id: this.state.activeEventId,
                    event_name: this.state.activeEventName,
                    event_day: this.state.activeDay,
                    time_in: new Date().toISOString(),
                    status: 'In Venue'
                }]);
                if (inErr) throw inErr;
                this.notify("TIME IN recorded", "success");
            } else if (existing && !existing.time_out) {
                // SECOND SCAN: Time Out
                const { error: outErr } = await supabase.from('attendance')
                    .update({ 
                        time_out: new Date().toISOString(),
                        status: 'Completed' 
                    })
                    .eq('id', existing.id);
                if (outErr) throw outErr;
                this.notify("TIME OUT recorded - Attendance Completed", "success");
            } else {
                this.notify("Attendance already completed for today", "info");
            }

            await this.fetchAttendance(this.state.activeEventId);
        } catch (err) {
            this.notify(err.message, "error");
        }
    },

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

    // --- CSV EXPORT ENGINE ---
    exportToCSV() {
        if (this.state.attendanceList.length === 0) return this.notify("No data to export", "error");
        
        const headers = ["Event", "Day", "Student Name", "ID", "Course/Year", "Time In", "Time Out", "Status"];
        const rows = this.state.attendanceList.map(row => [
            this.state.activeEventName,
            `Day ${row.event_day}`,
            row.profiles?.full_name || 'N/A',
            row.student_id,
            `${row.profiles?.course} ${row.profiles?.year_level}`,
            row.time_in ? new Date(row.time_in).toLocaleTimeString() : '-',
            row.time_out ? new Date(row.time_out).toLocaleTimeString() : '-',
            row.status
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${this.state.activeEventName}_Day${this.state.activeDay}_Attendance.csv`;
        link.click();
    },

    // --- UI RENDERING ---
    render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        container.innerHTML = `
            <div class="min-h-screen bg-[#f8fafc] p-6 md:p-10 font-sans text-slate-900">
                <div class="max-w-[1600px] mx-auto space-y-8">
                    
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div>
                            <h1 class="text-5xl font-black italic tracking-tighter uppercase leading-none">
                                Attendance<span class="text-blue-800 opacity-30">Scanner</span>
                            </h1>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Precision Tracking System</p>
                        </div>

                        <div class="flex flex-wrap gap-3">
                            <select id="day-selector" class="px-6 py-4 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none">
                                ${[1,2,3,4,5,6,7].map(d => `<option value="${d}" ${this.state.activeDay == d ? 'selected' : ''}>Day ${d}</option>`).join('')}
                            </select>
                            
                            <button id="btn-export" class="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-all">
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div class="lg:col-span-1 space-y-6">
                            <div class="bg-white p-8 rounded-[2.5rem] border-2 border-[#000080] shadow-2xl relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-full h-1 bg-[#000080] animate-pulse"></div>
                                <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-4">Focus Scanner Here</label>
                                <input type="text" id="scanner-input" autofocus placeholder="Waiting for scan..." 
                                    class="w-full p-6 bg-slate-50 rounded-2xl font-black text-center text-lg border-2 border-transparent focus:border-blue-500 outline-none transition-all uppercase">
                                <div class="mt-6 flex justify-center">
                                    <div class="w-20 h-20 border-4 border-dashed border-slate-100 rounded-2xl flex items-center justify-center">
                                        <div class="w-12 h-0.5 bg-red-500/30 animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div class="overflow-x-auto">
                                <table class="w-full text-left">
                                    <thead class="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400">Student Info</th>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400">Course & Year</th>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400">Event Name</th>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400">Time In</th>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400">Time Out</th>
                                            <th class="p-5 text-[9px] font-black uppercase text-slate-400 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="att-list" class="divide-y divide-slate-50">
                                        </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.initListeners();
    },

    renderList() {
        const list = document.getElementById('att-list');
        if (!list) return;

        list.innerHTML = this.state.attendanceList.map(entry => {
            const isCompleted = entry.status === 'Completed';
            return `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="p-5">
                        <div class="flex flex-col">
                            <span class="font-black text-xs uppercase text-slate-800">${entry.profiles?.full_name || 'Guest'}</span>
                            <span class="text-[9px] font-mono text-slate-400">${entry.student_id}</span>
                        </div>
                    </td>
                    <td class="p-5 text-[10px] font-black text-slate-500 uppercase">
                        ${entry.profiles?.course || ''} ${entry.profiles?.year_level || ''}
                    </td>
                    <td class="p-5 text-[10px] font-bold text-slate-400 uppercase">
                        ${entry.event_name}
                    </td>
                    <td class="p-5 text-[11px] font-black text-blue-900">
                        ${entry.time_in ? new Date(entry.time_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                    </td>
                    <td class="p-5 text-[11px] font-black text-blue-900">
                        ${entry.time_out ? new Date(entry.time_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                    </td>
                    <td class="p-5 text-center">
                        <span class="px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest 
                            ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'}">
                            ${entry.status}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    },

    initListeners() {
        const scanner = document.getElementById('scanner-input');
        const daySel = document.getElementById('day-selector');
        const exportBtn = document.getElementById('btn-export');

        if (scanner) {
            scanner.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    this.processScan(scanner.value.trim());
                    scanner.value = '';
                }
            };
        }

        if (daySel) {
            daySel.onchange = (e) => {
                this.state.activeDay = e.target.value;
                this.fetchAttendance(this.state.activeEventId);
            };
        }

        if (exportBtn) exportBtn.onclick = () => this.exportToCSV();
    },

    notify(msg, type) {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-[#000080]' : type === 'error' ? 'bg-red-600' : 'bg-blue-500';
        toast.className = `fixed bottom-10 right-10 px-8 py-4 rounded-full text-white font-black uppercase text-[10px] tracking-widest z-[7000] shadow-2xl animate-in slide-in-from-right-10 ${color}`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
};
