document.addEventListener('DOMContentLoaded', async function() {
    await checkAuthAndRedirect();

    // Verify role with backend to ensure sync
    await verifyRoleWithBackend();

    checkPageAccess();

    // Auto-initialize sidebar and user display on ALL pages
    // This ensures consistent navigation regardless of which page is loaded
    if (typeof createRoleBasedNav === 'function') {
        createRoleBasedNav();
    }
    if (typeof updateUserName === 'function') {
        updateUserName();
    }

    // Load active Tahun Ajaran for global header display
    loadActiveTahunAjaran();
});

/**
 * Check if current page is an admin-only page where walisantri
 * initialization should be skipped.
 * @returns {boolean} true if on admin page
 */
function isAdminPage() {
    const path = window.location.pathname;
    const adminPaths = ['/users/', '/users', '/admin/', '/admin'];
    return adminPaths.some(p => path.startsWith(p) || path === p);
}

/**
 * Check if walisantri-specific initialization should run.
 * Returns false for admin pages to prevent loading overlay issues.
 * @returns {boolean} true if walisantri init should run
 */
function shouldRunWalisantriInit() {
    // Skip on admin pages
    if (isAdminPage()) {
        console.log('[AUTH_CHECK] Skipping walisantri init on admin page');
        return false;
    }
    return true;
}

// Export for use in other scripts
window.isAdminPage = isAdminPage;
window.shouldRunWalisantriInit = shouldRunWalisantriInit;

async function checkAuthAndRedirect() {
    const currentPath = window.location.pathname;

    // Skip auth check on public pages
    const publicPaths = ['/login', '/login/', '/registration', '/registration/', '/forgot-password', '/forgot-password/'];
    if (publicPaths.includes(currentPath)) {
        return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.warn('[AUTH_CHECK] No access token found, redirecting to login');
        window.location.href = '/login';
        return;
    }

    try {
        const response = await window.apiFetch('users/me/');

        // Handle null response (apiFetch returns null on auth failure after refresh attempt)
        if (!response) {
            console.warn('[AUTH_CHECK] apiFetch returned null (auth failed)');
            return { success: false, error: 'Auth refresh failed' };
        }

        if (!response.ok) {
            if (response.status === 401) {
                // 401 is already handled by apiFetch with token refresh
                // If we get here, refresh failed and apiFetch already redirected
                console.warn('[AUTH_CHECK] 401 received - token expired');
                return { success: false, error: 'Token expired' };
            }
            // For other errors (500, 503, etc.), don't logout - use cached data
            console.warn('[AUTH_CHECK] Server error:', response.status, '- using cached data');
            return { success: false, error: `Server error: ${response.status}` };
        }

        const data = await response.json();

        // Update localStorage with fresh data
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_name', data.name || data.username);

        if (data.email) {
            localStorage.setItem('user_email', data.email);
        }

        // Single /dashboard/ entry point with role param for dynamic rendering
        if (currentPath === '/') {
            if (data.role === 'pendaftar') {
                window.location.href = '/registration';
            } else {
                window.location.href = '/dashboard/';
            }
            return { success: true, user: data };
        }

        return { success: true, user: data };

    } catch (error) {
        console.error('[AUTH_CHECK] Network/fetch error:', error);

        // DON'T logout on network errors - use cached data instead
        const cachedUser = localStorage.getItem('user');
        const cachedRole = localStorage.getItem('user_role');

        if (cachedUser && cachedRole) {
            console.warn('[AUTH_CHECK] Using cached user data due to network error');
            return { success: true, user: JSON.parse(cachedUser), cached: true };
        }

        // Only redirect to login if we have no cached data at all
        // SAFEGUARD: Don't logout if user just logged in (prevents loop)
        const loginTimestamp = localStorage.getItem('login_timestamp');
        const isRecentLogin = loginTimestamp && (Date.now() - parseInt(loginTimestamp, 10)) < 30000;
        if (isRecentLogin) {
            console.warn('[AUTH_CHECK] Recent login detected - skipping forced logout despite no cached data');
            return { success: false, error: error.message, recentLogin: true };
        }
        console.error('[AUTH_CHECK] No cached data available, redirecting to login');
        clearAuth();
        window.location.href = '/login';
        return { success: false, error: error.message };
    }
}

