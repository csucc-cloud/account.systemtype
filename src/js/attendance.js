import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        activeEventName: 'UNASSIGNED',
        attendees: [],
        lastScanned: null,
        isScannerActive: false
    },
    
    async render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        // Base Layout: Left Column (Scanner) | Right Column (Table)
        container.innerHTML = `
            <div class="p-6 md:p-8 min-h-screen bg-[#fcfcfc]">
                <div class="max-w-[1600px] mx-auto space-y-6">
                    
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                        <div class="flex items-center gap-6">
                            <div class="w-14 h-14 bg-[#000080] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                                <i data-lucide="scan-line" class="w-7 h-7"></i>
                            </div>
                            <div>
                                <h1 class="text-2xl font-black italic tracking-tighter uppercase text-slate-800">Attendance <span class="text-[#000080]">Monitor</span></h1>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> System Active • ${this.state.activeEventName}
                                </p>
                            </div>
                        </div>
                        <button id="close-attendance" class="px-6 py-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2">
                            <i data-lucide="log-out" class="w-4 h-4"></i> Close Session
                        </button>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        <div class="lg:col-span-4 space-y-6">
                            
                            <div class="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl overflow-hidden relative border-8 border-slate-800">
                                <div id="reader" class="w-full aspect-square rounded-[1.8rem] overflow-hidden bg-black relative">
                                    <div class="absolute inset-0 pointer-events-none z-10 border-[20px] border-black/40">
                                        <div class="w-full h-1 bg-blue-500/50 shadow-[0_0_15px_blue] absolute top-0 animate-[scan_2s_linear_infinite]"></div>
                                    </div>
                                </div>
                                <div class="p-6 text-center">
                                    <div id="scan-status-pill" class="inline-block px-4 py-1 rounded-full bg-slate-800 text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">
                                        Waiting for Scan...
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-4">
                                <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-400">Manual Entry</h3>
                                <div class="flex gap-2">
                                    <input type="text" id="manual-student-id" placeholder="STUDENT ID" class="flex-1 bg-slate-50 border-none rounded-xl px-4 py-4 text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-[#000080]">
                                    <button id="btn-manual-submit" class="bg-yellow-400 p-4 rounded-xl hover:scale-105 transition-transform">
                                        <i data-lucide="send" class="w-5 h-5 text-black"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="lg:col-span-8">
                            <div class="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                <div class="p-8 border-b border-slate-50 flex justify-between items-center">
                                    <div class="flex items-center gap-3">
                                        <i data-lucide="users" class="w-5 h-5 text-[#000080]"></i>
                                        <span class="text-[11px] font-black uppercase tracking-widest text-slate-800">Verified Personnel</span>
                                    </div>
                                    <div class="flex gap-4 items-center">
                                        <span id="attendee-count" class="text-2xl font-black italic text-[#000080]">00</span>
                                        <button id="export-csv" class="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                            <i data-lucide="download" class="w-4 h-4 text-slate-400"></i>
                                        </button>
                                    </div>
                                </div>

                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-slate-50/50">
                                                <th class="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Student ID</th>
                                                <th class="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Time In</th>
                                                <th class="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                                <th class="px-8 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="attendance-feed" class="divide-y divide-slate-50">
                                            </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes scan {
                    0% { top: 0%; }
                    100% { top: 100%; }
                }
            </style>
        `;

        if (this.state.activeEventId) {
            this.fetchAttendance();
            this.initScanner();
        }
        
        this.initEventListeners();
        if (window.lucide) window.lucide.createIcons();
    },

    async fetchAttendance() {
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('event_id', this.state.activeEventId)
            .order('time_in', { ascending: false });

        if (!error) {
            this.state.attendees = data || [];
            this.renderFeed();
        }
    },

    renderFeed() {
        const feed = document.getElementById('attendance-feed');
        const count = document.getElementById('attendee-count');
        if (!feed) return;

        count.innerText = this.state.attendees.length.toString().padStart(2, '0');

        feed.innerHTML = this.state.attendees.map(row => `
            <tr class="hover:bg-slate-50/50 transition-colors group">
                <td class="px-8 py-5">
                    <span class="text-sm font-black text-slate-700">${row.student_id}</span>
                </td>
                <td class="px-8 py-5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">${new Date(row.time_in).toLocaleTimeString()}</span>
                </td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest">
                        ${row.status || 'Verified'}
                    </span>
                </td>
                <td class="px-8 py-5 text-right">
                    <button onclick="attendanceModule.deleteEntry('${row.id}')" class="opacity-0 group-hover:opacity-100 p-2 text-rose-400 hover:text-rose-600 transition-all">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        document.getElementById('close-attendance').onclick = () => {
            document.getElementById('mod-attendance').classList.add('hidden');
            document.getElementById('mod-events').classList.remove('hidden');
        };

        document.getElementById('btn-manual-submit').onclick = () => {
            const id = document.getElementById('manual-student-id').value;
            if (id) this.markAttendance(id);
        };
    },

    async markAttendance(studentId) {
        // Implementation for Supabase Insertion based on your Table Editor screenshot
        try {
            const { error } = await supabase.from('attendance').insert([{
                event_id: this.state.activeEventId,
                student_id: studentId,
                time_in: new Date().toISOString(),
                status: 'present'
            }]);

            if (error) throw error;
            
            // Visual feedback
            this.fetchAttendance();
            document.getElementById('manual-student-id').value = '';
        } catch (err) {
            alert("Entry Failed: " + err.message);
        }
    }
};
