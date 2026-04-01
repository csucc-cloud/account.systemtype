import { supabase } from './auth.js';

export const dashboardModule = {
    // 1. THE REAL HTML STRUCTURE (Professional Layout)
    render() {
        const container = document.getElementById('mod-dashboard');
        if (!container) return;

        // Note: Using a single innerHTML string is faster for the browser to "paint"
        container.innerHTML = `
            <div id="dashboard-view" class="space-y-6 animate-in fade-in duration-700">
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start hover:shadow-md transition-shadow">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Total Students</p>
                            <h3 id="stat-total-students" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                            <p class="text-xs mt-4 text-slate-400 font-medium">Growth ratio <span class="text-green-500">↑ 13%</span></p>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="users" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Daily Attendance</p>
                            <h3 id="stat-attendance" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                            <p class="text-xs mt-4 text-slate-400 font-medium">Day ratio <span class="text-red-400">↓ 10%</span></p>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="eye" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium text-slate-500">Events Completed</p>
                            <h3 id="stat-events" class="text-3xl font-bold mt-2 text-slate-800 tracking-tight">0</h3>
                            <p class="text-xs mt-4 text-slate-400 font-medium">Conversion <span class="text-blue-500">50%</span></p>
                        </div>
                        <div class="p-2 bg-slate-50 rounded-lg"><i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i></div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Operation Effect</p>
                        <div class="relative flex items-center justify-center">
                            <svg class="w-20 h-20 transform -rotate-90">
                                <circle cx="40" cy="40" r="34" stroke="#f1f5f9" stroke-width="8" fill="transparent"/>
                                <circle cx="40" cy="40" r="34" stroke="#000080" stroke-width="8" fill="transparent" 
                                        stroke-dasharray="213" stroke-dashoffset="40" stroke-linecap="round"/>
                            </svg>
                            <span class="absolute text-xl font-black text-slate-700">88%</span>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="flex items-center justify-between px-8 py-4 border-b border-slate-100">
                        <div class="flex gap-8">
                            <button class="text-blue-600 font-bold border-b-2 border-blue-600 pb-4 -mb-4 text-sm">Activity Trend</button>
                            <button class="text-slate-400 font-medium hover:text-slate-600 text-sm transition-colors">Comparison</button>
                        </div>
                        <div class="flex items-center gap-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span class="text-blue-600 cursor-pointer">All Year</span>
                            <span class="cursor-pointer">All Month</span>
                            <div class="border-l h-4 border-slate-200 mx-2"></div>
                            <input type="date" class="bg-slate-100 rounded-md px-2 py-1 outline-none text-slate-600 border-none text-[10px]">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3">
                        <div class="lg:col-span-2 p-8 border-r border-slate-50">
                            <h4 class="text-sm font-bold text-slate-700 mb-8">Attendance Trend (SY 2026)</h4>
                            <div class="h-64 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
                                <i data-lucide="bar-chart-3" class="w-8 h-8 text-slate-300 mb-2"></i>
                                <p class="text-xs text-slate-400 font-medium italic">Connecting to Supabase Analytics...</p>
                            </div>
                        </div>

                        <div class="p-8 bg-slate-50/20">
                            <h4 class="text-sm font-bold text-slate-700 mb-8">Department Ranking</h4>
                            <div id="dept-ranking-list" class="space-y-6">
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-3">
                                        <span class="w-6 h-6 bg-slate-800 text-white rounded-full text-[10px] flex items-center justify-center font-bold">1</span>
                                        <span class="text-sm font-semibold text-slate-600">Education</span>
                                    </div>
                                    <span class="text-sm font-bold text-slate-400 tracking-tighter">4,201</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-3">
                                        <span class="w-6 h-6 bg-slate-400 text-white rounded-full text-[10px] flex items-center justify-center font-bold">2</span>
                                        <span class="text-sm font-semibold text-slate-600">Technology</span>
                                    </div>
                                    <span class="text-sm font-bold text-slate-400 tracking-tighter">1,092</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <div class="flex items-center gap-3">
                                        <span class="w-6 h-6 bg-slate-200 text-slate-500 rounded-full text-[10px] flex items-center justify-center font-bold">3</span>
                                        <span class="text-sm font-semibold text-slate-600">Engineering</span>
                                    </div>
                                    <span class="text-sm font-bold text-slate-400 tracking-tighter">845</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wake up icons for this specific module
        if (window.lucide) window.lucide.createIcons();
    },

    // 2. THE LOGIC (Initializing and fetching data)
    async init() {
        this.render(); // Build the HTML first
        await this.updateLiveStats(); // Fill with real data
    },

    async updateLiveStats() {
        try {
            // Count total students for the logged-in org
            const { count, error } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;

            const statElement = document.getElementById('stat-total-students');
            if (statElement) {
                // Animate the number if you want to be extra fancy
                statElement.innerText = count ? count.toLocaleString() : 0;
            }

        } catch (err) {
            console.error("Dashboard Stats Fetch Error:", err.message);
        }
    }
};