// clearAuth() is provided globally by apiFetch.js — no duplicate needed here

/**
 * Verify that the role stored in LocalStorage matches the database.
 * This prevents tampering and ensures role changes are reflected immediately.
 */
async function verifyRoleWithBackend() {
    const currentPath = window.location.pathname;

    // Skip verification on public pages
    const publicPaths = ['/login', '/login/', '/registration', '/registration/', '/forgot-password', '/forgot-password/'];
    if (publicPaths.includes(currentPath)) {
        return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        return;
    }

    try {
        const response = await window.apiFetch('auth/status/');

        // Handle null response (auth refresh failed - apiFetch already handled redirect)
        if (!response) {
            console.warn('[AUTH] apiFetch returned null during role verification');
            return null;
        }

        if (!response.ok) {
            if (response.status === 401) {
                // 401 already handled by apiFetch - just return
                console.warn('[AUTH] 401 during role verification - refresh should have handled it');
                return null;
            }
            // For other errors (500, 503), don't logout - use cached data
            console.warn('[AUTH] Server error during role verification:', response.status);
            return null;
        }

        const data = await response.json();

        // Check if user is still valid/active
        if (!data.valid) {
            console.warn('[AUTH] User is no longer active');
            // SAFEGUARD: Don't logout if user just logged in (prevents loop)
            const loginTimestamp = localStorage.getItem('login_timestamp');
            const isRecentLogin = loginTimestamp && (Date.now() - parseInt(loginTimestamp, 10)) < 30000;
            if (isRecentLogin) {
                console.warn('[AUTH] Recent login detected - skipping forced logout');
                return null;
            }
            clearAuth();
            window.location.href = '/login';
            return;
        }

        const localRole = localStorage.getItem('user_role');
        const serverRole = data.role;

        // Sync role if different
        if (localRole !== serverRole) {
            console.warn(`[AUTH] Role mismatch: local="${localRole}", server="${serverRole}". Syncing...`);
            localStorage.setItem('user_role', serverRole);
            localStorage.setItem('user_permissions', JSON.stringify(data.permissions || []));
            localStorage.setItem('user_allowed_pages', JSON.stringify(data.allowed_pages || []));

            // Refresh nav if role changed
            if (typeof createRoleBasedNav === 'function') {
                createRoleBasedNav();
            }
        }

        // Store permissions and allowed pages from backend
        if (data.permissions) {
            localStorage.setItem('user_permissions', JSON.stringify(data.permissions));
        }
        if (data.allowed_pages) {
            localStorage.setItem('user_allowed_pages', JSON.stringify(data.allowed_pages));
        }

        return data;

    } catch (error) {
        console.error('[AUTH] Network error verifying role:', error);
        // Don't redirect on error - allow cached role to work
        return null;
    }
}

/**
 * Get allowed pages from backend or fallback to hardcoded defaults.
 */
