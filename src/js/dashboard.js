import { supabase } from './auth.js';
import architectPhoto from '../../assets/img/5646.png';

export const dashboardModule = {
    render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div id="dashboard-view" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    <div class="lg:col-span-4 bg-gradient-to-br from-[#000080] to-[#000050] text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden group flex flex-col items-center text-center">
                        <div class="relative z-10 flex flex-col h-full justify-between items-center w-full">
                            <div class="flex flex-col items-center gap-6 mb-6">
                                <div class="relative w-40 h-40 flex-shrink-0">
                                    <div class="absolute inset-0 rounded-full bg-blue-400/20 animate-pulse"></div>
                                    <img src="${architectPhoto}" alt="Lead Architect" class="relative z-10 w-full h-full rounded-full object-cover border-4 border-white/10 shadow-2xl group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://ui-avatars.com/api/?name=Davie+Sialongo&background=000080&color=fff'">
                                    <div class="absolute bottom-2 right-2 z-20 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[#000080]">
                                        <i data-lucide="shield-check" class="w-4 h-4 text-white"></i>
                                    </div>
                                </div>
                                <div>
                                    <div class="flex items-center justify-center gap-2 mb-2">
                                        <span class="px-2 py-1 bg-blue-400/20 rounded text-[10px] font-black uppercase tracking-widest border border-blue-400/30">Lead Architect</span>
                                    </div>
                                    <h4 class="text-3xl font-black tracking-tight mb-1">Davie P. Sialongo</h4>
                                    <p class="text-blue-200/70 text-sm font-medium italic">Full-Stack Developer • CITTE Student</p>
                                </div>
                            </div>
                            <div class="mt-auto pt-6 border-t border-white/10 flex items-center justify-between w-full">
                                <div class="flex -space-x-2">
                                    <div class="w-8 h-8 rounded-full bg-blue-500 border-2 border-[#000080] flex items-center justify-center"><i data-lucide="code-2" class="w-4 h-4"></i></div>
                                    <div class="w-8 h-8 rounded-full bg-indigo-500 border-2 border-[#000080] flex items-center justify-center"><i data-lucide="terminal" class="w-4 h-4"></i></div>
                                </div>
                                <span class="text-[10px] font-bold opacity-50 uppercase">Established 2024</span>
                            </div>
                        </div>
                        <i data-lucide="cpu" class="absolute -bottom-6 -right-6 w-40 h-40 text-white/5 transform group-hover:rotate-12 transition-transform duration-700"></i>
                    </div>

                    <div class="lg:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-100 transition-all duration-300">
                        <div>
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="text-slate-900 font-black text-xl flex items-center gap-2">
                                    <span class="w-2 h-7 bg-[#000080] rounded-full"></span>
                                    OAS Portal <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">v2.1</span>
                                </h4>
                                <div class="flex items-center gap-1">
                                    <span class="relative flex h-2 w-2">
                                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">System Pulse</span>
                                </div>
                            </div>
                            <p class="text-slate-500 text-sm leading-relaxed mb-6">
                                The <strong class="text-slate-700">Official Automation System</strong> is the backbone of LSG operations, engineered for zero-paperwork governance and real-time student tracking.
                            </p>
                            <div class="grid grid-cols-2 gap-3 mb-2">
                                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-blue-50/50 transition-colors">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Avg Uptime</p>
                                    <p class="text-lg font-black text-[#000080]">99.9%</p>
                                </div>
                                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-blue-50/50 transition-colors">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Latency</p>
                                    <p class="text-lg font-black text-[#000080]">240ms</p>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mt-4">
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-blue-600"></i> AES-256
                            </div>
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                                <i data-lucide="zap" class="w-3.5 h-3.5 text-amber-500"></i> Live Sync
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-3 bg-slate-900 p-8 rounded-[2rem] shadow-xl flex flex-col justify-between relative overflow-hidden border border-slate-800">
                        <div class="relative z-10">
                            <p class="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Infrastructure</p>
                            
                            <div class="space-y-6">
                                <div class="flex items-center gap-4 group">
                                    <div class="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                                        <i data-lucide="database" class="w-6 h-6 text-emerald-500"></i>
                                    </div>
                                    <div>
                                        <h5 class="text-white font-bold text-sm">Supabase DB</h5>
                                        <div class="flex items-center gap-1.5">
                                            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                            <span id="service-status-text" class="text-[10px] text-emerald-400 font-bold uppercase">Operational</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-4 group">
                                    <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:bg-white/10 transition-all">
                                        <i data-lucide="github" class="w-6 h-6 text-white"></i>
                                    </div>
                                    <div>
                                        <h5 class="text-white font-bold text-sm">GitHub Pages</h5>
                                        <span class="text-[10px] text-slate-400 font-bold uppercase">Deployment Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="relative z-10 pt-6 border-t border-white/5">
                            <p class="text-slate-500 text-[9px] font-bold uppercase text-center leading-tight">
                                High-Availability Cloud Architecture
                            </p>
                        </div>
                        <i data-lucide="server" class="absolute -top-10 -right-10 w-32 h-32 text-white/5 -rotate-12"></i>
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

    async updateLiveStats() {
        try {
            const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
            const { count: aCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
            const { count: eCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

            this.animateValue("stat-total-students", 0, sCount || 0, 1500);
            this.animateValue("stat-attendance", 0, aCount || 0, 1500);
            this.animateValue("stat-events", 0, eCount || 0, 1500);

            const effectPercent = sCount > 0 ? Math.min(Math.round(((aCount || 0) / sCount) * 100), 100) : 0;
            const circle = document.getElementById('progress-circle');
            if (circle) {
                circle.style.strokeDashoffset = 213.6 - (effectPercent / 100) * 213.6;
                this.animateValue("stat-effect-percent", 0, effectPercent, 1500);
            }

            let allDeptData = [];
            let from = 0;
            const step = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error: fetchError } = await supabase.from('students').select('department').range(from, from + step - 1);
                if (fetchError) throw fetchError;
                allDeptData = [...allDeptData, ...data];
                if (data.length < step) hasMore = false;
                else from += step;
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
            this.handleSyncError(err);
        }
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

    handleSyncError(err) {
        console.error("Dashboard Sync Error:", err.message);
        const statusText = document.getElementById('service-status-text');
        if (statusText) {
            statusText.innerHTML = `Offline`;
            statusText.className = "text-[10px] text-red-500 font-bold uppercase";
            statusText.previousElementSibling.className = "w-1.5 h-1.5 bg-red-500 rounded-full";
        }
    }
};
