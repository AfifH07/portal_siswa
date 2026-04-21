// =============================================================
// apiFetch.js — Single Source of Truth for ALL API requests
// v=20260327 - Fixed auto-logout loop on 401
// =============================================================
// Provides:
//   window.apiFetch(path, options)  -> returns raw Response
//   window.apiCall(path, options)   -> returns parsed JSON
//   window.clearAuth()              -> clears all auth data
//
// REQUIRED: apiConfig.js must be loaded BEFORE this file!
// Script order: apiConfig.js → apiFetch.js → auth-check.js
// =============================================================

// Prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise = null;

/**
 * Read CSRF token from cookie set by Django.
 */
function getCSRFToken() {
    const name = 'csrftoken';
    const decodedCookie = decodeURIComponent(document.cookie);
    const ca = decodedCookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(name + '=') === 0) {
            return c.substring(name.length + 1, c.length);
        }
    }
    return null;
}

/**
 * Clear all authentication data from localStorage.
 */
function clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('login_timestamp');
}

/**
 * Check if user just logged in recently (within last 30 seconds).
 * Prevents auto-logout loop on page load.
 */
function isRecentLogin() {
    const loginTimestamp = localStorage.getItem('login_timestamp');
    if (!loginTimestamp) return false;
    const elapsed = Date.now() - parseInt(loginTimestamp, 10);
    return elapsed < 30000; // 30 seconds grace period
}

/**
 * Core API fetch wrapper. ALL API calls should go through this function.
 *
 * - Builds the full URL via API_CONFIG.buildUrl()
 * - Attaches Bearer token from localStorage
 * - Attaches X-CSRFToken for non-GET methods
 * - Handles 401 with automatic token refresh + retry
 * - Redirects to /login on auth failure
 *
 * @param {string} path  - API path (e.g. 'users/me/' or '/students/classes/')
 * @param {object} options - Standard fetch options (method, body, headers, etc.)
 * @returns {Promise<Response|null>} - The fetch Response, or null on auth failure
 */