function getAllowedPages(role) {
    // Try to get from localStorage (synced from backend)
    const cachedPages = localStorage.getItem('user_allowed_pages');
    if (cachedPages) {
        try {
            return JSON.parse(cachedPages);
        } catch (e) {
            // Fall through to defaults
        }
    }

    // Fallback: hardcoded defaults (kept in sync with backend)
    const roleAccess = {
        'superadmin': ['/', '/dashboard', '/dashboard/admin', '/dashboard/pimpinan', '/dashboard/guru', '/dashboard/walisantri', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/grades', '/hafalan', '/evaluations', '/registration', '/finance', '/users', '/jadwal-mengajar', '/master-mapel', '/blp', '/inval', '/ibadah', '/evaluasi-asatidz', '/case-management'],
        'pimpinan': ['/', '/dashboard', '/dashboard/pimpinan', '/dashboard/parent', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/grades', '/hafalan', '/evaluations', '/finance', '/ibadah', '/blp', '/evaluasi-asatidz', '/case-management'],
        'guru': ['/', '/dashboard', '/dashboard/guru', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/grades', '/hafalan', '/evaluations', '/inval', '/evaluasi-asatidz', '/case-management', '/kelas-saya'],
        'musyrif': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/grades', '/hafalan', '/evaluations', '/inval', '/evaluasi-asatidz', '/case-management'],
        'bk': ['/', '/dashboard', '/dashboard/ustadz', '/students', '/attendance', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/grades', '/hafalan', '/evaluations', '/evaluasi-asatidz', '/case-management'],
        'bendahara': ['/', '/dashboard', '/jurnal-piket', '/titipan-tugas', '/izin-guru', '/finance'],
        'walisantri': ['/', '/dashboard', '/dashboard/walisantri', '/dashboard/parent', '/attendance', '/grades', '/hafalan', '/evaluations', '/finance', '/ibadah', '/blp', '/case-management'],
        'pendaftar': ['/registration']
    };

    return roleAccess[role] || [];
}

function checkPageAccess() {
    const userRole = localStorage.getItem('user_role');
    const currentPath = window.location.pathname;

    // Skip on public pages
    const publicPaths = ['/login', '/login/', '/registration', '/registration/', '/forgot-password', '/forgot-password/'];
    if (publicPaths.includes(currentPath)) {
        return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        window.location.href = '/login';
        return;
    }

    if (!userRole) {
        return;
    }

    // Use getAllowedPages which syncs with backend
    const allowedPaths = getAllowedPages(userRole);

    const isAllowed = allowedPaths.some(path => {
        if (path === currentPath) return true;
        if (path.endsWith('/')) {
            return currentPath.startsWith(path.slice(0, -1));
        }
        return currentPath.startsWith(path + '/');
    });

    if (!isAllowed) {
        // Redirect to single /dashboard/ entry with role param
        if (userRole === 'pendaftar') {
            window.location.href = '/registration';
        } else {
            window.location.href = '/dashboard/';
        }
    }
}

function getUserRole() {
    return localStorage.getItem('user_role') || null;
}

function getUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        return JSON.parse(userStr);
    }
    return null;
}

function isAuthenticated() {
    return !!localStorage.getItem('access_token');
}

function hasPermission(permission) {
    const role = getUserRole();
    if (!role) return false;

    // Try to get from localStorage (synced from backend)
    const cachedPermissions = localStorage.getItem('user_permissions');
    if (cachedPermissions) {
        try {
            const permissions = JSON.parse(cachedPermissions);
            return permissions.includes(permission);
        } catch (e) {
            // Fall through to defaults
        }
    }

    // Fallback: hardcoded defaults (kept in sync with backend)
    const rolePermissions = {
        'superadmin': ['create', 'read', 'update', 'delete', 'view_all', 'manage_users', 'manage_finance'],
        'pimpinan': ['read', 'update', 'view_all', 'approve', 'view_finance'],
        'guru': ['create', 'read', 'update', 'view_class'],
        'bendahara': ['create', 'read', 'update', 'view_finance', 'manage_finance'],
        'walisantri': ['read', 'view_child', 'view_finance'],
        'pendaftar': ['register', 'view_registration']
    };

    const permissions = rolePermissions[role] || [];
    return permissions.includes(permission);
}

function showElementByRole(elementId, allowedRoles) {
    const userRole = getUserRole();
    const element = document.getElementById(elementId);

    if (!element) return;

    if (allowedRoles.includes(userRole)) {
        element.style.display = '';
    } else {
        element.style.display = 'none';
    }
}

function hideElementByRole(elementId, deniedRoles) {
    const userRole = getUserRole();
    const element = document.getElementById(elementId);

    if (!element) return;

    if (deniedRoles.includes(userRole)) {
        element.style.display = 'none';
    } else {
        element.style.display = '';
    }
}

function createRoleBasedNav() {
    const userRole = getUserRole();
    const nav = document.querySelector('.sidebar-nav');

    if (!nav) return;

    // Define menu structure with Lucide icon names
    // Icons: https://lucide.dev/icons
    const navConfig = {
        'superadmin': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/students', icon: 'users', label: 'Siswa' },
                { href: '/attendance', icon: 'calendar-check', label: 'Jurnal Guru' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' },
                { href: '/grades', icon: 'file-text', label: 'Nilai' },
                { href: '/hafalan', icon: 'book-open', label: 'Hafalan', id: 'nav-hafalan' }
            ],
            admin: [
                { href: '/users', icon: 'user-cog', label: 'Manajemen User' },
                { href: '/jadwal-mengajar', icon: 'calendar-clock', label: 'Jadwal Mengajar' },
                { href: '/master-mapel', icon: 'book-open', label: 'Master Mapel' }
            ],
            hr: [
                { href: '/evaluasi-asatidz', icon: 'user-check', label: 'Evaluasi Asatidz' }
            ],
            other: [
                { href: '/evaluations', icon: 'star', label: 'Evaluasi' },
                { href: '/finance', icon: 'wallet', label: 'Keuangan', id: 'nav-finance' }
            ]
        },
        'pimpinan': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/students', icon: 'users', label: 'Data Siswa' },
                { href: '/attendance', icon: 'calendar-check', label: 'Jurnal Guru' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' },
                { href: '/grades', icon: 'file-text', label: 'Nilai' },
                { href: '/hafalan', icon: 'book-open', label: 'Hafalan', id: 'nav-hafalan' }
            ],
            hr: [
                { href: '/evaluasi-asatidz', icon: 'user-check', label: 'Evaluasi Asatidz' }
            ],
            other: [
                { href: '/evaluations', icon: 'star', label: 'Evaluasi' },
                { href: '/finance', icon: 'wallet', label: 'Keuangan', id: 'nav-finance' }
            ]
        },
        'guru': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/students', icon: 'users', label: 'Data Santri' },
                { href: '/attendance', icon: 'calendar-check', label: 'Jurnal Guru' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' },
                { href: '/grades', icon: 'file-text', label: 'Nilai' }
            ],
            kesantrian: [
                { href: '/hafalan', icon: 'book-open', label: 'Hafalan & Ziyadah', id: 'nav-hafalan' }
            ],
            other: [
                { href: '/evaluations', icon: 'star', label: 'Evaluasi Santri' },
                { href: '/evaluasi-asatidz', icon: 'clipboard-check', label: 'Evaluasi Saya' }
            ]
        },
        'musyrif': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/students', icon: 'users', label: 'Data Santri' },
                { href: '/attendance', icon: 'calendar-check', label: 'Jurnal Guru' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' },
                { href: '/grades', icon: 'file-text', label: 'Nilai' }
            ],
            kesantrian: [
                { href: '/hafalan', icon: 'book-open', label: 'Hafalan & Ziyadah', id: 'nav-hafalan' }
            ],
            other: [
                { href: '/evaluations', icon: 'star', label: 'Evaluasi Santri' },
                { href: '/evaluasi-asatidz', icon: 'clipboard-check', label: 'Evaluasi Saya' }
            ]
        },
        'bk': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/students', icon: 'users', label: 'Data Santri' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' },
                { href: '/case-management', icon: 'folder-open', label: 'Pembinaan' }
            ],
            other: [
                { href: '/evaluations', icon: 'star', label: 'Evaluasi' },
                { href: '/evaluasi-asatidz', icon: 'clipboard-check', label: 'Evaluasi Saya' }
            ]
        },
        'bendahara': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/jurnal-piket', icon: 'clipboard-list', label: 'Jurnal Piket' },
                { href: '/titipan-tugas', icon: 'bookmark', label: 'Titipan Tugas' },
                { href: '/izin-guru', icon: 'file-text', label: 'Izin Guru' }
            ],
            other: [
                { href: '/finance', icon: 'wallet', label: 'Keuangan', id: 'nav-finance' }
            ]
        },
        'walisantri': {
            main: [
                { href: '/dashboard/', icon: 'layout-dashboard', label: 'Dashboard' },
                { href: '/attendance', icon: 'calendar-check', label: 'Kehadiran' },
                { href: '/ibadah', icon: 'moon', label: 'Ibadah' },
                { href: '/grades', icon: 'file-text', label: 'Akademik' },
                { href: '/hafalan', icon: 'book-open', label: 'Hafalan', id: 'nav-hafalan' },
                { href: '/blp', icon: 'award', label: 'Karakter (BLP)', id: 'nav-blp' },
                { href: '/finance', icon: 'credit-card', label: 'Tagihan', id: 'nav-finance' }
            ],
            other: []
        },
        'pendaftar': { main: [], other: [] }
    };

    const config = navConfig[userRole] || { main: [], other: [] };
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/'; // Normalize path

    nav.innerHTML = '';

    // Helper to check if path is active
    function isActive(itemHref) {
        const normalizedHref = itemHref.replace(/\/$/, '') || '/';

        // Dashboard special case
        if (normalizedHref === '/dashboard') {
            return currentPath === '/dashboard' || currentPath.startsWith('/dashboard/') || currentPath === '/dashboard';
        }

        // Exact match or starts with (for sub-paths)
        return currentPath === normalizedHref ||
               (normalizedHref !== '/' && currentPath.startsWith(normalizedHref + '/')) ||
               (normalizedHref !== '/' && currentPath.startsWith(normalizedHref));
    }

    // Helper to create nav item with Lucide icon
    function createNavItem(item) {
        const link = document.createElement('a');

        link.href = item.href;

        link.className = 'nav-item';
        if (item.id) link.id = item.id;

        if (isActive(item.href)) {
            link.classList.add('active');
        }

        // Use Lucide icon syntax: <i data-lucide="icon-name"></i>
        link.innerHTML = `<i data-lucide="${item.icon}" class="nav-icon"></i><span class="nav-label-text">${item.label}</span>`;
        return link;
    }

    // Render "Menu Utama" section
    if (config.main && config.main.length > 0) {
        const mainLabel = document.createElement('div');
        mainLabel.className = 'nav-label';
        mainLabel.textContent = 'Menu Utama';
        nav.appendChild(mainLabel);

        config.main.forEach(item => {
            nav.appendChild(createNavItem(item));
        });
    }

    // Render "Kesantrian" section (for guru/musyrif roles)
    if (config.kesantrian && config.kesantrian.length > 0) {
        const kesantrianLabel = document.createElement('div');
        kesantrianLabel.className = 'nav-label';
        kesantrianLabel.textContent = 'Kesantrian';
        nav.appendChild(kesantrianLabel);

        config.kesantrian.forEach(item => {
            nav.appendChild(createNavItem(item));
        });
    }

    // Render "Administrasi" section (for superadmin)
    if (config.admin && config.admin.length > 0) {
        const adminLabel = document.createElement('div');
        adminLabel.className = 'nav-label';
        adminLabel.textContent = 'Administrasi';
        nav.appendChild(adminLabel);

        config.admin.forEach(item => {
            nav.appendChild(createNavItem(item));
        });
    }

    // Render "HR / SDM" section (for superadmin/pimpinan)
    if (config.hr && config.hr.length > 0) {
        const hrLabel = document.createElement('div');
        hrLabel.className = 'nav-label';
        hrLabel.textContent = 'HR / SDM';
        nav.appendChild(hrLabel);

        config.hr.forEach(item => {
            nav.appendChild(createNavItem(item));
        });
    }

    // Render "Lainnya" section
    if (config.other && config.other.length > 0) {
        const otherLabel = document.createElement('div');
        otherLabel.className = 'nav-label';
        otherLabel.textContent = 'Lainnya';
        nav.appendChild(otherLabel);

        config.other.forEach(item => {
            nav.appendChild(createNavItem(item));
        });
    }

    // Initialize Lucide icons after nav is built
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    // Check for Wali Kelas status and add menu if applicable
    if (userRole === 'guru') {
        checkAndAddWaliKelasMenu(nav, createNavItem, isActive);
    }

    // Also update user role display
    updateUserRoleDisplay();
}

