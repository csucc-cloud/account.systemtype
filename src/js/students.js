import { supabase } from './auth.js';

export const studentManager = {
    /**
     * 1. Import Excel from Android/Desktop Storage
     * Uses window.XLSX from the CDN link in your index.html
     */
    async importExcel(file, orgId) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    // Access XLSX from the window object (CDN)
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = window.XLSX.utils.sheet_to_json(sheet);

                    // Map Excel columns to our Database Schema
                    const studentsToUpload = json.map(row => ({
                        student_id: String(row.ID || row.StudentId || row['Student ID']),
                        full_name: row.Name || row.FullName || row['Full Name'],
                        department: row.Department || row.Dept || 'General',
                        year_level: parseInt(row.YearLevel || row.Year || row['Year Level']) || 1,
                        // Links the student to the Organization ID
                        organization_id: orgId, 
                        status: 'active'
                    }));

                    if (studentsToUpload.length === 0) throw new Error("No data found in Excel.");

                    // Use UPSERT so if you upload the same student twice, it just updates them
                    const { error } = await supabase
                        .from('students')
                        .upsert(studentsToUpload, { onConflict: 'student_id' });

                    if (error) throw error;
                    
                    resolve(studentsToUpload.length);
                } catch (err) {
                    reject(err);
                }
            };

            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 2. Fetch Filtered List
     * Automatically respects the RLS policies we set in the SQL schema
     */
    async getFilteredList() {
        // We don't need to manually filter departments anymore 
        // because our SQL 'student_read_access' policy handles it!
        const { data, error } = await supabase
            .from('students')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) {
            console.error("Fetch Error:", error.message);
            return [];
        }
        return data || [];
    }
};
