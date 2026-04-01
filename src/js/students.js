import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const studentManager = {
    // Import Excel from your Android Storage
    async importExcel(file, orgName) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

            // Tag students with the Organization Name automatically
            const studentsToUpload = json.map(row => ({
                student_id: row.ID || row.StudentId,
                full_name: row.Name || row.FullName,
                department: row.Department,
                org_owner: orgName
            }));

            const { error } = await supabase.from('students').insert(studentsToUpload);
            if (error) alert("Error: " + error.message);
            else alert("Successfully imported " + studentsToUpload.length + " students!");
        };
        reader.readAsArrayBuffer(file);
    },

    // Fetch list based on Organization
    async getFilteredList(userOrg) {
        let query = supabase.from('students').select('*');

        if (userOrg === "HERO Organization") {
            query = query.in('department', ['Education Dept. Student', 'General Student(other dept.)']);
        }

        const { data } = await query;
        return data || [];
    }
};
