window.addEventListener('DOMContentLoaded', function() {
    setupKeyboardNavigation();
    setupModalKeyboardEvents();
    setupRoleBasedNavigation();
});

/**
 * Setup role-based navigation labels
 * - Changes "Hafalan" to "Hafalan Ananda" for walisantri
 * - Hides admin-only nav items for non-admin users
 */
function setupRoleBasedNavigation() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'guest';

    // Update Hafalan nav text for walisantri
    const hafalanTextEl = document.querySelector('.nav-hafalan-text');
    if (hafalanTextEl) {
        if (role === 'walisantri') {
            hafalanTextEl.textContent = 'Hafalan Ananda';
        } else {
            hafalanTextEl.textContent = 'Hafalan';
        }
    }

    // Hide Siswa menu for walisantri (they don't need to see student list)
    if (role === 'walisantri') {
        const siswaNav = document.querySelector('a.nav-item[href="/students"]');
        if (siswaNav) {
            siswaNav.style.display = 'none';
        }
    }
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(event) {
        const activeElement = document.activeElement;

        if (event.key === 'Escape') {
            const modal = document.querySelector('.modal.active, .modal[style*="display: block"]');
            if (modal) {
                const closeButton = modal.querySelector('.btn-close');
                if (closeButton) {
                    closeButton.click();
                }
            }
        }

        if (event.key === 'Enter' && activeElement.tagName === 'BUTTON') {
            activeElement.click();
        }
    });
}

function setupModalKeyboardEvents() {
    const modals = document.querySelectorAll('.modal');

    if (!modals || modals.length === 0) {
        return;
    }

    modals.forEach(modal => {
        if (!modal) return;

        modal.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const closeButton = modal.querySelector('.btn-close');
                if (closeButton) {
                    closeButton.click();
                }
            }
        });
    });
}

window.setupKeyboardNavigation = setupKeyboardNavigation;
window.setupModalKeyboardEvents = setupModalKeyboardEvents;
window.setupRoleBasedNavigation = setupRoleBasedNavigation;
