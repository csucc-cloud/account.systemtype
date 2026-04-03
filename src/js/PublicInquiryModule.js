import { supabase } from './auth.js';

export const PublicInquiryModule = {
    state: {
        currentEventId: null,
        studentId: null,
        isSubmitting: false,
        orgName: "Loading Portal...",
        config: {
            title: "Submit <span class='text-blue-700'>Inquiry</span>",
            subtitle: "Inquiry Portal",
            q1: "Question 1 (Required)",
            q2: "Question 2 (Optional)",
            q3: "Question 3 (Optional)",
            buttonText: "Submit Inquiry"
        }
    },

    async init(eventId, customConfig = null) {
        this.state.currentEventId = eventId;
        if (customConfig) {
            this.state.config = { ...this.state.config, ...customConfig };
        }
        
        this.renderForm();
        
        await this.fetchOrgDetails();
        
        this.attachEventListeners();
    },

    async fetchOrgDetails() {
        try {
            if (!this.state.currentEventId) return;

            // 1. First, try to find it directly in 'organizations' (for General Portals)
            let { data: orgData } = await supabase
                .from('organizations')
                .select('full_name, org_name')
                .eq('id', this.state.currentEventId)
                .maybeSingle();

            if (orgData) {
                this.state.orgName = orgData.full_name || orgData.org_name;
            } else {
                // 2. If not found, it's likely an EVENT ID. 
                // We need to 'Join' tables to find which Org owns this event.
                const { data: eventData, error: eventErr } = await supabase
                    .from('events')
                    .select(`
                        organization_id,
                        organizations (full_name, org_name)
                    `)
                    .eq('id', this.state.currentEventId)
                    .maybeSingle();

                if (eventData && eventData.organizations) {
                    this.state.orgName = eventData.organizations.full_name || eventData.organizations.org_name;
                } else {
                    this.state.orgName = "Organization Portal";
                }
            }

            this.renderForm();
            this.attachEventListeners();
        } catch (err) {
            console.error("Lookup failed:", err);
            this.state.orgName = "Inquiry Portal";
            this.renderForm();
        }
    },
    
    renderForm() {
        const container = document.getElementById('inquiry-form-container');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6 animate-in fade-in duration-500">
                <div class="text-center space-y-2">
                    <h1 class="text-2xl font-black italic tracking-tighter uppercase text-blue-700">
                        ${this.state.orgName}
                    </h1>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        ${this.state.config.subtitle === "Inquiry Portal" ? `Reference ID: ${this.state.currentEventId.slice(0,8)}` : this.state.config.subtitle}
                    </p>
                </div>

                <div class="space-y-2">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Student ID Number</label>
                    <input type="text" id="student-id" placeholder="e.g. 2023-0001" 
                        class="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all">
                    <p id="id-error-message" class="hidden text-red-500 text-[10px] font-bold ml-2 italic uppercase"></p>
                </div>

                <div class="space-y-3">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Your Details</label>
                    <textarea id="q1" placeholder="${this.state.config.q1}" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px] focus:bg-white transition-all"></textarea>
                    <textarea id="q2" placeholder="${this.state.config.q2}" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px] focus:bg-white transition-all"></textarea>
                    <textarea id="q3" placeholder="${this.state.config.q3}" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px] focus:bg-white transition-all"></textarea>
                </div>

                <button id="submit-btn" class="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2">
                    <span>${this.state.config.buttonText}</span>
                </button>
            </div>
        `;
    },

    attachEventListeners() {
        const btn = document.getElementById('submit-btn');
        if (btn) btn.addEventListener('click', () => this.handleSubmission());
    },

    async validateStudentId() {
        const idInput = document.getElementById('student-id');
        const idError = document.getElementById('id-error-message');
        const inputVal = idInput.value.trim();

        if (!inputVal) {
            alert("Please enter your Student ID.");
            return null;
        }

        try {
            const { data, error } = await supabase
                .from('students')
                .select('student_id')
                .eq('student_id', inputVal)
                .single();

            if (error || !data) {
                idInput.classList.add('border-red-500', 'bg-red-50');
                idError.classList.remove('hidden');
                idError.innerText = "Student ID not found in masterlist!";
                return null;
            }

            idInput.classList.remove('border-red-500', 'bg-red-50');
            idInput.classList.add('border-green-500');
            idError.classList.add('hidden');
            return inputVal;
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    async handleSubmission() {
        if (this.state.isSubmitting) return;

        const validatedId = await this.validateStudentId();
        if (!validatedId) return;

        const q1 = document.getElementById('q1').value.trim();
        const q2 = document.getElementById('q2').value.trim();
        const q3 = document.getElementById('q3').value.trim();

        if (!q1) {
            alert("The first inquiry field is required.");
            return;
        }

        this.setLoading(true);

        try {
            const { error } = await supabase
                .from('event_inquiries')
                .insert([{
                    event_id: this.state.currentEventId,
                    student_id: validatedId,
                    question_1: q1,
                    question_2: q2,
                    question_3: q3
                }]);

            if (error) throw error;
            this.showSuccessState();
        } catch (err) {
            alert("Submission Error: " + err.message);
            this.setLoading(false);
        }
    },

    setLoading(isLoading) {
        this.state.isSubmitting = isLoading;
        const btn = document.getElementById('submit-btn');
        if (btn) {
            btn.disabled = isLoading;
            btn.innerHTML = isLoading 
                ? `<div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> <span>Sending...</span>`
                : `<span>${this.state.config.buttonText}</span>`;
            btn.style.opacity = isLoading ? "0.7" : "1";
        }
    },

    showSuccessState() {
        const formContainer = document.getElementById('inquiry-form-container');
        formContainer.innerHTML = `
            <div class="text-center py-10 space-y-6 animate-in zoom-in duration-300">
                <div class="flex justify-center">
                    <div class="bg-emerald-100 text-emerald-600 p-4 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                        </svg>
                    </div>
                </div>
                <div>
                    <h2 class="text-2xl font-black uppercase tracking-tight">Success!</h2>
                    <p class="text-slate-500 text-sm font-medium mt-1">Your inquiry has been logged successfully.</p>
                </div>
                <button onclick="window.location.reload()" class="px-8 py-3 border-2 border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all">
                    Submit Another
                </button>
            </div>
        `;
    }
};
