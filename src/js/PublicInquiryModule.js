import { supabase } from './auth.js';

export const PublicInquiryModule = {
    state: {
        currentEventId: null,
        isValidated: false
    },

    init(eventId) {
        this.state.currentEventId = eventId;
        this.renderForm(); // Create the HTML first!
        this.attachEventListeners();
    },

    renderForm() {
        const container = document.getElementById('inquiry-form-container');
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-6">
                <div class="text-center space-y-2">
                    <h1 class="text-2xl font-black italic tracking-tighter uppercase">Submit <span class="text-blue-700">Inquiry</span></h1>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event ID: ${this.state.currentEventId.slice(0,8)}</p>
                </div>

                <div class="space-y-2">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Student ID Number</label>
                    <input type="text" id="student-id" placeholder="e.g. 2023-0001" 
                        class="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:outline-none transition-all">
                    <p id="id-error-message" class="hidden text-red-500 text-[10px] font-bold ml-2 italic uppercase"></p>
                </div>

                <div class="space-y-3">
                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Your Questions (Max 3)</label>
                    <textarea id="q1" placeholder="Question 1 (Required)" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px]"></textarea>
                    <textarea id="q2" placeholder="Question 2 (Optional)" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px]"></textarea>
                    <textarea id="q3" placeholder="Question 3 (Optional)" class="w-full p-4 bg-slate-50 rounded-xl text-sm font-medium outline-none border border-transparent focus:border-blue-200 min-h-[80px]"></textarea>
                </div>

                <button id="submit-btn" class="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all">
                    Submit Inquiry
                </button>
            </div>
        `;
    },

    attachEventListeners() {
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitInquiry());
        }
    },

    async validateStudentId() {
        const idInput = document.getElementById('student-id');
        const idError = document.getElementById('id-error-message');
        const inputVal = idInput.value.trim();

        if (!inputVal) {
            alert("Please enter your Student ID.");
            return false;
        }

        const { data, error } = await supabase
            .from('students_masterlist')
            .select('student_number')
            .eq('student_number', inputVal)
            .single();

        if (error || !data) {
            idInput.classList.add('border-red-500', 'bg-red-50');
            idError.classList.remove('hidden');
            idError.innerText = "Student ID number does not exist!";
            this.state.isValidated = false;
            return false;
        } else {
            idInput.classList.remove('border-red-500', 'bg-red-50');
            idInput.classList.add('border-green-500');
            idError.classList.add('hidden');
            this.state.isValidated = true;
            return true;
        }
    },

    async submitInquiry() {
        // Run validation check
        const isNowValid = await this.validateStudentId();
        if (!isNowValid) return;

        const q1 = document.getElementById('q1').value.trim();
        const q2 = document.getElementById('q2').value.trim();
        const q3 = document.getElementById('q3').value.trim();

        if (!q1) {
            alert("Question 1 is required.");
            return;
        }

        // Send to Supabase (match your table columns: question_1, question_2, etc)
        const { error } = await supabase
            .from('event_inquiries')
            .insert([{
                event_id: this.state.currentEventId,
                student_id: document.getElementById('student-id').value,
                question_1: q1,
                question_2: q2,
                question_3: q3
            }]);

        if (error) {
            alert("Error: " + error.message);
        } else {
            this.showSuccessState();
        }
    },

    showSuccessState() {
        const formContainer = document.getElementById('inquiry-form-container');
        formContainer.innerHTML = `
            <div class="text-center py-10 space-y-4 animate-in fade-in zoom-in">
                <div class="text-emerald-500 text-6xl mb-4 text-center justify-center flex">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                    </svg>
                </div>
                <h2 class="text-2xl font-black uppercase tracking-tight">Questions Sent!</h2>
                <p class="text-slate-500 text-sm font-medium">Your inquiry has been successfully logged.</p>
                <div class="pt-6">
                    <button onclick="window.location.reload()" class="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Submit Another</button>
                </div>
            </div>
        `;
    }
};
