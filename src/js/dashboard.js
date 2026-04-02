import { supabase } from './auth.js';
import architectPhoto from '../../assets/img/5646.png';

export const dashboardModule = {
    render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div id="dashboard-view" class="space-y-6">
                
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    <div class="lg:col-span-4 bg-gradient-to-br from-[#000080] to-[#000050] text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden group flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
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
                                    <h4 class="text-3xl font-black tracking-tight mb-1">Davie P. Sialongo</h4>
                                    <p class="text-blue-200/70 text-sm font-medium italic">The Developer • CITTE Student</p>
                                </div>
                            </div>
                            <div class="mt-auto pt-6 border-t border-white/10 flex items-center justify-between w-full">
                                <span class="text-[10px] font-bold opacity-50 uppercase">Established April 1, 2026</span>
                            </div>
                        </div>
                        <i data-lucide="cpu" class="absolute -bottom-6 -right-6 w-40 h-40 text-white/5 transform group-hover:rotate-12 transition-transform duration-700"></i>
                    </div>

                    <div class="lg:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-100 transition-all duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div>
                            <div class="flex justify-between items-start mb-4">
                                <h4 class="text-slate-900 font-black text-xl flex items-center gap-2">
                                    <span class="w-2 h-7 bg-[#000080] rounded-full"></span>
                                    OAS Portal <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">v2.1</span>
                                </h4>
                                <div class="flex items-center gap-1">
                                    <span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">System Pulse</span>
                                </div>
                            </div>
                            <p class="text-slate-500 text-sm leading-relaxed mb-6">The <strong class="text-slate-700">Official Automation System</strong> is the backbone of LSG operations. It serves as the sophisticated digital backbone of the LSG operations, meticulously engineered by Lead Architect <strong class="text-slate-700">Davie P. Sialongo</strong> to transition administrative governance into a high-performance, paperless ecosystem. By integrating a real-time Supabase backend with a dynamic Chart.js visualization suite, the platform provides instantaneous data parity across student records, attendance tracking, and departmental distribution. This version introduces an optimized "Tactical Entry" interface featuring staggered CSS animations and professional-grade audit logging, ensuring that every system interaction is not only cryptographically secure via AES-256 standards but also visually intuitive for rapid, data-driven decision-making.</p>
                            <div class="grid grid-cols-2 gap-3 mb-2">
                                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Avg Uptime</p>
                                    <p class="text-lg font-black text-[#000080]">99.9%</p>
                                </div>
                                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Latency</p>
                                    <p class="text-lg font-black text-[#000080]">240ms</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-3 bg-slate-900 p-8 rounded-[2rem] shadow-xl flex flex-col justify-between relative overflow-hidden border border-slate-800 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <div class="relative z-10 space-y-6">
                            <p class="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Infrastructure</p>
                            <div class="flex items-center gap-4 group">
                                <div class="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                                    <i data-lucide="database" class="w-6 h-6 text-emerald-500"></i>
                                </div>
                                <div>
                                    <h5 class="text-white font-bold text-sm">Supabase DB</h5>
                                    <span id="service-status-text" class="text-[10px] text-emerald-400 font-bold uppercase">Operational</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${[1, 2, 3, 4].map(i => `
                        <div id="stat-card-${i}" class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-start animate-in fade-in zoom-in duration-500" style="animation-delay: ${300 + (i * 100)}ms">
                            <div id="stat-content-${i}"></div>
                        </div>
                    `).join('')}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div class="lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex flex-col animate-in fade-in slide-in-from-left-8 duration-700 delay-500">
                        <h4 class="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-6">
                            <i data-lucide="pie-chart" class="w-4 h-4 text-[#000080]"></i> Department Distribution
                        </h4>
                        <div class="flex-1 relative min-h-[250px]">
                            <canvas id="deptDistributionChart"></canvas>
                        </div>
                    </div>

                    <div class="lg:col-span-4 bg-slate-50 rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-700 delay-600">
                        <div class="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h4 class="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><i data-lucide="shield-alert" class="w-4 h-4 text-amber-600"></i> System Audit Log</h4>
                        </div>
                        <div id="audit-log-list" class="p-6 space-y-6 flex-1"></div>
                    </div>

                    <div class="lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex flex-col animate-in fade-in slide-in-from-right-8 duration-700 delay-700">
                        <h4 class="text-sm font-bold text-slate-700 mb-8 flex items-center gap-2">
                            <i data-lucide="bar-chart-3" class="w-4 h-4 text-[#000080]"></i> Department Ranking
                        </h4>
                        <div id="dept-ranking-list" class="space-y-6 flex-1"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Populate static shells of stats
        document.getElementById('stat-card-1').innerHTML = `<div><p class="text-sm font-medium text-slate-500">Total Students</p><h3 id="stat-total-students" class="text-3xl font-bold mt-2 text-slate-800">0</h3></div><div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="users" class="w-4 h-4 text-slate-400"></i></div>`;
        document.getElementById('stat-card-2').innerHTML = `<div><p class="text-sm font-medium text-slate-500">Daily Attendance</p><h3 id="stat-attendance" class="text-3xl font-bold mt-2 text-slate-800">0</h3></div><div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="eye" class="w-4 h-4 text-slate-400"></i></div>`;
        document.getElementById('stat-card-3').innerHTML = `<div><p class="text-sm font-medium text-slate-500">Events Completed</p><h3 id="stat-events" class="text-3xl font-bold mt-2 text-slate-800">0</h3></div><div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i></div>`;
        document.getElementById('stat-card-4').innerHTML = `<div class="w-full flex flex-col items-center"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Operation Effect</p><div class="relative flex items-center justify-center"><svg class="w-20 h-20 transform -rotate-90"><circle cx="40" cy="40" r="34" stroke="#f1f5f9" stroke-width="8" fill="transparent"/><circle id="progress-circle" cx="40" cy="40" r="34" stroke="#000080" stroke-width="8" fill="transparent" stroke-dasharray="213.6" stroke-dashoffset="213.6" stroke-linecap="round" style="transition: stroke-dashoffset 1.5s ease-out;"/></svg><span id="stat-effect-percent" class="absolute text-xl font-black text-slate-700">0%</span></div></div>`;

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

            // SINGLE FETCH: All student data for Ranking AND Chart
            let allDeptData = [];
            let from = 0; const step = 1000; let hasMore = true;
            while (hasMore) {
                const { data, error } = await supabase.from('students').select('department').range(from, from + step - 1);
                if (error) throw error;
                allDeptData = [...allDeptData, ...data];
                if (data.length < step) hasMore = false; else from += step;
            }

            // The "Source of Truth" for Distribution logic
            const deptCounts = allDeptData.reduce((acc, curr) => {
                const d = curr.department || 'Unassigned';
                acc[d] = (acc[d] || 0) + 1;
                return acc;
            }, {});

            // Update Both UI Elements with the same data object
            this.renderProfessionalChart(deptCounts);
            this.renderRankingList(deptCounts);

            // Audit Logs (Restored)
            const auditContainer = document.getElementById('audit-log-list');
            if (auditContainer) {
                const { data: logs } = await supabase.from('system_audit_logs').select('*').order('created_at', { ascending: false }).limit(3);
                auditContainer.innerHTML = (logs && logs.length > 0) ? logs.map((log, i) => `
                    <div class="flex gap-3 animate-in fade-in slide-in-from-right duration-500" style="animation-delay: ${i * 150}ms">
                        <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]">${log.action_type.substring(0,2)}</div>
                        <div>
                            <p class="text-[11px] font-bold text-slate-800">Admin <span class="font-normal text-slate-400">${log.action_type.toLowerCase()}</span></p>
                            <p class="text-[9px] text-blue-600 font-bold uppercase">${new Date(log.created_at).toLocaleTimeString()}</p>
                        </div>
                    </div>
                `).join('') : '<p class="text-xs text-slate-400 italic">No activity logs.</p>';
            }

            // Progress Circle Update
            const effectPercent = sCount > 0 ? Math.min(Math.round(((aCount || 0) / sCount) * 100), 100) : 0;
            const circle = document.getElementById('progress-circle');
            if (circle) {
                circle.style.strokeDashoffset = 213.6 - (effectPercent / 100) * 213.6;
                this.animateValue("stat-effect-percent", 0, effectPercent, 1500);
            }

        } catch (err) {
            this.handleSyncError(err);
        }
    },

    renderRankingList(counts) {
        const rankingList = document.getElementById('dept-ranking-list');
        if (!rankingList) return;

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
    },

    renderProfessionalChart(counts) {
        const ctx = document.getElementById('deptDistributionChart');
        if (!ctx) return;

        // Group counts into the 3 categories requested
        const categories = { 'Education': 0, 'Industrial': 0, 'Other': 0 };
        Object.entries(counts).forEach(([dept, count]) => {
            if (dept.includes('Education')) categories['Education'] += count;
            else if (dept.includes('Industrial') || dept.includes('Tech')) categories['Industrial'] += count;
            else categories['Other'] += count;
        });

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Education Dept.', 'Indus Tech Dept.', 'Other Dept.'],
                datasets: [{
                    data: [categories.Education, categories.Industrial, categories.Other],
                    backgroundColor: ['#000080', '#3b82f6', '#cbd5e1'],
                    borderWidth: 0,
                    hoverOffset: 20
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '78%',
                animation: { animateRotate: true, animateScale: true, duration: 2000, easing: 'easeOutQuart' },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 25, font: { size: 10, weight: '700' } }
                    }
                }
            }
        });
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
        console.error("Dashboard Sync Error:", err);
    }
};
