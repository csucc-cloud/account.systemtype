import { supabase } from './auth.js';

export const dashboardModule = {
    render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div id="dashboard-view" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    <div class="lg:col-span-4 bg-gradient-to-br from-[#000080] to-[#000050] text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden group">
                        <div class="relative z-10 flex flex-col h-full justify-between">
                            <div class="flex items-start gap-5">
                                <div class="relative w-20 h-20 flex-shrink-0">
                                    <div class="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse"></div>
                                    <img src="./assets/img/5646.png" 
     alt="Lead Architect" 
     class="relative z-10 w-full h-full rounded-full object-cover border-4 border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                                    <div class="absolute -bottom-1 -right-1 z-20 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#000080]">
                                        <i data-lucide="shield-check" class="w-3 h-3 text-white"></i>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2 mb-2">
                                        <span class="px-2 py-1 bg-blue-400/20 rounded text-[10px] font-black uppercase tracking-widest border border-blue-400/30">Lead Architect</span>
                                    </div>
                                    <h4 class="text-2xl font-black tracking-tight mb-1">Davie P. Sialongo</h4>
                                    <p class="text-blue-200/70 text-xs font-medium italic">Full-Stack Developer • CITTE Student</p>
                                </div>
                            </div>
                            
                            <div class="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                                <div class="flex -space-x-2">
                                    <div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-[#000080] flex items-center justify-center"><i data-lucide="code-2" class="w-4 h-4"></i></div>
                                    <div class="w-8 h-8 rounded-full bg-indigo-500 border-2 border-[#000080] flex items-center justify-center"><i data-lucide="terminal" class="w-4 h-4"></i></div>
                                </div>
                                <span class="text-[10px] font-bold opacity-50 uppercase">Established 2024</span>
                            </div>
                        </div>
                        <i data-lucide="cpu" class="absolute -bottom-6 -right-6 w-40 h-40 text-white/5 transform group-hover:rotate-12 transition-transform duration-700"></i>
                    </div>

                    <div class="lg:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div>
                            <h4 class="text-slate-900 font-black text-lg mb-3 flex items-center gap-2">
                                <span class="w-2 h-6 bg-[#000080] rounded-full"></span>
                                OAS Portal v2.1
                            </h4>
                            <p class="text-slate-500 text-sm leading-relaxed">
                                The **Official Automation System** was engineered to eliminate manual paperwork for the LSG. It provides real-time analytics, automated attendance tracking, and centralized student records to ensure transparency and digital-first governance.
                            </p>
                        </div>
                        <div class="flex items-center gap-4 mt-6">
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-blue-600"></i>
                                <span class="text-[10px] font-bold text-slate-600 uppercase">Secure Access</span>
                            </div>
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                                <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-500"></i>
                                <span class="text-[10px] font-bold text-slate-600 uppercase">Live Sync</span>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-3 bg-slate-50 p-8 rounded-[2rem] border border-slate-200 flex flex-col justify-between items-center text-center">
                        <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Service Status</p>
                        <div class="relative py-4">
                            <div id="status-glow" class="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse"></div>
                            <i data-lucide="database" id="status-icon" class="w-12 h-12 text-emerald-600 relative z-10"></i>
                        </div>
                        <div>
                            <span class="text-xs font-black text-slate-700 block mb-1">Supabase Cloud</span>
                            <span id="service-status-text" class="text-[10px] text-emerald-600 font-bold uppercase flex items-center justify-center gap-1">
                                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                Operational
                            </span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Total Students</p>
                            <h3 id="stat-total-students" class="text-3xl font-bold mt-2 text-slate-800">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="users" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Daily Attendance</p>
                            <h3 id="stat-attendance" class="text-3xl font-bold mt-2 text-slate-800">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="eye" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Events Completed</p>
                            <h3 id="stat-events" class="text-3xl font-bold mt-2 text-slate-800">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Operation Effect</p>
                        <div class="relative flex items-center justify-center">
                            <svg class="w-20 h-20 transform -rotate-90">
                                <circle cx="40" cy="40" r="34" stroke="#f1f5f9" stroke-width="8" fill="transparent"/>
                                <circle id="progress-circle" cx="40" cy="40" r="34" stroke="#000080" stroke-width="8" fill="transparent" 
                                        stroke-dasharray="213.6" stroke-dashoffset="213.6" stroke-linecap="round"
                                        style="transition: stroke-dashoffset 1.5s ease-out;"/>
                            </svg>
                            <span id="stat-effect-percent" class="absolute text-xl font-black text-slate-700">0%</span>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div class="grid grid-cols-1 lg:grid-cols-3">
                        <div class="lg:col-span-2 p-8 border-r border-slate-50">
                            <h4 class="text-sm font-bold text-slate-700 mb-8">Attendance Trend (SY 2026)</h4>
                            <div class="h-48 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                                <p class="text-xs text-slate-400 font-medium italic">Visualization Syncing...</p>
                            </div>
                        </div>

                        <div class="p-8 bg-slate-50/20">
                            <h4 class="text-sm font-bold text-slate-700 mb-8">Department Ranking</h4>
                            <div id="dept-ranking-list" class="space-y-6">
                                <p class="text-xs text-slate-400 animate-pulse text-center">Crunching records...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    },

    async init() {
        this.render();
        await this.updateLiveStats();
    },

    animateValue(id, start, end, duration) {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    },

    async updateLiveStats() {
        try {
            const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
            const { count: aCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
            const { count: eCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

            let allDeptData = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error: fetchError } = await supabase
                    .from('students')
                    .select('department')
                    .range(from, from + step - 1);

                if (fetchError) throw fetchError;
                
                allDeptData = [...allDeptData, ...data];
                if (data.length < step) hasMore = false;
                else from += step;
            }

            const statusText = document.getElementById('service-status-text');
            const statusGlow = document.getElementById('status-glow');
            if (statusText) {
                statusText.innerHTML = `<span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> Operational`;
                statusText.className = "text-[10px] text-emerald-600 font-bold uppercase flex items-center justify-center gap-1";
                if(statusGlow) statusGlow.className = "absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse";
            }

            this.animateValue("stat-total-students", 0, sCount || 0, 1500);
            this.animateValue("stat-attendance", 0, aCount || 0, 1500);
            this.animateValue("stat-events", 0, eCount || 0, 1500);

            const effectPercent = sCount > 0 ? Math.min(Math.round(((aCount || 0) / sCount) * 100), 100) : 0;
            const circle = document.getElementById('progress-circle');
            if (circle) {
                circle.style.strokeDashoffset = 213.6 - (effectPercent / 100) * 213.6;
                this.animateValue("stat-effect-percent", 0, effectPercent, 1500);
            }

            const rankingList = document.getElementById('dept-ranking-list');
            if (rankingList && allDeptData.length > 0) {
                const counts = allDeptData.reduce((acc, curr) => {
                    const d = curr.department || 'Unassigned';
                    acc[d] = (acc[d] || 0) + 1;
                    return acc;
                }, {});

                const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);

                rankingList.innerHTML = sorted.map(([name, val], i) => `
                    <div class="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500" style="animation-delay: ${i * 100}ms">
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 ${i === 0 ? 'bg-[#000080]' : 'bg-slate-200 text-slate-500'} text-white rounded-full text-[10px] flex items-center justify-center font-bold">${i + 1}</span>
                            <span class="text-sm font-semibold text-slate-600">${name}</span>
                        </div>
                        <span class="text-sm font-bold text-slate-700 tracking-tighter">${val.toLocaleString()}</span>
                    </div>
                `).join('');
            }

        } catch (err) {
            console.error("Dashboard Sync Error:", err.message);
            const statusText = document.getElementById('service-status-text');
            const statusGlow = document.getElementById('status-glow');
            const statusIcon = document.getElementById('status-icon');
            if (statusText) {
                statusText.innerHTML = `Connection Error`;
                statusText.className = "text-[10px] text-red-500 font-bold uppercase flex items-center justify-center gap-1";
                if(statusGlow) statusGlow.className = "absolute inset-0 bg-red-400/10 blur-xl rounded-full";
                if(statusIcon) statusIcon.className = "w-12 h-12 text-red-400 relative z-10";
            }
        }
    }
};