/**
 * Check if current guru is a wali kelas and add "Kelas Saya" menu.
 */
async function checkAndAddWaliKelasMenu(nav, createNavItem, isActive) {
    try {
        const response = await window.apiFetch('auth/my-wali-kelas/');
        if (!response || !response.ok) return;

        const data = await response.json();
        if (!data.success || !data.is_wali_kelas) return;

        // Store wali kelas info in localStorage for quick access
        localStorage.setItem('wali_kelas_info', JSON.stringify({
            kelas: data.kelas,
            tahun_ajaran: data.tahun_ajaran,
            semester: data.semester
        }));

        // Find "Kesantrian" label or "Lainnya" to insert before
        const navLabels = nav.querySelectorAll('.nav-label');
        let insertBefore = null;

        for (const label of navLabels) {
            if (label.textContent === 'Kesantrian' || label.textContent === 'Lainnya') {
                insertBefore = label;
                break;
            }
        }

        // Create "Wali Kelas" section
        const waliLabel = document.createElement('div');
        waliLabel.className = 'nav-label';
        waliLabel.textContent = 'Wali Kelas';

        const kelasSayaItem = createNavItem({
            href: '/kelas-saya',
            icon: 'school',
            label: `Kelas ${data.kelas}`
        });

        if (insertBefore) {
            nav.insertBefore(waliLabel, insertBefore);
            nav.insertBefore(kelasSayaItem, insertBefore);
        } else {
            nav.appendChild(waliLabel);
            nav.appendChild(kelasSayaItem);
        }

        // Re-init Lucide icons for new items
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        // Update role display to include wali kelas
        const roleEl = document.getElementById('user-role-display') || document.getElementById('user-role');
        if (roleEl) {
            roleEl.textContent = `Guru / Wali Kelas ${data.kelas}`;
        }

    } catch (error) {
        console.error('[AUTH] Error checking wali kelas status:', error);
    }
}

