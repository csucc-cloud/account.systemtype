import Chart from 'chart.js/auto';

export const chartManager = {
    renderAttendance(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [{
                    label: 'Attendance %',
                    data: [85, 92, 78, 95],
                    borderColor: '#000080',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(0, 0, 128, 0.05)'
                }]
            }
        });
    },
    renderDistribution(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Education', 'Indus Tech', 'General'],
                datasets: [{ data: [60, 25, 15], backgroundColor: ['#000080', '#3b82f6', '#94a3b8'] }]
            }
        });
    }
};