window.apiFetch = async function(path, options = {}) {
    // ========================================
    // SAFETY CHECK: Validate API_CONFIG exists
    // ========================================
    if (typeof window.API_CONFIG === 'undefined') {
        const errorMsg = '[apiFetch] FATAL: window.API_CONFIG tidak ditemukan! Pastikan apiConfig.js di-load sebelum apiFetch.js.';
        console.error(errorMsg);
        console.error('[apiFetch] Script order yang benar: apiConfig.js → apiFetch.js → auth-check.js');
        throw new Error('Konfigurasi API tidak tersedia. Silakan refresh halaman atau hubungi administrator.');
    }

    if (typeof window.API_CONFIG.buildUrl !== 'function') {
        const errorMsg = '[apiFetch] FATAL: window.API_CONFIG.buildUrl bukan function!';
        console.error(errorMsg);
        console.error('[apiFetch] API_CONFIG object:', window.API_CONFIG);
        throw new Error('Konfigurasi API tidak valid. Silakan refresh halaman.');
    }

    // Build URL safely
    const url = window.API_CONFIG.buildUrl(path);

    // Debug: Log final URL being fetched
    console.log('[apiFetch] Path:', path);
    console.log('[apiFetch] Final URL:', url);

    // Warn if double /api/ detected
    if (url.includes('/api/api/')) {
        console.error('[apiFetch] WARNING: Double /api/ detected in URL!', url);
        console.error('[apiFetch] Path should NOT include /api/ prefix. Use:', path.replace('/api/', '/'));
    }

    const token = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    // Determine if this is a critical auth endpoint that should trigger logout on 401
    const isCriticalAuthEndpoint = path.includes('users/me') || path.includes('auth/status');

    // Check if body is FormData - don't set Content-Type for multipart uploads
    const isFormData = options.body instanceof FormData;

    const headers = {
        // Don't set Content-Type for FormData - browser will set it with boundary
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach CSRF token for state-changing methods
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const csrftoken = getCSRFToken();
        if (csrftoken) {
            headers['X-CSRFToken'] = csrftoken;
        }
    }

    const fetchOptions = {
        ...options,
        headers: headers,
        credentials: 'include'  // Required for CSRF cookies to be sent
    };

    try {
        const response = await fetch(url, fetchOptions);

        if (response.status === 401) {
            console.warn('[apiFetch] 401 received for:', path);

            // SAFEGUARD: Never auto-logout if user just logged in
            if (isRecentLogin()) {
                console.warn('[apiFetch] Recent login detected - skipping redirect, returning 401 response');
                return response; // Let calling code handle the 401
            }

            if (!refreshToken) {
                console.warn('[apiFetch] No refresh token available');
                // Only redirect for critical endpoints AND if not recent login
                if (isCriticalAuthEndpoint && !isRecentLogin()) {
                    console.warn('[apiFetch] Critical endpoint failed, redirecting to login');
                    clearAuth();
                    window.location.href = '/login';
                }
                return response; // Return original response instead of null
            }

            // Prevent multiple simultaneous refresh attempts
            if (isRefreshing) {
                console.log('[apiFetch] Refresh already in progress, waiting...');
                try {
                    await refreshPromise;
                    // After refresh completes, retry with new token
                    const newToken = localStorage.getItem('access_token');
                    if (newToken) {
                        const retryResponse = await fetch(url, {
                            ...fetchOptions,
                            headers: { ...headers, 'Authorization': `Bearer ${newToken}` }
                        });
                        return retryResponse;
                    }
                } catch (e) {
                    console.warn('[apiFetch] Waiting for refresh failed:', e);
                }
                return response;
            }

            // Start refresh process
            isRefreshing = true;
            refreshPromise = (async () => {
                try {
                    const refreshUrl = window.API_CONFIG.buildUrl('auth/token/refresh/');
                    const refreshResponse = await fetch(refreshUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCSRFToken() || ''
                        },
                        credentials: 'include',
                        body: JSON.stringify({ refresh: refreshToken })
                    });

                    if (refreshResponse.ok) {
                        const data = await refreshResponse.json();
                        localStorage.setItem('access_token', data.access);
                        console.log('[apiFetch] Token refreshed successfully');
                        return data.access;
                    } else {
                        console.warn('[apiFetch] Token refresh failed:', refreshResponse.status);
                        return null;
                    }
                } catch (refreshError) {
                    console.error('[apiFetch] Token refresh error:', refreshError);
                    return null;
                } finally {
                    isRefreshing = false;
                    refreshPromise = null;
                }
            })();

            const newAccessToken = await refreshPromise;

            if (newAccessToken) {
                // Retry original request with new token
                const retryResponse = await fetch(url, {
                    ...fetchOptions,
                    headers: { ...headers, 'Authorization': `Bearer ${newAccessToken}` }
                });
                return retryResponse;
            } else {
                // Refresh failed - but DON'T auto-logout for non-critical endpoints
                if (isCriticalAuthEndpoint) {
                    console.warn('[apiFetch] Critical endpoint refresh failed, redirecting to login');
                    clearAuth();
                    window.location.href = '/login';
                    return null;
                }
                // For non-critical endpoints, return the original 401 response
                console.warn('[apiFetch] Non-critical endpoint 401 - letting caller handle it');
                return response;
            }
        }

        return response;
    } catch (error) {
        console.error('[apiFetch] Request error for', url, ':', error);
        throw error;
    }
};

/**
 * Convenience wrapper that calls apiFetch and returns parsed JSON.
 * Used by auth.js (login/logout) and students.js.
 *
 * @param {string} path    - API path
 * @param {object} options - Standard fetch options
 * @returns {Promise<any>} - Parsed JSON response
 */
window.apiCall = async function(path, options = {}) {
    const response = await window.apiFetch(path, options);
    if (!response) {
        throw new Error('Authentication failed');
    }
    return response.json();
};

// Export globals
window.clearAuth = clearAuth;
window.getCSRFToken = getCSRFToken;