function updateUserRoleDisplay() {
    const userRole = getUserRole();
    const userName = localStorage.getItem('user_name') || 'User';

    const roleDisplayMap = {
        'superadmin': 'Super Admin',
        'pimpinan': 'Pimpinan',
        'guru': 'Guru/Ustadz',
        'musyrif': 'Musyrif',
        'bk': 'Guru BK',
        'bendahara': 'Bendahara',
        'walisantri': 'Wali Santri',
        'pendaftar': 'Pendaftar',
        'adituren': 'Alumni'
    };

    // Update user name display
    const nameEl = document.getElementById('user-name-display') || document.getElementById('user-name');
    if (nameEl) {
        nameEl.textContent = userName;
    }

    // Update role display
    const roleEl = document.getElementById('user-role-display') || document.getElementById('user-role');
    if (roleEl) {
        roleEl.textContent = roleDisplayMap[userRole] || userRole || '-';
    }

    // Update avatar initials
    const avatarEl = document.getElementById('user-avatar-initials') || document.getElementById('user-avatar');
    if (avatarEl && userName) {
        const words = userName.trim().split(' ');
        if (words.length >= 2) {
            avatarEl.textContent = (words[0][0] + words[1][0]).toUpperCase();
        } else {
            avatarEl.textContent = userName.substring(0, 2).toUpperCase();
        }
    }

    // Update children count for walisantri (read from localStorage)
    const childrenEl = document.getElementById('user-children');
    if (childrenEl && userRole === 'walisantri') {
        const childrenCount = localStorage.getItem('children_count');
        if (childrenCount && parseInt(childrenCount) > 0) {
            childrenEl.textContent = `${childrenCount} Anak Terdaftar`;
            childrenEl.style.display = 'block';
        }
    }
}

