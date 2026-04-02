import { supabase } from './auth.js';

export const PublicInquiryModule = {
    state: {
        currentEventId: null,
        isValidated: false
    },

    init(eventId) {
        this.state.currentEventId = eventId;
        this.attachEventListeners();
    },

    async validateStudentId() {
        const idInput = document.getElementById('student-id');
        const idError = document.getElementById('id-error-message');
        const inputVal = idInput.value.trim();

        // 1. Database Check against Masterlist
        const { data, error } = await supabase
            .from('students_masterlist')
            .select('student_number')
            .eq('student_number', inputVal)
            .single();

        if (error || !data) {
            // 2. The "Strict" Red Alert Logic
            idInput.classList.add('border-red-500', 'bg-red-50', 'animate-shake');
            idError.classList.remove('hidden');
            idError.innerText = "Student ID number does not exist!";
            this.state.isValidated = false;
            return false;
        } else {
            // 3. Success State
            idInput.classList.remove('border-red-500', 'bg-red-50', 'animate-shake');
            idInput.classList.add('border-green-500');
            idError.classList.add('hidden');
            this.state.isValidated = true;
            return true;
        }
    },

    async submitInquiry() {
        if (!this.state.isValidated) {
            const isNowValid = await this.validateStudentId();
            if (!isNowValid) return;
        }

        const questions = [
            document.getElementById('q1').value.trim(),
            document.getElementById('q2').value.trim(),
            document.getElementById('q3').value.trim()
        ].filter(q => q !== ""); // Remove empty questions

        if (questions.length === 0) {
            alert("Please enter at least one question.");
            return;
        }

        // 4. Send to Supabase
        const { error } = await supabase
            .from('event_inquiries')
            .insert([{
                event_id: this.state.currentEventId,
                student_id: document.getElementById('student-id').value,
                questions: questions, // Stored as an array or separate columns
                submitted_at: new Date()
            }]);

        if (!error) {
            this.showSuccessState();
        }
    },

    showSuccessState() {
        const formContainer = document.getElementById('inquiry-form-container');
        formContainer.innerHTML = `
            <div class="text-center p-10 space-y-4">
                <div class="text-green-500 text-5xl">Checkmark Icon</div>
                <h2 class="text-xl font-black">Submitted!</h2>
                <p class="text-slate-500 text-sm">Your questions have been sent to the officers.</p>
                <button onclick="window.close()" class="bg-slate-800 text-white px-6 py-2 rounded-xl">Close Tab</button>
            </div>
        `;
    }
};
