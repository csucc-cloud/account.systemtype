// src/js/sidebar.js
export const sidebarController = {
    init() {
        const sidebar = document.getElementById('sidebar-main');
        const openBtn = document.getElementById('open-sidebar');
        const closeBtn = document.getElementById('close-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (!sidebar || !openBtn) return;

        const toggleSidebar = (isOpen) => {
            if (isOpen) {
                // Slide the sidebar in
                sidebar.classList.remove('-translate-x-full');
                // Show the darkened overlay
                overlay.classList.remove('hidden');
                // Prevent the background from scrolling
                document.body.classList.add('overflow-hidden');
            } else {
                // Slide the sidebar out
                sidebar.classList.add('-translate-x-full');
                // Hide the overlay
                overlay.classList.add('hidden');
                // Allow background scrolling again
                document.body.classList.remove('overflow-hidden');
            }
        };

        // Event Listeners
        openBtn.addEventListener('click', () => toggleSidebar(true));
        closeBtn?.addEventListener('click', () => toggleSidebar(false));
        overlay?.addEventListener('click', () => toggleSidebar(false));

        // Auto-close when a link is clicked (Mobile optimization)
        const navLinks = sidebar.querySelectorAll('button.nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) toggleSidebar(false);
            });
        });
    }
};