function updateUserName() {
    // Delegate to updateUserRoleDisplay for full user info update
    updateUserRoleDisplay();
}

// showToast and logout are provided globally by utils.js — no duplicate needed here

/**
 * Load and display the active Tahun Ajaran in global header.
 * Fetches from /api/core/tahun-ajaran/active/ and updates all elements with class 'topbar-academic-year'.
 */
async function loadActiveTahunAjaran() {
    // Find all academic year elements (supports multiple headers)
    const elements = document.querySelectorAll('.topbar-academic-year');

    if (elements.length === 0) {
        // No academic year display on this page, skip
        return;
    }

    // Skip on public pages (login, registration, forgot-password)
    const currentPath = window.location.pathname;
    const publicPaths = ['/login', '/login/', '/registration', '/registration/', '/forgot-password', '/forgot-password/'];
    if (publicPaths.includes(currentPath)) {
        return;
    }

    // Check if we have auth token
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        // Not logged in, show placeholder
        elements.forEach(el => {
            el.innerHTML = '📚 <strong>Tahun Akademik</strong>';
        });
        return;
    }

    try {
        const response = await window.apiFetch('core/tahun-ajaran/active/');

        if (!response) {
            console.warn('[AUTH] apiFetch returned null for tahun ajaran');
            setTahunAjaranFallback(elements);
            return;
        }

        if (!response.ok) {
            console.warn('[AUTH] Failed to fetch tahun ajaran:', response.status);
            setTahunAjaranFallback(elements);
            return;
        }

        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;
            const displayText = `📚 <strong>${data.nama}</strong> ${data.semester}`;

            elements.forEach(el => {
                el.innerHTML = displayText;
                // Add tooltip with full info
                el.title = `Tahun Akademik: ${data.nama} - Semester ${data.semester}`;

                // Add calculated warning if using fallback
                if (data.is_calculated) {
                    el.innerHTML += ' <span style="color: #f59e0b; font-size: 0.75rem;">(auto)</span>';
                    el.title += ' (Dihitung otomatis - belum ada data di database)';
                }
            });

            // Cache for offline use
            localStorage.setItem('cached_tahun_ajaran', JSON.stringify(data));

            console.log('[AUTH] Tahun Ajaran loaded:', data.nama, '-', data.semester);
        } else {
            setTahunAjaranFallback(elements);
        }

    } catch (error) {
        console.error('[AUTH] Error loading tahun ajaran:', error);
        setTahunAjaranFallback(elements);
    }
}

