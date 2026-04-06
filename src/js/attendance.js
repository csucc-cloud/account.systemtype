import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        allEvents: [],
        attendees: [], 
        isScannerActive: false,
        currentCameraId: null,
        html5QrCode: null,
        attendanceSubscription: null,
        // Pagination State
        currentPage: 1,
        rowsPerPage: 20
    },

    // FIX #1: single shared AudioContext reused across all playSound calls
    _getAudioCtx() {
        if (!this._audioCtx || this._audioCtx.state === 'closed') {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this._audioCtx;
    },

    // --- AUDIO SYSTEM ---
    playSound(type) {
        const ctx = this._getAudioCtx();  // FIX #1: reuse instead of new each time
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'in') { // High beep for Time In
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'out') { // Double beep for Time Out
            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'error') { // Low buzz for Error
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        }
    },

    // FIX #2: HTML escape helper — prevents XSS from raw student data in innerHTML
    _escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    // FIX #9: unified toast notification — replaces all alert() calls
    notify(message, type = 'info') {
        if (typeof Swal !== 'undefined') {
            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            }).fire({ icon: type, title: message });
        } else {
            // fallback if Swal not loaded
            console.warn(`[${type.toUpperCase()}]`, message);
        }
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
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Pro-Optic Live Protocol v2.0
                                </p>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-center gap-3">
                            <select id="event-selector" class="appearance-none bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[11px] font-black uppercase tracking-wider text-slate-700 outline-none cursor-pointer min-w-[240px]">
                                <option value="">-- Select Active Event --</option>
                                ${this.state.allEvents.map(ev => `
                                    <option value="${ev.id}" ${this.state.activeEventId === ev.id ? 'selected' : ''}>${this._escapeHtml(ev.event_name)}</option>
                                `).join('')}
                            </select>

                            <select id="camera-source" class="${this.state.isScannerActive ? '' : 'hidden'} bg-white border border-slate-200 rounded-xl px-3 py-3.5 text-[10px] font-bold text-slate-500 uppercase outline-none">
                                <option value="environment">Rear Lens</option>
                                <option value="user">Selfie Lens</option>
                            </select>

                            <button id="btn-export-excel" class="px-6 py-3.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg hover:bg-emerald-700 transition-all">
                                <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
                                Export Excel
                            </button>

                            <button id="btn-toggle-scanner" class="px-8 py-3.5 ${this.state.isScannerActive ? 'bg-rose-500' : 'bg-[#000080]'} text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-lg">
                                <i data-lucide="${this.state.isScannerActive ? 'camera-off' : 'camera'}" class="w-4 h-4"></i>
                                ${this.state.isScannerActive ? 'Terminate Scanner' : 'Initialize Scanner'}
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
                                            <p class="text-[10px] font-black uppercase tracking-[0.3em]">Scanner Standby</p>
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
                                        <p id="fetch-status" class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                            ${this.state.isScannerActive ? 'Neural Link Active' : 'Waiting for Input'}
                                        </p>
                                    </div>
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
                                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Real-time DB Sync</p>
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
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Name</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Course & Year</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Time In</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Time Out</th>
                                            <th class="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="attendance-feed" class="divide-y divide-slate-50"></tbody>
                                </table>
                            </div>
                            <div id="pagination-controls" class="p-6 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
                                <p id="pagination-info" class="text-[10px] font-black text-slate-400 uppercase tracking-widest"></p>
                                <div class="flex gap-2">
                                    <button id="prev-page" class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30">
                                        <i data-lucide="chevron-left" class="w-4 h-4 text-slate-600"></i>
                                    </button>
                                    <button id="next-page" class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30">
                                        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-600"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes scan { 0% { top: 0%; opacity: 0; } 50% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                #reader video { object-fit: cover !important; width: 100% !important; height: 100% !important; border-radius: 2.5rem; }
                .highlight-row { background-color: #f0fdf4 !important; transition: background-color 2s ease; }
            </style>
        `;

        this.initEventListeners();
        if (this.state.activeEventId) {
            await this.fetchAttendance();
            this.setupRealtimeListener();
        }
        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        const toggleBtn = document.getElementById('btn-toggle-scanner');
        if (toggleBtn) {
            toggleBtn.onclick = async () => {
                if (!this.state.activeEventId) {
                    // FIX #9: replaced alert() with notify()
                    return this.notify('Select an active event first!', 'warning');
                }
                if (this.state.isScannerActive) {
                    await this.stopScanner();
                    this.state.isScannerActive = false;
                    this.render();
                } else {
                    this.state.isScannerActive = true;
                    await this.render();
                    this.startScanner(); 
                }
            };
        }

        const cameraSelect = document.getElementById('camera-source');
        if (cameraSelect) {
            cameraSelect.onchange = async () => {
                if (this.state.isScannerActive) {
                    await this.stopScanner();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.startScanner();
                }
            };
        }

        document.getElementById('btn-export-excel').onclick = () => this.exportToExcel();

        document.getElementById('event-selector').onchange = (e) => {
            this.state.activeEventId = e.target.value;
            this.state.currentPage = 1;
            this.fetchAttendance();
            this.setupRealtimeListener();
        };

        const manualInput = document.getElementById('manual-student-id');
        const manualSubmit = document.getElementById('btn-manual-submit');

        manualSubmit.onclick = () => {
            const idVal = manualInput.value.trim();
            if (idVal) {
                this.markAttendance(idVal);
                manualInput.value = '';
            }
        };

        // FIX #7: Enter key submits the manual ID input
        manualInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const idVal = manualInput.value.trim();
                if (idVal) {
                    this.markAttendance(idVal);
                    manualInput.value = '';
                }
            }
        });

        document.getElementById('prev-page').onclick = () => {
            if (this.state.currentPage > 1) {
                this.state.currentPage--;
                this.renderFeed();
            }
        };

        document.getElementById('next-page').onclick = () => {
            const totalPages = Math.ceil(this.state.attendees.length / this.state.rowsPerPage);
            if (this.state.currentPage < totalPages) {
                this.state.currentPage++;
                this.renderFeed();
            }
        };
    },

    setupRealtimeListener() {
        if (this.state.attendanceSubscription) supabase.removeChannel(this.state.attendanceSubscription);
        if (!this.state.activeEventId) return;

        // FIX #13: unique channel name per event + timestamp prevents cross-tab conflicts
        this.state.attendanceSubscription = supabase
            .channel(`attendance_sync_${this.state.activeEventId}_${Date.now()}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'attendance',
                filter: `event_id=eq.${this.state.activeEventId}` 
            }, (payload) => {
                this.handleRealtimeUpdate(payload);
            })
            .subscribe();
    },

    handleRealtimeUpdate(payload) {
        const { new: newRecord, eventType } = payload;
        const studentIndex = this.state.attendees.findIndex(a => a.student_id.toString() === newRecord.student_id.toString());
        
        if (studentIndex !== -1) {
            // UPDATE existing local record
            this.state.attendees[studentIndex].time_in = newRecord.time_in;
            this.state.attendees[studentIndex].time_out = newRecord.time_out;
            this.state.attendees[studentIndex].is_present = true;
            this.renderFeed();
        } else {
            // FIX #3: INSERT event for a student not yet in local state — re-fetch to stay in sync
            this.fetchAttendance();
        }
    },

    async fetchEventsForDropdown() {
        // FIX #11: fetch only the current org's events, matching events.js role-aware behaviour
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
                .from('profiles').select('role, organization_id')
                .eq('id', user?.id).single();

            let query = supabase.from('events').select('id, event_name').order('created_at', { ascending: false });
            if (profile?.role !== 'super_admin') {
                query = query.eq('organization_id', profile?.organization_id);
            }

            const { data } = await query;
            this.state.allEvents = data || [];
        } catch (e) {
            console.error('fetchEventsForDropdown failed', e);
            this.state.allEvents = [];
        }
    },

    async fetchAttendance() {
        if (!this.state.activeEventId) return;

        // FIX #10: show loading skeleton in the table while fetching
        const feed = document.getElementById('attendance-feed');
        if (feed) {
            feed.innerHTML = `<tr><td colspan="6" class="p-16 text-center text-slate-300 uppercase font-black italic text-[11px] tracking-widest">
                <span class="animate-pulse">Loading Records...</span>
            </td></tr>`;
        }

        // FIX #14: wrap all fetches in try/catch with user-facing error feedback
        try {
            // 1. Get the Event details
            const { data: event, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', this.state.activeEventId)
                .single();

            if (eventError) throw eventError;
            
            // 2. Build the Student Query
            let query = supabase.from('students').select('*').order('full_name', { ascending: true });

            // Check Department Filter: Only apply if it's NOT 'All', 'NULL', or empty
            if (event?.target_dept && !['All', 'all', 'NULL', 'All Dept', ''].includes(event.target_dept)) {
                query = query.ilike('department', `%${event.target_dept}%`);
            }

            // Check Year Filter: Only apply if it's NOT 'All', 'All Year', etc.
            if (event?.target_year && !['All', 'All Year', 'NULL', '0', ''].includes(event.target_year.toString())) {
                query = query.eq('year_level', parseInt(event.target_year));
            }

            const students = await this.fetchAllStudents(query);
            
            // 3. Fetch Attendance Logs for this event
            let allLogs = [];
            let logStart = 0;
            let moreLogs = true;
            while (moreLogs) {
                const { data: logs, error: logError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('event_id', this.state.activeEventId)
                    .range(logStart, logStart + 999);

                if (logError) throw logError;
                if (!logs || logs.length === 0) break;
                allLogs = [...allLogs, ...logs];
                if (logs.length < 1000) moreLogs = false;
                else logStart += 1000;
            }

            // 4. Map logs to students
            this.state.attendees = (students || []).map(s => {
                const log = allLogs.find(l => l.student_id.toString() === s.student_id.toString());
                return { 
                    ...s, 
                    time_in: log?.time_in, 
                    time_out: log?.time_out, 
                    is_present: !!log 
                };
            });

            const statusEl = document.getElementById('fetch-status');
            if (statusEl && !this.state.isScannerActive) {
                statusEl.innerText = `Verified ${this.state.attendees.length} Records`;
            }

            this.renderFeed();

        } catch (error) {
            console.error('fetchAttendance error:', error);
            this.notify('Failed to load attendance records.', 'error');
            if (feed) {
                feed.innerHTML = `<tr><td colspan="6" class="p-16 text-center text-red-300 uppercase font-black italic text-[11px] tracking-widest">Failed to Load Records</td></tr>`;
            }
        }
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

    renderFeed() {
        const feed = document.getElementById('attendance-feed');
        const count = document.getElementById('attendee-count');
        const infoEl = document.getElementById('pagination-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (!feed || !count) return;

        const present = this.state.attendees.filter(a => a.is_present).length;
        count.innerText = `${present.toString().padStart(2, '0')}/${this.state.attendees.length.toString().padStart(2, '0')}`;
        
        if (this.state.attendees.length === 0) {
            feed.innerHTML = `<tr><td colspan="6" class="p-32 text-center text-slate-300 uppercase font-black italic">No Target Match</td></tr>`;
            infoEl.innerText = "Showing 0 of 0";
            return;
        }

        const totalItems = this.state.attendees.length;
        const totalPages = Math.ceil(totalItems / this.state.rowsPerPage);
        const startIdx = (this.state.currentPage - 1) * this.state.rowsPerPage;
        const endIdx = startIdx + this.state.rowsPerPage;
        const paginatedData = this.state.attendees.slice(startIdx, endIdx);

        infoEl.innerText = `Showing ${startIdx + 1} to ${Math.min(endIdx, totalItems)} of ${totalItems}`;
        prevBtn.disabled = this.state.currentPage === 1;
        nextBtn.disabled = this.state.currentPage === totalPages || totalPages === 0;

        feed.innerHTML = paginatedData.map(row => {
            let statusHTML = '';
            if (row.time_in && !row.time_out) {
                statusHTML = `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest ring-1 ring-amber-100"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> In Venue</span>`;
            } else if (row.time_in && row.time_out) {
                statusHTML = `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest ring-1 ring-emerald-100">Present</span>`;
            } else {
                statusHTML = `<span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest ring-1 ring-slate-200">Pending</span>`;
            }

            // FIX #2: all student fields escaped to prevent XSS
            return `
                <tr class="hover:bg-slate-50 transition-all ${!row.time_in ? 'opacity-60' : ''}">
                    <td class="px-8 py-6 font-black text-slate-500 text-[11px]">${this._escapeHtml(String(row.student_id))}</td>
                    <td class="px-8 py-6 font-black text-slate-800">${this._escapeHtml(row.full_name)}</td>
                    <td class="px-8 py-6 text-[10px] font-bold text-slate-700">${this._escapeHtml(row.course || row.department)}<br><span class="text-slate-400">Year ${this._escapeHtml(String(row.year_level))}</span></td>
                    <td class="px-8 py-6 text-[11px] font-black text-slate-400">${row.time_in ? new Date(row.time_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                    <td class="px-8 py-6 text-[11px] font-black text-slate-400">${row.time_out ? new Date(row.time_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</td>
                    <td class="px-8 py-6 text-right">${statusHTML}</td>
                </tr>
            `;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    },

    async markAttendance(studentId) {
        if (!this.state.activeEventId) return;

        // FIX #8: scan lock — prevents duplicate upserts from rapid/repeated scans
        if (this._markLock) return;
        this._markLock = true;
        setTimeout(() => { this._markLock = false; }, 1500);

        const studentIndex = this.state.attendees.findIndex(a => a.student_id.toString() === studentId.toString());
        
        if (studentIndex === -1) {
            this.playSound('error');
            // FIX #9: replaced alert() with notify()
            this.notify(`Access Denied: ID ${studentId} not in target list.`, 'error');
            return;
        }

        const student = this.state.attendees[studentIndex];
        let updateData = { student_id: studentId, event_id: this.state.activeEventId };

        if (!student.time_in) {
            updateData.time_in = new Date().toISOString();
            this.playSound('in');
        } else if (student.time_in && !student.time_out) {
            updateData.time_out = new Date().toISOString();
            this.playSound('out');
        } else {
            this.playSound('error');
            // FIX #9: replaced alert() with notify()
            this.notify('Student already completed attendance.', 'warning');
            return;
        }

        const { error } = await supabase.from('attendance').upsert(updateData, { onConflict: 'student_id, event_id' });

        if (error) {
            console.error("DB Error:", error);
            this.notify('Failed to record attendance. Please try again.', 'error');
        } else {
            const pageOfStudent = Math.floor(studentIndex / this.state.rowsPerPage) + 1;
            this.state.currentPage = pageOfStudent;
            await this.fetchAttendance();
        }
    },

    async startScanner() {
        const cameraFacing = document.getElementById('camera-source')?.value || "environment";
        if (!this.state.html5QrCode) this.state.html5QrCode = new Html5Qrcode("reader");
        try {
            await this.state.html5QrCode.start(
                { facingMode: cameraFacing },
                { fps: 20, qrbox: { width: 280, height: 280 }, videoConstraints: { facingMode: cameraFacing, focusMode: "continuous" } },
                (text) => {
                    this.markAttendance(text);
                    if (navigator.vibrate) navigator.vibrate(100);
                }
            );
        } catch (err) {
            console.error("Scanner Error:", err);
            this.state.isScannerActive = false;
            this.render();
        }
    },

    async stopScanner() {
        if (this.state.html5QrCode) {
            try { await this.state.html5QrCode.stop(); } catch (e) { console.warn(e); }
            // FIX #5: null out after stop so startScanner() creates a fresh instance next time
            this.state.html5QrCode = null;
        }
    },

    exportToExcel() {
        if (this.state.attendees.length === 0) {
            // FIX #9: replaced alert() with notify()
            return this.notify('No data to export.', 'warning');
        }
        // FIX #6: use === (strict equality) for ID comparison
        const eventName = this.state.allEvents.find(e => e.id === this.state.activeEventId)?.event_name || "Event";
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
        XLSX.writeFile(workbook, `${eventName}_Attendance_${new Date().toLocaleDateString()}.xlsx`);
    }
};
