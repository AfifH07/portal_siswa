// =============================================================
// api-helper.js — Backward-compatible aliases
// =============================================================
// All real logic lives in apiFetch.js (Single Source of Truth).
// This file only provides legacy aliases for any code that
// may reference apiClient or refreshToken.
// =============================================================

window.apiClient = {
    async fetch(path, options = {}) {
        return window.apiFetch(path, options);
    }
};

window.getToken = function() {
    return localStorage.getItem('access_token');
};

window.setToken = function(token) {
    localStorage.setItem('access_token', token);
};

window.refreshToken = async function() {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;

    try {
        const url = window.API_CONFIG.buildUrl('auth/token/refresh/');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refresh })
        });
        const data = await response.json();
        if (data.access) {
            localStorage.setItem('access_token', data.access);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[api-helper] Token refresh error:', error);
        return false;
    }
};