/**
 * Set fallback display when API fails.
 * Uses cached data or calculates from current date.
 */
function setTahunAjaranFallback(elements) {
    // Try cached data first
    const cached = localStorage.getItem('cached_tahun_ajaran');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            const displayText = `📚 <strong>${data.nama}</strong> ${data.semester} <span style="color: #9ca3af;">(offline)</span>`;
            elements.forEach(el => {
                el.innerHTML = displayText;
            });
            return;
        } catch (e) {
            // Fall through to calculation
        }
    }

    // Calculate from current date
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let nama, semester;
    if (month >= 6) { // July onwards
        nama = `${year}/${year + 1}`;
        semester = 'Ganjil';
    } else {
        nama = `${year - 1}/${year}`;
        semester = 'Genap';
    }

    const displayText = `📚 <strong>${nama}</strong> ${semester}`;
    elements.forEach(el => {
        el.innerHTML = displayText;
    });
}

window.getUserRole = getUserRole;
window.getUser = getUser;
window.isAuthenticated = isAuthenticated;
window.hasPermission = hasPermission;
window.showElementByRole = showElementByRole;
window.hideElementByRole = hideElementByRole;
window.createRoleBasedNav = createRoleBasedNav;
window.updateUserName = updateUserName;
window.updateUserRoleDisplay = updateUserRoleDisplay;
window.verifyRoleWithBackend = verifyRoleWithBackend;
window.getAllowedPages = getAllowedPages;
window.loadActiveTahunAjaran = loadActiveTahunAjaran;
// window.logout and window.showToast are provided by utils.js
