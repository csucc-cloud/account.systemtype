import { supabase } from './auth.js';

export const dashboardModule = {
    render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div id="dashboard-view" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-[#000080] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden group lg:col-span-1">
                        <div class="relative z-10">
                            <p class="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Lead Developer</p>
                            <h4 class="text-2xl font-black mb-1">Davie P. Sialongo</h4>
                            <p class="text-blue-100/60 text-xs font-medium">System Architect & Full Stack Developer</p>
                        </div>
                        <i data-lucide="code" class="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform"></i>
                    </div>

                    <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex flex-col justify-center">
                            <p class="text-[#000080] text-[10px] font-black uppercase tracking-[0.2em] mb-2">The Mission</p>
                            <h4 class="text-sm font-bold text-slate-800 mb-2">OAS Portal v2.1</h4>
                            <p class="text-xs text-slate-600 leading-relaxed">
                                A centralized automated system specifically designed for the Local Student Government and Student Organizations to bridge student services and digital efficiency.
                            </p>
                        </div>
                        <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center space-y-4">
                            <p class="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">System Core</p>
                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="github" class="w-4 h-4 text-slate-800"></i>
                                    <span class="text-xs font-bold text-slate-700">GitHub</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <i data-lucide="database" class="w-4 h-4 text-emerald-500"></i>
                                    <span class="text-xs font-bold text-slate-700">Supabase DB</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start hover:shadow-md transition-shadow">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Total Students</p>
                            <h3 id="stat-total-students" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="users" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Daily Attendance</p>
                            <h3 id="stat-attendance" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="eye" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Events Completed</p>
                            <h3 id="stat-events" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
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

                <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="grid grid-cols-1 lg:grid-cols-3">
                        <div class="lg:col-span-2 p-8 border-r border-slate-50">
                            <div class="flex justify-between items-center mb-8">
                                <h4 class="text-sm font-bold text-slate-700">Attendance Trend (SY 2026)</h4>
                                <div class="flex gap-4 text-[10px] font-bold uppercase text-slate-400">
                                    <span class="text-blue-600">Real-time</span>
                                    <span>Historical</span>
                                </div>
                            </div>
                            <div class="h-64 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                                <div class="flex items-end gap-3 h-32 mb-4">
                                    <div class="w-8 bg-blue-100 rounded-t-lg animate-bounce" style="height: 40%; animation-delay: 0.1s"></div>
                                    <div class="w-8 bg-blue-200 rounded-t-lg animate-bounce" style="height: 70%; animation-delay: 0.2s"></div>
                                    <div class="w-8 bg-[#000080] rounded-t-lg animate-bounce" style="height: 90%; animation-delay: 0.3s"></div>
                                    <div class="w-8 bg-blue-300 rounded-t-lg animate-bounce" style="height: 60%; animation-delay: 0.4s"></div>
                                </div>
                                <p class="text-xs text-slate-400 font-medium italic">Syncing with Analytics Engine...</p>
                            </div>
                        </div>

                        <div class="p-8 bg-slate-50/20">
                            <h4 class="text-sm font-bold text-slate-700 mb-8">Department Ranking</h4>
                            <div id="dept-ranking-list" class="space-y-6">
                                <p class="text-xs text-slate-400 animate-pulse">Calculating rankings across all students...</p>
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
            // 1. Fetch Global Counts
            const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
            const { count: aCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
            const { count: eCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

            // 2. Fetch Department Counts (OPTION 1: Entirety check)
            const { data: deptCounts, error: deptError } = await supabase
                .from('students')
                .select('department');

            if (deptError) throw deptError;

            // 3. Animate Main Numbers
            this.animateValue("stat-total-students", 0, sCount || 0, 1500);
            this.animateValue("stat-attendance", 0, aCount || 0, 1500);
            this.animateValue("stat-events", 0, eCount || 0, 1500);

            // 4. Update Operation Effect (Real Engagement Ratio)
            const effectPercent = sCount > 0 ? Math.min(Math.round(((aCount || 0) / sCount) * 100), 100) : 0;
            const circle = document.getElementById('progress-circle');
            if (circle) {
                const circumference = 213.6;
                circle.style.strokeDashoffset = circumference - (effectPercent / 100) * circumference;
                this.animateValue("stat-effect-percent", 0, effectPercent, 1500);
                setTimeout(() => {
                    const txt = document.getElementById('stat-effect-percent');
                    if (txt) txt.innerText = effectPercent + "%";
                }, 1500);
            }

            // 5. Build Ranking from all records
            const rankingList = document.getElementById('dept-ranking-list');
            if (rankingList && deptCounts) {
                const countsMap = deptCounts.reduce((acc, curr) => {
                    const d = curr.department || 'Unassigned';
                    acc[d] = (acc[d] || 0) + 1;
                    return acc;
                }, {});

                const sorted = Object.entries(countsMap)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5); // Showing top 5 for better depth

                rankingList.innerHTML = sorted.map(([name, val], index) => `
                    <div class="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500" style="animation-delay: ${index * 100}ms">
                        <div class="flex items-center gap-3">
                            <span class="w-6 h-6 ${index === 0 ? 'bg-slate-800' : 'bg-slate-200 text-slate-500'} text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                                ${index + 1}
                            </span>
                            <span class="text-sm font-semibold text-slate-600">${name}</span>
                        </div>
                        <span class="text-sm font-bold text-slate-700 tracking-tighter">${val.toLocaleString()}</span>
                    </div>
                `).join('');
            }

        } catch (err) {
            console.error("Dashboard Sync Error:", err.message);
        }
    }
};
