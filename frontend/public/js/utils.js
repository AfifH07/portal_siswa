/**
 * Utility functions for frontend security and common operations
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for innerHTML use
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Alias for escapeHtml - more intuitive name
 */
function sanitize(str) {
    return escapeHtml(str);
}

/**
 * Escapes a string for safe use in HTML attributes
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string safe for attribute use
 */
function escapeAttr(str) {
    return escapeHtml(str);
}

/**
 * Display a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success', 'error', or 'warning'
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (!toast || !toastMessage) {
        return;
    }

    toastMessage.textContent = message;
    toast.className = 'toast';
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'warning') {
        toast.classList.add('warning');
    }

    toast.style.display = 'block';
    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}

/**
 * Logout user and redirect to login page
 */
async function logout() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');

        await fetch(
            window.API_CONFIG && window.API_CONFIG.buildUrl
                ? window.API_CONFIG.buildUrl('auth/logout/')
                : '/api/auth/logout/',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify({ refresh: refreshToken })
            }
        );
    } catch (error) {
        console.error('Logout API error:', error);
    } finally {
        // Clear all auth data
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_username');
        localStorage.removeItem('currentUser');
        window.location.href = '/login';
    }
}

// Export for module usage and global access
window.escapeHtml = escapeHtml;
window.sanitize = sanitize;
window.escapeAttr = escapeAttr;
window.showToast = showToast;
window.logout = logout;
