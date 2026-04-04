import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        allEvents: [],
        attendees: [], // Contains merged data: Students (Expected) + Attendance (Verified)
        isScannerActive: false,
        currentCameraId: null,
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
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Validation Protocol
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-center gap-3">
                            <div class="relative">
                                <select id="event-selector" class="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none cursor-pointer min-w-[240px] transition-all">
                                    <option value="">-- Select Active Event --</option>
                                    ${this.state.allEvents.map(ev => `
                                        <option value="${ev.id}" ${this.state.activeEventId === ev.id ? 'selected' : ''}>${ev.event_name}</option>
                                    `).join('')}
                                </select>
                            </div>

                            <select id="camera-source" class="${this.state.isScannerActive ? '' : 'hidden'} bg-white border border-slate-200 rounded-xl px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest outline-none">
                                <option value="environment">Rear Lens</option>
                                <option value="user">Selfie Lens</option>
                            </select>

                            <button id="btn-toggle-scanner" class="px-8 py-3.5 ${this.state.isScannerActive ? 'bg-rose-500 shadow-rose-200' : 'bg-[#000080] shadow-blue-200'} text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg">
                                <i data-lucide="${this.state.isScannerActive ? 'camera-off' : 'camera'}" class="w-4 h-4"></i>
                                ${this.state.isScannerActive ? 'Terminate Scanner' : 'Initialize Scanner'}
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        <div class="lg:col-span-4 space-y-8">
                            <div class="bg-white p-2 rounded-[3rem] border border-slate-200 shadow-xl group overflow-hidden">
                                <div id="reader" class="w-full aspect-square bg-slate-950 rounded-[2.5rem] overflow-hidden relative border-[8px] border-slate-50 shadow-inner">
                                    ${!this.state.isScannerActive ? `
                                        <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                                            <div class="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-2">
                                                <i data-lucide="video-off" class="w-8 h-8 text-slate-700"></i>
                                            </div>
                                            <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Scanner Standby</p>
                                        </div>
                                    ` : `
                                        <div class="absolute inset-0 z-10 pointer-events-none border-[40px] border-black/10">
                                            <div class="w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(59,130,246,1)] absolute top-0 animate-[scan_2.5s_ease-in-out_infinite]"></div>
                                        </div>
                                    `}
                                </div>
                                <div class="p-6 text-center">
                                    <div class="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-slate-50 border border-slate-100">
                                        <span class="relative flex h-2 w-2">
                                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${this.state.isScannerActive ? 'bg-emerald-400' : 'bg-slate-300'} opacity-75"></span>
                                            <span class="relative inline-flex rounded-full h-2 w-2 ${this.state.isScannerActive ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
                                        </span>
                                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                            ${this.state.isScannerActive ? 'Neural Link Active' : 'Waiting for Input'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-[#000080] p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/30 text-white relative overflow-hidden">
                                <div class="relative z-10">
                                    <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300/60 mb-6">Manual Override</h3>
                                    <div class="flex gap-3">
                                        <input type="text" id="manual-student-id" placeholder="STUDENT ID NUMBER" class="flex-1 bg-white/10 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-white/30 focus:bg-white/20 outline-none transition-all uppercase">
                                        <button id="btn-manual-submit" class="bg-yellow-400 px-6 rounded-2xl hover:bg-yellow-300 transition-all hover:rotate-12 active:scale-90 shadow-lg shadow-yellow-400/20">
                                            <i data-lucide="send" class="w-5 h-5 text-[#000080]"></i>
                                        </button>
                                    </div>
                                </div>
                                <i data-lucide="database" class="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 -rotate-12"></i>
                            </div>
                        </div>

                        <div class="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[700px]">
                            <div class="p-10 border-b border-slate-50 flex justify-between items-end">
                                <div>
                                    <div class="flex items-center gap-3 mb-1">
                                        <i data-lucide="users" class="w-5 h-5 text-[#000080]"></i>
                                        <h2 class="text-lg font-black text-slate-900 uppercase tracking-tight">Participant Stream</h2>
                                    </div>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time verification log</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Verified / Expected</p>
                                    <span id="attendee-count" class="text-5xl font-black italic text-[#000080] tracking-tighter">00/00</span>
                                </div>
                            </div>
                            
                            <div class="flex-1 overflow-x-auto">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-slate-50/50">
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ID</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Name</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Course & Year</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Time In</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Time Out</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Status</th>
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
                @keyframes scan { 
                    0% { top: 0%; opacity: 0; } 
                    50% { opacity: 1; }
                    100% { top: 100%; opacity: 0; } 
                } 
                #event-selector { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1em; }
            </style>
        `;

        this.initEventListeners();
        if (this.state.activeEventId) this.fetchAttendance();
        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        document.getElementById('btn-toggle-scanner').onclick = () => {
            if (!this.state.activeEventId) return alert("CRITICAL: Please select an active event first!");
            this.state.isScannerActive = !this.state.isScannerActive;
            if (this.state.isScannerActive) { this.startScanner(); } else { this.stopScanner(); }
            this.render();
        };

        document.getElementById('event-selector').onchange = (e) => {
            this.state.activeEventId = e.target.value;
            this.fetchAttendance();
        };

        document.getElementById('btn-manual-submit').onclick = () => {
            const id = document.getElementById('manual-student-id').value;
            if (id) this.markAttendance(id);
        };
    },

    startScanner() {
        const cameraFacing = document.getElementById('camera-source')?.value || "environment";
        console.log(`System: Engaging camera optic [${cameraFacing}]`);
    },

    stopScanner() {
        console.log("System: Disengaging camera optic...");
    },

    async fetchEventsForDropdown() {
        const { data } = await supabase.from('events').select('id, event_name').order('created_at', { ascending: false });
        this.state.allEvents = data || [];
    },

    async fetchAttendance() {
        if (!this.state.activeEventId) return;

        // 1. Fetch Event target details
        const { data: event } = await supabase
            .from('events')
            .select('target_dept, target_year')
            .eq('id', this.state.activeEventId)
            .single();

        // 2. Fetch Students based on target
        let studentQuery = supabase.from('students').select('student_id, full_name, department, year_level, course');
        
        if (event?.target_dept && event.target_dept !== 'All' && event.target_dept !== 'NULL') {
            studentQuery = studentQuery.eq('department', event.target_dept);
        }
        if (event?.target_year && !['All', 'All Year', 'NULL'].includes(event.target_year)) {
            studentQuery = studentQuery.eq('year_level', parseInt(event.target_year));
        }

        const { data: expectedStudents } = await studentQuery;

        // 3. Fetch Actual Attendance Logs
        const { data: logs } = await supabase
            .from('attendance')
            .select('*')
            .eq('event_id', this.state.activeEventId);

        // 4. Merge Data
        this.state.attendees = (expectedStudents || []).map(student => {
            const scan = (logs || []).find(l => l.student_id === student.student_id);
            return {
                ...student,
                time_in: scan ? scan.time_in : null,
                time_out: scan ? scan.time_out : null,
                is_present: !!scan
            };
        });

        this.renderFeed();
    },

    renderFeed() {
        const feed = document.getElementById('attendance-feed');
        const count = document.getElementById('attendee-count');
        if (!feed) return;

        const presentCount = this.state.attendees.filter(a => a.is_present).length;
        count.innerText = `${presentCount.toString().padStart(2, '0')}/${this.state.attendees.length.toString().padStart(2, '0')}`;
        
        if (this.state.attendees.length === 0) {
            feed.innerHTML = `<tr><td colspan="6" class="p-32 text-center text-[11px] text-slate-300 uppercase font-black tracking-[0.4em] opacity-50 italic">Buffer Empty: No Students Match Target</td></tr>`;
            return;
        }

        // Sort: Present ones first
        const sorted = [...this.state.attendees].sort((a, b) => b.is_present - a.is_present);

        feed.innerHTML = sorted.map(row => `
            <tr class="hover:bg-slate-50/80 transition-all group ${!row.is_present ? 'opacity-60 bg-slate-50/30' : ''}">
                <td class="px-8 py-7 font-black text-slate-500 text-[11px] uppercase tracking-tighter">${row.student_id}</td>
                <td class="px-8 py-7 font-black text-slate-800 tracking-tight group-hover:text-[#000080] transition-colors">${row.full_name}</td>
                <td class="px-8 py-7 text-[10px] font-bold text-slate-400 uppercase">
                    <div class="text-slate-700 font-black">${row.course || row.department}</div>
                    <div>Year ${row.year_level}</div>
                </td>
                <td class="px-8 py-7 text-[11px] font-black text-slate-400 uppercase tabular-nums">
                    ${row.time_in ? new Date(row.time_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                </td>
                <td class="px-8 py-7 text-[11px] font-black text-slate-400 uppercase tabular-nums">
                    ${row.time_out ? new Date(row.time_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                </td>
                <td class="px-8 py-7 text-right">
                    ${row.is_present 
                        ? `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest ring-1 ring-emerald-100">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Present
                           </span>`
                        : `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest ring-1 ring-slate-200">
                            Pending
                           </span>`
                    }
                </td>
            </tr>
        `).join('');
    }
};
