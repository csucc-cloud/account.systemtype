import { authHandler } from './auth.js';
import { chartManager } from './charts.js';
import lucide from 'lucide';

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    // Check Auth & Set Org Name
    const user = await authHandler.getCurrentUser();
    const displayOrg = document.getElementById('display-org-name');
    
    if (user) {
        displayOrg.innerText = user.user_metadata.org_name;
        // Initialize Charts
        chartManager.renderAttendance('attendanceChart');
        chartManager.renderDistribution('deptChart');
    } else {
        displayOrg.innerText = "Guest Mode";
    }
});

// Navigation Logic
window.showSection = (sectionId) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`section-${sectionId}`).classList.remove('hidden');
    document.getElementById('current-page-title').innerText = sectionId.toUpperCase();
};
