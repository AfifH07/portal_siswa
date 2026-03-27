document.addEventListener('DOMContentLoaded', async function() {
    console.log('[AUTH_CHECK] loaded:', window.location.pathname);
    await checkAuthAndRedirect();
    checkPageAccess();
});

async function checkAuthAndRedirect() {
    const currentPath = window.location.pathname;

    if (currentPath === '/login' || currentPath === '/login/' || currentPath === '/registration' || currentPath === '/registration/') {
        console.log('[AUTH_CHECK] On auth page, skipping redirect');
        return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.log('[AUTH_CHECK] No access token, redirecting to login');
        window.location.href = '/login';
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/users/me/`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.log('[AUTH_CHECK] Token expired, redirecting to login');
                clearAuth();
                window.location.href = '/login';
                return { success: false, error: 'Token expired' };
            }
            throw new Error('Gagal memuat data pengguna');
        }

        const data = await response.json();

        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_name', data.username || data.name);

        if (data.email) {
            localStorage.setItem('user_email', data.email);
        }

        const redirectMap = {
            'superadmin': '/dashboard/admin',
            'pimpinan': '/dashboard/pimpinan',
            'guru': '/dashboard/guru',
            'walisantri': '/dashboard/walisantri',
            'pendaftar': '/registration'
        };

        if (currentPath === '/') {
            const redirectUrl = redirectMap[data.role] || '/dashboard';
            console.log('[AUTH_CHECK] Redirecting to role page:', redirectUrl);
            window.location.href = redirectUrl;
            return { success: true, user: data };
        }

        return { success: true, user: data };

    } catch (error) {
        console.error('[AUTH_CHECK] Error checking auth:', error);
        clearAuth();
        window.location.href = '/login';
        return { success: false, error: error.message };
    }
}

function clearAuth() {
    console.log('[AUTH_CHECK] Clearing auth data');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_username');
}

function checkPageAccess() {
    const userRole = localStorage.getItem('user_role');
    const currentPath = window.location.pathname;

    if (currentPath === '/login' || currentPath === '/login/' || currentPath === '/registration' || currentPath === '/registration/') {
        return;
    }

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        window.location.href = '/login';
        return;
    }

    const roleAccess = {
        'superadmin': ['/', '/dashboard', '/dashboard/admin', '/dashboard/pimpinan', '/dashboard/guru', '/dashboard/walisantri', '/students', '/attendance', '/grades', '/evaluations', '/registration'],
        'pimpinan': ['/', '/dashboard', '/dashboard/pimpinan', '/students', '/attendance', '/grades', '/evaluations'],
        'guru': ['/', '/dashboard', '/dashboard/guru', '/students', '/attendance', '/grades', '/evaluations'],
        'walisantri': ['/', '/dashboard', '/dashboard/walisantri', '/students', '/attendance', '/grades', '/evaluations'],
        'pendaftar': ['/registration']
    };

    if (!userRole) {
        return;
    }

    const allowedPaths = roleAccess[userRole] || [];

    const isAllowed = allowedPaths.some(path => {
        if (path === currentPath) return true;
        if (path.endsWith('/')) {
            return currentPath.startsWith(path.slice(0, -1));
        }
        return currentPath.startsWith(path + '/');
    });

    if (!isAllowed) {
        const redirectMap = {
            'superadmin': '/dashboard',
            'pimpinan': '/dashboard',
            'guru': '/dashboard',
            'walisantri': '/dashboard',
            'pendaftar': '/registration'
        };
        window.location.href = redirectMap[userRole] || '/dashboard';
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

    const rolePermissions = {
        'superadmin': ['create', 'read', 'update', 'delete', 'view_all'],
        'pimpinan': ['read', 'update', 'view_all'],
        'guru': ['create', 'read', 'update', 'view_class'],
        'walisantri': ['read', 'view_child'],
        'pendaftar': ['register']
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

    const navItems = {
        'superadmin': [
            { href: '/dashboard', icon: '📊', label: 'Dashboard' },
            { href: '/students', icon: '👥', label: 'Siswa' },
            { href: '/attendance', icon: '📚', label: 'Absensi' },
            { href: '/grades', icon: '📝', label: 'Nilai' },
            { href: '/evaluations', icon: '⭐', label: 'Evaluasi' }
        ],
        'pimpinan': [
            { href: '/dashboard', icon: '📊', label: 'Dashboard' },
            { href: '/students', icon: '👥', label: 'Data Siswa' },
            { href: '/attendance', icon: '📚', label: 'Absensi' },
            { href: '/grades', icon: '📝', label: 'Nilai' },
            { href: '/evaluations', icon: '⭐', label: 'Evaluasi' }
        ],
        'guru': [
            { href: '/dashboard', icon: '📊', label: 'Dashboard' },
            { href: '/students', icon: '👥', label: 'Data Siswa' },
            { href: '/attendance', icon: '📚', label: 'Absensi' },
            { href: '/grades', icon: '📝', label: 'Nilai' },
            { href: '/evaluations', icon: '⭐', label: 'Evaluasi' }
        ],
        'walisantri': [
            { href: '/dashboard', icon: '📊', label: 'Dashboard' },
            { href: '/students', icon: '👥', label: 'Ananda' },
            { href: '/attendance', icon: '📚', label: 'Absensi' },
            { href: '/grades', icon: '📝', label: 'Nilai' },
            { href: '/evaluations', icon: '⭐', label: 'Evaluasi' }
        ],
        'pendaftar': []
    };

    const items = navItems[userRole] || [];

    nav.innerHTML = '';

    items.forEach(item => {
        const link = document.createElement('a');
        link.href = item.href;
        link.className = 'nav-item';
        if (window.location.pathname === item.href || (window.location.pathname.startsWith(item.href) && item.href !== '/')) {
            link.classList.add('active');
        }
        link.innerHTML = `<span>${item.icon}</span> ${item.label}`;
        nav.appendChild(link);
    });
}

function updateUserName() {
    const userName = localStorage.getItem('user_name');
    const userNameDisplay = document.getElementById('user-name-display');

    if (userNameDisplay && userName) {
        userNameDisplay.textContent = userName;
    }
}

async function logout() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        const logoutResponse = await fetch(
            window.API_CONFIG && window.API_CONFIG.buildUrl
                ? window.API_CONFIG.buildUrl('auth/logout/')
                : 'auth/logout/',
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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_username');
        window.location.href = '/login';
    }
}

async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers: headers
        });
        
        if (response.status === 401 && token) {
            try {
                const refreshResponse = await fetch(
                    window.API_CONFIG && window.API_CONFIG.buildUrl
                        ? window.API_CONFIG.buildUrl('auth/token/refresh/')
                        : 'auth/token/refresh/',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            refresh: localStorage.getItem('refresh_token')
                        })
                    }
                );
                
                if (refreshResponse.ok) {
                    const data = await refreshResponse.json();
                    localStorage.setItem('access_token', data.access);
                    
                    headers['Authorization'] = `Bearer ${data.access}`;
                    const retryResponse = await fetch(url, {
                        ...options,
                        headers: headers
                    });
                    return retryResponse;
                }
            } catch (refreshError) {
                console.error('Token refresh error:', refreshError);
            }
            
            logout();
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API fetch error:', error);
        throw error;
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastMessage) {
        console.log('Toast:', message, type);
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

window.getUserRole = getUserRole;
window.getUser = getUser;
window.isAuthenticated = isAuthenticated;
window.hasPermission = hasPermission;
window.showElementByRole = showElementByRole;
window.hideElementByRole = hideElementByRole;
window.createRoleBasedNav = createRoleBasedNav;
window.updateUserName = updateUserName;
window.logout = logout;
window.apiFetch = apiFetch;
window.showToast = showToast;
