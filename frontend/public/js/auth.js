window.addEventListener('load', async function() {
    // Only prefetch CSRF token if cookie doesn't exist (to avoid rate limiting)
    const existingCSRF = document.cookie.split(';').some(c => c.trim().startsWith('csrftoken='));
    if (!existingCSRF) {
        try {
            await fetch(window.API_CONFIG.buildUrl('auth/csrf/'), {
                method: 'GET',
                credentials: 'include'
            });
            console.log('[Auth] CSRF cookie initialized on page load');
        } catch (e) {
            console.warn('[Auth] Failed to prefetch CSRF token:', e);
        }
    } else {
        console.log('[Auth] CSRF cookie already exists, skipping prefetch');
    }

    // getCSRFToken is provided globally by apiFetch.js

    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('toggle-password');
    const rememberCheckbox = document.getElementById('remember');
    const errorMessage = document.getElementById('error-message');
    const btnLogin = document.querySelector('.btn-login');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');
    
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.innerHTML = type === 'password' ? '👁️' : '👁️';
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const remember = rememberCheckbox.checked;
            
            if (!username || !password) {
                showError('Username dan password harus diisi');
                return;
            }
            
            await handleLogin(username, password, remember);
        });
    }
    
    // Forgot password link - no interceptor needed, uses native href navigation
    // The link in login.html points directly to /forgot-password/

    checkAuthAndRedirect();
});

async function handleLogin(username, password, remember) {
    const btnLogin = document.querySelector('.btn-login');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');
    
    btnLogin.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    hideError();

    // CSRF token is prefetched on page load, but ensure it exists
    if (!window.getCSRFToken()) {
        try {
            await fetch(window.API_CONFIG.buildUrl('auth/csrf/'), {
                method: 'GET',
                credentials: 'include'
            });
        } catch (e) {
            console.warn('[Auth] CSRF prefetch failed:', e);
        }
    }

    try {
        const data = await apiCall('auth/login/', {
            method: 'POST',
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (data.success) {
            localStorage.setItem('access_token', data.access);
            localStorage.setItem('refresh_token', data.refresh);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('user_role', data.user.role);
            localStorage.setItem('user_name', data.user.name);
            localStorage.setItem('user_username', data.user.username);
            // Timestamp to prevent instant auto-logout loop
            localStorage.setItem('login_timestamp', Date.now().toString());

            if (remember) {
                sessionStorage.setItem('remember_me', 'true');
            }

            console.log('[Auth] Login successful for role:', data.user.role);
            const redirectUrl = data.redirect || '/dashboard';
            window.location.href = redirectUrl;
        } else {
            showError('Username atau password salah');
            resetButton();
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Terjadi kesalahan. Silakan coba lagi.');
        resetButton();
    }
}

function resetButton() {
    const btnLogin = document.querySelector('.btn-login');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');
    
    btnLogin.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('span');
    
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    
    setTimeout(() => {
        hideError();
    }, 5000);
}

function hideError() {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}

// clearAuth, apiCall, getCSRFToken, getUser, getUserRole, isAuthenticated
// are all provided globally by apiFetch.js and auth-check.js — no duplicates here.

function checkAuthAndRedirect() {
    const accessToken = localStorage.getItem('access_token');
    const currentPath = window.location.pathname;

    if (currentPath === '/login/' || currentPath === '/login') {
        return;
    }

    if (accessToken) {
        const role = window.getUserRole ? window.getUserRole() : localStorage.getItem('user_role');

        if (currentPath === '/') {
            const redirectUrl = role === 'pendaftar' ? '/registration' : '/dashboard';
            window.location.href = redirectUrl;
        }
    }
}

window.handleLogin = handleLogin;
window.showError = showError;
window.resetButton = resetButton;