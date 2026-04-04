import { supabase } from './auth.js';

export const attendanceModule = {
    state: {
        activeEventId: null,
        allEvents: [],
        attendees: [],
        isScannerActive: false,
        currentCameraId: null, // Tracks if we are using front or back
    },
    
    async render() {
        const container = document.getElementById('mod-attendance');
        if (!container) return;

        if (this.state.allEvents.length === 0) await this.fetchEventsForDropdown();

        container.innerHTML = `
            <div class="p-4 md:p-8 min-h-screen bg-[#f8fafc]">
                <div class="max-w-[1600px] mx-auto space-y-6">
                    
                    <div class="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-5">
                            <div class="w-12 h-12 bg-[#000080] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                                <i data-lucide="qr-code" class="w-6 h-6"></i>
                            </div>
                            <div>
                                <h1 class="text-xl font-bold text-slate-800 tracking-tight">Attendance System</h1>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Event-Based Participant Validation</p>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <select id="event-selector" class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-[#000080] cursor-pointer min-w-[200px]">
                                <option value="">-- Choose Event --</option>
                                ${this.state.allEvents.map(ev => `
                                    <option value="${ev.id}" ${this.state.activeEventId === ev.id ? 'selected' : ''}>${ev.event_name}</option>
                                `).join('')}
                            </select>

                            <select id="camera-source" class="${this.state.isScannerActive ? '' : 'hidden'} bg-slate-50 border border-slate-200 rounded-lg px-2 py-2.5 text-[10px] font-bold text-slate-500">
                                <option value="environment">Back Camera</option>
                                <option value="user">Front Camera</option>
                            </select>

                            <button id="btn-toggle-scanner" class="px-6 py-2.5 ${this.state.isScannerActive ? 'bg-rose-500' : 'bg-emerald-600'} text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md">
                                <i data-lucide="${this.state.isScannerActive ? 'camera-off' : 'camera'}" class="w-4 h-4"></i>
                                ${this.state.isScannerActive ? 'Close Scanner' : 'Open Scanner'}
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        <div class="lg:col-span-4 space-y-6">
                            <div class="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <div id="reader" class="w-full aspect-square bg-slate-900 rounded-[2rem] overflow-hidden relative border-[6px] border-slate-100 shadow-inner">
                                    ${!this.state.isScannerActive ? `
                                        <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3">
                                            <i data-lucide="video-off" class="w-12 h-12 opacity-20"></i>
                                            <p class="text-[10px] font-bold uppercase tracking-widest opacity-40">Scanner Offline</p>
                                        </div>
                                    ` : `
                                        <div class="absolute inset-0 z-10 pointer-events-none border-[30px] border-black/20">
                                            <div class="w-full h-0.5 bg-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.8)] absolute top-0 animate-[scan_2s_linear_infinite]"></div>
                                        </div>
                                    `}
                                </div>
                                <div class="mt-6 text-center">
                                    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                                        <span class="w-2 h-2 rounded-full ${this.state.isScannerActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}"></span>
                                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                            ${this.state.isScannerActive ? 'System Live' : 'Scanner Ready'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Manual Entry</h3>
                                <div class="flex gap-2">
                                    <input type="text" id="manual-student-id" placeholder="Enter Student ID..." class="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm font-bold">
                                    <button id="btn-manual-submit" class="bg-yellow-400 px-5 rounded-xl hover:scale-105 transition-transform">
                                        <i data-lucide="arrow-right" class="w-5 h-5 text-black"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                            <div class="p-8 border-b border-slate-50 flex justify-between items-center">
                                <div class="flex items-center gap-3">
                                    <i data-lucide="users" class="w-5 h-5 text-[#000080]"></i>
                                    <h2 class="text-sm font-bold text-slate-800 tracking-tight">Participant Monitor</h2>
                                </div>
                                <span id="attendee-count" class="text-xl font-black italic text-[#000080]">00</span>
                            </div>
                            <div class="flex-1 overflow-x-auto">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="bg-slate-50/50">
                                            <th class="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Student ID</th>
                                            <th class="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Time In</th>
                                            <th class="px-8 py-5 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody id="attendance-feed" class="divide-y divide-slate-50"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style> @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } } </style>
        `;

        this.initEventListeners();
        if (this.state.activeEventId) this.fetchAttendance();
        if (window.lucide) window.lucide.createIcons();
    },

    initEventListeners() {
        // Toggle Scanner Action
        document.getElementById('btn-toggle-scanner').onclick = () => {
            if (!this.state.activeEventId) return alert("Please select an event first!");
            
            this.state.isScannerActive = !this.state.isScannerActive;
            
            if (this.state.isScannerActive) {
                this.startScanner();
            } else {
                this.stopScanner();
            }
            this.render(); // Re-render to update button text/color and icons
        };

        // Event Selector
        document.getElementById('event-selector').onchange = (e) => {
            this.state.activeEventId = e.target.value;
            this.fetchAttendance();
        };

        // Manual Submit
        document.getElementById('btn-manual-submit').onclick = () => {
            const id = document.getElementById('manual-student-id').value;
            if (id) this.markAttendance(id);
        };
    },

    startScanner() {
        const cameraFacing = document.getElementById('camera-source')?.value || "environment";
        console.log(`Starting camera: ${cameraFacing}`);
        
        // This is where you initialize Html5Qrcode
        // Example: html5QrCode.start({ facingMode: cameraFacing }, config, onScanSuccess);
    },

    stopScanner() {
        console.log("Stopping camera...");
        // Example: html5QrCode.stop();
    },

    async fetchEventsForDropdown() {
        const { data } = await supabase.from('events').select('id, event_name').order('created_at', { ascending: false });
        this.state.allEvents = data || [];
    },

    async fetchAttendance() {
        if (!this.state.activeEventId) return;
        const { data } = await supabase.from('attendance').select('*').eq('event_id', this.state.activeEventId).order('time_in', { ascending: false });
        this.state.attendees = data || [];
        this.renderFeed();
    },

    renderFeed() {
        const feed = document.getElementById('attendance-feed');
        const count = document.getElementById('attendee-count');
        if (!feed) return;
        count.innerText = this.state.attendees.length.toString().padStart(2, '0');
        
        if (this.state.attendees.length === 0) {
            feed.innerHTML = `<tr><td colspan="3" class="p-20 text-center text-[10px] text-slate-300 uppercase font-bold italic">No participants for this event yet.</td></tr>`;
            return;
        }

        feed.innerHTML = this.state.attendees.map(row => `
            <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="px-8 py-5 font-bold text-slate-700">${row.student_id}</td>
                <td class="px-8 py-5 text-[10px] font-bold text-slate-400">${new Date(row.time_in).toLocaleTimeString()}</td>
                <td class="px-8 py-5"><span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase">Verified</span></td>
            </tr>
        `).join('');
    }
};
