import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        attendanceList: [],
        isLoading: false,
    },

    // --- CORE LOGIC ---
    
    /**
     * Marks a student as present. 
     * Uses the consolidated logic: Inserts to 'attendance' table.
     */
    async markPresent(studentId, eventId) {
        if (!studentId || !eventId) return;
        this.state.isLoading = true;
        
        try {
            const { data, error } = await supabase
                .from('attendance')
                .insert([{ 
                    student_id: studentId, 
                    event_id: eventId, 
                    status: 'Present',
                    timestamp: new Date().toISOString() 
                }]);

            if (error) {
                // Error code 23505 is a unique constraint violation (already checked in)
                if (error.code === '23505') throw new Error("Student already recorded.");
                throw error;
            }

            this.notify("Verification Successful", "success");
            await this.fetchAttendance(eventId); // Refresh the UI list
        } catch (err) {
            this.notify(err.message, "error");
        } finally {
            this.state.isLoading = false;
        }
    },

    /**
     * Fetches the current attendance list for the specific event.
     */
    async fetchAttendance(eventId) {
        if (!eventId) return;
        this.state.activeEventId = eventId;
        
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                profiles:student_id (full_name, course, year_level)
            `)
            .eq('event_id', eventId)
            .order('timestamp', { ascending: false });

        if (!error) {
            this.state.attendanceList = data || [];
            this.renderList();
            this.updateStats();
        }
    },

    // --- UI RENDERING ---

    render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        container.innerHTML = `
            <div class="min-h-screen bg-[#f8fafc] p-6 md:p-10 space-y-10 font-sans text-slate-900">
                <style>
                    .text-stroke-navy { -webkit-text-stroke: 1px #000080; color: transparent; }
                    .attendance-card { background: white; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #000080; border-radius: 10px; }
                </style>

                <div class="max-w-[1400px] mx-auto space-y-8">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                        <div class="space-y-2">
                            <div class="flex items-center gap-3">
                                <span class="h-1 w-12 bg-[#000080] rounded-full"></span>
                                <p class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Registry System</p>
                            </div>
                            <h1 class="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
                                Attendance<span class="text-stroke-navy opacity-60">Log</span>
                            </h1>
                        </div>

                        <div class="flex p-2 bg-white rounded-[2rem] border border-slate-200 shadow-xl w-full lg:w-auto">
                            <input type="text" id="att-manual-input" placeholder="SCAN STUDENT ID..." 
                                class="flex-grow lg:w-80 px-6 py-4 bg-transparent font-black text-xs outline-none uppercase tracking-widest text-slate-700">
                            <button id="btn-manual-check" class="px-10 py-4 bg-[#000080] text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-900 transition-all active:scale-95">
                                Verify
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="attendance-card p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center">
                            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Present</span>
                            <div id="att-total-count" class="text-6xl font-black text-[#000080] mt-2">0</div>
                            <p class="text-[8px] font-bold text-slate-300 uppercase mt-4 tracking-tighter">Real-time counter active</p>
                        </div>

                        <div class="md:col-span-2 attendance-card rounded-[2.5rem] overflow-hidden">
                            <div id="attendance-table-container" class="max-h-[600px] overflow-y-auto custom-scrollbar">
                                </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initListeners();
    },

    renderList() {
        const container = document.getElementById('attendance-table-container');
        if (!container) return;

        if (this.state.attendanceList.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-80 space-y-4 opacity-20">
                    <p class="text-[10px] font-black uppercase tracking-[0.2em]">Waiting for first check-in...</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <table class="w-full text-left border-collapse">
                <thead class="sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr>
                        <th class="p-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Participant</th>
                        <th class="p-6 text-[9px] font-black uppercase text-slate-400 tracking-widest">Program Info</th>
                        <th class="p-6 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Check-in Time</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${this.state.attendanceList.map(entry => `
                        <tr class="hover:bg-blue-50/20 transition-colors group">
                            <td class="p-6">
                                <div class="flex flex-col">
                                    <span class="font-black text-xs uppercase text-slate-800">${entry.profiles?.full_name || 'Generic Student'}</span>
                                    <span class="text-[10px] font-mono text-slate-400 mt-0.5">${entry.student_id}</span>
                                </div>
                            </td>
                            <td class="p-6">
                                <span class="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase">
                                    ${entry.profiles?.course || 'Unset'} ${entry.profiles?.year_level || ''}
                                </span>
                            </td>
                            <td class="p-6 text-right">
                                <span class="font-bold text-[11px] text-[#000080]">
                                    ${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    // --- HELPERS & UTILS ---

    updateStats() {
        const counter = document.getElementById('att-total-count');
        if (counter) counter.innerText = this.state.attendanceList.length;
    },

    initListeners() {
        const btn = document.getElementById('btn-manual-check');
        const input = document.getElementById('att-manual-input');

        const handleVerify = () => {
            const id = input.value.trim();
            if (id && this.state.activeEventId) {
                this.markPresent(id, this.state.activeEventId);
                input.value = '';
                input.focus();
            }
        };

        if (btn) btn.onclick = handleVerify;
        if (input) {
            input.onkeydown = (e) => { if (e.key === 'Enter') handleVerify(); };
        }
    },

    notify(msg, type) {
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-[#000080]' : 'bg-red-600';
        toast.className = `fixed bottom-10 right-10 px-8 py-4 rounded-full text-white font-black uppercase text-[10px] tracking-widest z-[6000] shadow-2xl animate-in slide-in-from-right-10 ${color}`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};
