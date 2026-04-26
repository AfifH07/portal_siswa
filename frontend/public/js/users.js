/**
 * Users Management Page JavaScript
 * Portal Ponpes Baron v2.3
 *
 * Features:
 * - User directory with search & filters
 * - Create/Edit/Delete users
 * - Assign roles and tasks
 * - Reset password
 * - Activity log
 */

// ============================================
// GLOBAL STATE
// ============================================
let currentUser = null;
let usersData = [];
let mentoringOptions = [];
let masterMapelData = {}; // { kbm: [...], diniyah: [...], tahfidz: [...], umum: [...] }
let currentPage = 1;
let totalPages = 1;
let searchTimeout = null;

const API_BASE = '/api/admin';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await loadCurrentUser();

        // Check if user is superadmin
        if (!currentUser || currentUser.role !== 'superadmin') {
            document.getElementById('admin-view').style.display = 'none';
            document.getElementById('access-denied-view').style.display = 'flex';
            return;
        }

        // Load initial data
        await Promise.all([
            loadStats(),
            loadUsers(),
            loadMentoringOptions(),
            loadMasterMapel()
        ]);

        // Update topbar date
        updateTopbarDate();

        // Setup detail modal button listeners (backup for onclick)
        setupDetailModalListeners();
    } catch (error) {
        console.error('[Users] Initialization error:', error);
        // Show error state instead of staying stuck in loading
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        <div class="empty-state">
                            <div class="empty-icon">⚠️</div>
                            <h4>Gagal Memuat</h4>
                            <p>Terjadi kesalahan saat memuat data. Silakan refresh halaman.</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
});

async function loadCurrentUser() {
    try {
        const response = await window.apiFetch('users/me/');
        if (response && response.ok) {
            currentUser = await response.json();
            updateUserDisplay();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

function updateUserDisplay() {
    if (!currentUser) return;

    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    const avatarDisplay = document.getElementById('user-avatar-initials');

    if (nameDisplay) nameDisplay.textContent = currentUser.name || currentUser.username;
    if (roleDisplay) roleDisplay.textContent = formatRole(currentUser.role);
    if (avatarDisplay) avatarDisplay.textContent = getInitials(currentUser.name);
}

function updateTopbarDate() {
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = '📅 ' + now.toLocaleDateString('id-ID', options);
    }
}

// ============================================
// API FUNCTIONS
// ============================================
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.detail || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// LOAD DATA
// ============================================
async function loadStats() {
    try {
        const data = await apiRequest('/stats/');

        if (data.success) {
            const stats = data.stats;
            document.getElementById('total-users').textContent = stats.total_users || 0;
            document.getElementById('active-users').textContent = stats.active_users || 0;
            document.getElementById('unassigned-teachers').textContent = stats.unassigned_teachers || 0;

            // Calculate teachers count from role distribution
            const roleStats = stats.role_distribution || [];
            const teacherCount = roleStats
                .filter(r => ['guru', 'musyrif'].includes(r.role))
                .reduce((sum, r) => sum + r.count, 0);
            document.getElementById('total-teachers').textContent = teacherCount;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center">
                <div class="loading-spinner"></div>
                <p class="text-muted">Memuat data...</p>
            </td>
        </tr>
    `;

    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('page', currentPage);

        const search = document.getElementById('filter-search')?.value;
        if (search) params.append('search', search);

        const role = document.getElementById('filter-role')?.value;
        if (role) params.append('role', role);

        const status = document.getElementById('filter-status')?.value || 'active';
        params.append('status', status);

        const hasAssignment = document.getElementById('filter-assignment')?.value;
        if (hasAssignment) params.append('has_assignment', hasAssignment);

        const data = await apiRequest(`/users/?${params.toString()}`);

        if (data.results) {
            usersData = data.results;
            totalPages = Math.ceil(data.count / 20);
            renderUsersTable(data.results);
            updatePagination(data.count);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h4>Gagal Memuat Data</h4>
                        <p>${error.message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

async function loadMentoringOptions() {
    try {
        const data = await apiRequest('/mentoring-options/');
        if (data.success) {
            mentoringOptions = data.mentorings || [];

            // Populate mentoring dropdown
            const select = document.getElementById('assign-mentoring');
            if (select) {
                select.innerHTML = '<option value="">Pilih Mentoring</option>';
                mentoringOptions.forEach(h => {
                    select.innerHTML += `<option value="${h.id}">${h.nama} (${h.jenis})</option>`;
                });
            }
        }
    } catch (error) {
        console.error('Error loading mentoring options:', error);
    }
}

async function loadMasterMapel() {
    try {
        console.log('[Users] Loading master mapel...');
        const response = await window.apiFetch('core/master-mapel/grouped/');
        console.log('[Users] Master mapel response status:', response.status);

        if (response.ok) {
            const result = await response.json();
            masterMapelData = result.data || {};
            console.log('[Users] Master mapel loaded:', masterMapelData);
            console.log('[Users] KBM count:', (masterMapelData.kbm || []).length);
            console.log('[Users] Diniyah count:', (masterMapelData.diniyah || []).length);
            console.log('[Users] Tahfidz count:', (masterMapelData.tahfidz || []).length);
        } else {
            // Response not ok - log error
            const errorText = await response.text();
            console.error('[Users] Master mapel request failed:', response.status, errorText);
            masterMapelData = { kbm: [], diniyah: [], tahfidz: [] };
        }
    } catch (error) {
        console.error('[Users] Error loading master mapel:', error);
        masterMapelData = { kbm: [], diniyah: [], tahfidz: [] };
    }
}

/**
 * Populate mapel dropdown based on assignment type (sesi)
 */
function populateMapelDropdown(sesi) {
    console.log('[Users] populateMapelDropdown called with sesi:', sesi);
    console.log('[Users] Current masterMapelData:', masterMapelData);

    const select = document.getElementById('assign-mapel');
    if (!select) {
        console.error('[Users] assign-mapel select not found!');
        return;
    }

    select.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';

    // Map assignment type to sesi
    let mappedSesi = sesi;
    if (sesi === 'halaqoh') {
        mappedSesi = 'tahfidz';
    }
    console.log('[Users] Mapped sesi:', mappedSesi);

    const mapelList = masterMapelData[mappedSesi] || [];
    console.log('[Users] Mapel list for', mappedSesi, ':', mapelList.length, 'items');

    if (mapelList.length === 0) {
        select.innerHTML = '<option value="">Tidak ada data mapel</option>';
        console.warn('[Users] No mapel data for sesi:', mappedSesi);
        return;
    }

    mapelList.forEach(m => {
        const option = document.createElement('option');
        option.value = m.nama;
        option.textContent = m.nama;
        select.appendChild(option);
    });
    console.log('[Users] Populated', mapelList.length, 'mapel options');
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <h4>Tidak Ada Data</h4>
                        <p>Tidak ada user yang ditemukan dengan filter ini.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm">${getInitials(user.name)}</div>
                    <div class="user-info">
                        <div class="user-name-cell">${escapeHtml(user.name)}</div>
                        <div class="user-username">@${escapeHtml(user.username)}</div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge badge-role ${user.role}">${formatRole(user.role)}</span>
            </td>
            <td>
                ${renderAssignments(user)}
            </td>
            <td>
                <span class="badge badge-status ${user.is_active ? 'active' : 'inactive'}">
                    ${user.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
            </td>
            <td>
                <span class="text-muted">${user.last_login_formatted || 'Belum login'}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action" onclick="viewUser(${user.id})" title="Detail">👁️</button>
                    <button class="btn-action" onclick="editUser(${user.id})" title="Edit">✏️</button>
                    <button class="btn-action" onclick="openAssignModal(${user.id})" title="Assign">📋</button>
                    <button class="btn-action" onclick="openResetModal(${user.id}, '${escapeHtml(user.username)}')" title="Reset Password">🔑</button>
                    ${user.is_active
                        ? `<button class="btn-action btn-danger" onclick="deactivateUser(${user.id})" title="Nonaktifkan">🚫</button>`
                        : `<button class="btn-action" onclick="activateUser(${user.id})" title="Aktifkan">✅</button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
}

function renderAssignments(user) {
    const assignments = user.assignments?.filter(a => a.status === 'active') || [];

    if (assignments.length === 0) {
        if (user.kelas) {
            return `<span class="assignment-badge"><span class="badge-icon">📚</span> ${escapeHtml(user.kelas)}</span>`;
        }
        return '<span class="text-muted">-</span>';
    }

    // Show all assignments with delete button
    return `
        <div class="assignment-badges">
            ${assignments.map(a => {
                const label = a.mata_pelajaran
                    ? `${escapeHtml(a.mata_pelajaran)} - ${escapeHtml(a.kelas || '-')}`
                    : (a.kelas || a.mentoring_name || a.hari || a.assignment_type_display || '-');
                const displayLabel = escapeHtml(typeof label === 'string' ? label : '-');

                return `
                    <span class="assignment-badge" title="${escapeHtml(a.assignment_type_display || a.assignment_type)} - ${displayLabel}">
                        <span class="badge-icon">${getAssignmentIcon(a.assignment_type)}</span>
                        <span class="badge-text">${displayLabel}</span>
                        <button type="button" class="badge-delete"
                            onclick="event.stopPropagation(); confirmDeleteAssignment(${user.id}, ${a.id}, '${escapeHtml(user.name || user.username)}', '${displayLabel.replace(/'/g, "\\'")}');"
                            title="Hapus assignment">×</button>
                    </span>
                `;
            }).join('')}
        </div>
    `;
}

function updatePagination(total) {
    document.getElementById('result-count').textContent = `${total} user`;
    document.getElementById('page-info').textContent = `Halaman ${currentPage} dari ${totalPages}`;
    document.getElementById('btn-prev').disabled = currentPage <= 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;
}

// ============================================
// FILTER & SEARCH
// ============================================
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadUsers();
    }, 300);
}

function applyFilters() {
    currentPage = 1;
    loadUsers();
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadUsers();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadUsers();
    }
}

// ============================================
// CREATE USER
// ============================================
function openCreateUserModal() {
    document.getElementById('user-modal-title').textContent = 'Tambah User Baru';
    document.getElementById('form-user-id').value = '';
    document.getElementById('user-form').reset();
    document.getElementById('password-fields').style.display = 'block';
    document.getElementById('form-password').required = true;
    document.getElementById('form-confirm-password').required = true;
    document.getElementById('form-username').disabled = false;

    // Reset status to active for new users
    const statusField = document.getElementById('form-status');
    if (statusField) statusField.value = 'active';

    // Update modal header icon
    const headerIcon = document.querySelector('.modal-header-icon');
    if (headerIcon) {
        headerIcon.className = 'fas fa-user-plus modal-header-icon';
    }

    document.getElementById('user-modal-overlay').classList.add('active');
}

function closeUserModal() {
    document.getElementById('user-modal-overlay').classList.remove('active');
}

async function saveUser(event) {
    event.preventDefault();

    const userId = document.getElementById('form-user-id').value;
    const isEdit = !!userId;

    const statusValue = document.getElementById('form-status')?.value;
    const formData = {
        username: document.getElementById('form-username').value.toLowerCase(),
        name: document.getElementById('form-name').value,
        email: document.getElementById('form-email').value || null,
        phone: document.getElementById('form-phone').value || null,
        role: document.getElementById('form-role').value,
        kelas: document.getElementById('form-kelas').value || null,
        is_active: statusValue === 'active'
    };

    // Password fields (only for create)
    if (!isEdit) {
        formData.password = document.getElementById('form-password').value;
        formData.confirm_password = document.getElementById('form-confirm-password').value;

        if (formData.password !== formData.confirm_password) {
            showToast('error', 'Password tidak cocok');
            return;
        }
    }

    // Walisantri linked NISN
    if (formData.role === 'walisantri') {
        const linkedNisn = document.getElementById('form-linked-nisn').value;
        if (linkedNisn) {
            const nisns = linkedNisn.split(',').map(n => n.trim()).filter(n => n);
            formData.linked_student_nisn = nisns[0] || null;
            formData.linked_student_nisns = nisns;
        }
    }

    try {
        let data;
        if (isEdit) {
            data = await apiRequest(`/users/${userId}/`, {
                method: 'PATCH',
                body: JSON.stringify(formData)
            });
        } else {
            data = await apiRequest('/users/create/', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
        }

        if (data.success) {
            showToast('success', data.message);
            closeUserModal();
            loadUsers();
            loadStats();
        }
    } catch (error) {
        showToast('error', error.message || 'Gagal menyimpan user');
    }
}

// ============================================
// EDIT USER
// ============================================
async function editUser(userId) {
    try {
        const data = await apiRequest(`/users/${userId}/`);

        if (data.success && data.user) {
            const user = data.user;

            document.getElementById('user-modal-title').textContent = 'Edit User';
            document.getElementById('form-user-id').value = user.id;
            document.getElementById('form-username').value = user.username;
            document.getElementById('form-username').disabled = true;
            document.getElementById('form-name').value = user.name || '';
            document.getElementById('form-email').value = user.email || '';
            document.getElementById('form-phone').value = user.phone || '';
            document.getElementById('form-role').value = user.role;
            document.getElementById('form-kelas').value = user.kelas || '';

            // Set status field
            const statusField = document.getElementById('form-status');
            if (statusField) {
                statusField.value = user.is_active ? 'active' : 'inactive';
            }

            // Update modal header icon for edit mode
            const headerIcon = document.querySelector('.modal-header-icon');
            if (headerIcon) {
                headerIcon.className = 'fas fa-user-edit modal-header-icon';
            }

            // Handle walisantri fields
            onRoleChange();
            if (user.role === 'walisantri') {
                const nisns = user.linked_student_nisns || [];
                document.getElementById('form-linked-nisn').value = nisns.join(', ');
            }

            // Hide password fields for edit
            document.getElementById('password-fields').style.display = 'none';
            document.getElementById('form-password').required = false;
            document.getElementById('form-confirm-password').required = false;

            document.getElementById('user-modal-overlay').classList.add('active');
        }
    } catch (error) {
        showToast('error', 'Gagal memuat data user');
    }
}

function onRoleChange() {
    const role = document.getElementById('form-role').value;
    const walisantriFields = document.getElementById('walisantri-fields');
    const kelasGroup = document.getElementById('form-kelas-group');

    // Show/hide walisantri fields
    walisantriFields.style.display = role === 'walisantri' ? 'block' : 'none';

    // Show/hide kelas field
    const showKelas = ['guru', 'musyrif', 'bk'].includes(role);
    kelasGroup.style.display = showKelas ? 'block' : 'none';
}

// ============================================
// VIEW USER DETAIL
// ============================================
let currentDetailUserId = null;

async function viewUser(userId) {
    currentDetailUserId = userId;

    try {
        const data = await apiRequest(`/users/${userId}/`);

        if (data.success && data.user) {
            const user = data.user;

            // Profile Card
            const avatarInitials = document.getElementById('detail-avatar-initials');
            if (avatarInitials) avatarInitials.textContent = getInitials(user.name);

            const nameDisplay = document.getElementById('detail-name-display');
            if (nameDisplay) nameDisplay.textContent = user.name || user.username;

            const usernameDisplay = document.getElementById('detail-username-display');
            if (usernameDisplay) usernameDisplay.textContent = `@${user.username}`;

            // Update subtitle with user info
            const subtitle = document.getElementById('detail-subtitle');
            if (subtitle) subtitle.textContent = `${formatRole(user.role)} • ${user.is_active ? 'Aktif' : 'Nonaktif'}`;

            // Info Card Fields
            document.getElementById('detail-username').textContent = user.username;
            document.getElementById('detail-name').textContent = user.name || '-';
            document.getElementById('detail-email').textContent = user.email || '-';
            document.getElementById('detail-phone').textContent = user.phone || '-';
            document.getElementById('detail-last-login').textContent = user.last_login_formatted || 'Belum pernah login';

            // Profile Badges (Role & Status)
            const roleEl = document.getElementById('detail-role');
            roleEl.className = `badge badge-role ${user.role}`;
            roleEl.textContent = formatRole(user.role);

            const statusEl = document.getElementById('detail-status');
            statusEl.className = `badge badge-status ${user.is_active ? 'active' : 'inactive'}`;
            statusEl.textContent = user.is_active ? 'Aktif' : 'Nonaktif';

            // Render assignments with modern card layout
            const assignmentsDiv = document.getElementById('detail-assignments');
            const activeAssignments = (user.assignments || []).filter(a => a.status === 'active');

            if (activeAssignments.length === 0) {
                assignmentsDiv.innerHTML = `
                    <div class="no-assignment">
                        <i class="fas fa-inbox"></i>
                        <p>Belum ada assignment</p>
                    </div>
                `;
            } else {
                assignmentsDiv.innerHTML = activeAssignments.map(a => `
                    <div class="assignment-item">
                        <div class="assignment-icon">${getAssignmentIcon(a.assignment_type)}</div>
                        <div class="assignment-info">
                            <div class="assignment-type">${escapeHtml(a.assignment_type_display || a.assignment_type)}</div>
                            <div class="assignment-target">${escapeHtml(a.target_display || '-')}</div>
                        </div>
                    </div>
                `).join('');
            }

            // Store user ID in buttons for direct access
            const editBtn = document.getElementById('btn-detail-edit');
            const assignBtn = document.getElementById('btn-detail-assign');
            if (editBtn) editBtn.setAttribute('data-user-id', user.id);
            if (assignBtn) assignBtn.setAttribute('data-user-id', user.id);

            console.log('[ViewUser] Detail modal opened for user ID:', user.id);
            document.getElementById('detail-modal-overlay').classList.add('active');
        }
    } catch (error) {
        console.error('[ViewUser] Error:', error);
        showToast('error', 'Gagal memuat detail user');
    }
}

function closeDetailModal() {
    console.log('[DetailModal] Closing modal');
    document.getElementById('detail-modal-overlay').classList.remove('active');
    currentDetailUserId = null;
}

function editUserFromDetail() {
    // Get user ID from global variable or button data attribute
    let userId = currentDetailUserId;

    // Fallback to button data attribute
    if (!userId) {
        const btn = document.getElementById('btn-detail-edit');
        userId = btn ? parseInt(btn.getAttribute('data-user-id')) : null;
    }

    console.log('[DetailModal] Edit button clicked, userId:', userId);

    if (userId) {
        closeDetailModal();
        setTimeout(() => {
            editUser(userId);
        }, 150); // Small delay to ensure modal is closed
    } else {
        console.error('[DetailModal] No user ID found for edit');
        showToast('error', 'ID User tidak ditemukan');
    }
}

function assignFromDetail() {
    // Get user ID from global variable or button data attribute
    let userId = currentDetailUserId;

    // Fallback to button data attribute
    if (!userId) {
        const btn = document.getElementById('btn-detail-assign');
        userId = btn ? parseInt(btn.getAttribute('data-user-id')) : null;
    }

    console.log('[DetailModal] Assign button clicked, userId:', userId);

    if (userId) {
        closeDetailModal();
        setTimeout(() => {
            openAssignModal(userId);
        }, 150); // Small delay to ensure modal is closed
    } else {
        console.error('[DetailModal] No user ID found for assign');
        showToast('error', 'ID User tidak ditemukan');
    }
}

/**
 * Setup event listeners for detail modal buttons
 * This is a backup mechanism in case onclick attributes don't work
 */
function setupDetailModalListeners() {
    console.log('[DetailModal] Setting up event listeners');

    // Edit button
    const editBtn = document.getElementById('btn-detail-edit');
    if (editBtn) {
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DetailModal] Edit button clicked via listener');
            editUserFromDetail();
        });
    }

    // Assign button
    const assignBtn = document.getElementById('btn-detail-assign');
    if (assignBtn) {
        assignBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DetailModal] Assign button clicked via listener');
            assignFromDetail();
        });
    }

    // Close button
    const closeBtn = document.getElementById('btn-detail-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DetailModal] Close button clicked via listener');
            closeDetailModal();
        });
    }

    console.log('[DetailModal] Event listeners setup complete');
}

// ============================================
// ASSIGN USER
// ============================================
function openAssignModal(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) {
        showToast('error', 'User tidak ditemukan');
        return;
    }

    // Check if user can be assigned
    const allowedRoles = ['guru', 'musyrif', 'bk', 'pimpinan'];
    if (!allowedRoles.includes(user.role)) {
        showToast('warning', `User dengan role ${formatRole(user.role)} tidak dapat diberi assignment`);
        return;
    }

    document.getElementById('assign-user-id').value = userId;
    document.getElementById('assign-user-name').textContent = user.name;
    document.getElementById('assign-user-role').textContent = formatRole(user.role);
    document.getElementById('assign-user-role').className = `badge badge-role ${user.role}`;

    document.getElementById('assign-form').reset();
    onAssignTypeChange();

    document.getElementById('assign-modal-overlay').classList.add('active');
}

function closeAssignModal() {
    document.getElementById('assign-modal-overlay').classList.remove('active');
}

function onAssignTypeChange() {
    const type = document.getElementById('assign-type').value;

    // Show/hide fields based on type
    document.getElementById('assign-kelas-group').style.display =
        ['kbm', 'diniyah', 'wali_kelas'].includes(type) ? 'block' : 'none';

    // Show mapel dropdown for kbm, diniyah, and halaqoh (tahfidz)
    const showMapel = ['kbm', 'diniyah', 'halaqoh'].includes(type);
    document.getElementById('assign-mapel-group').style.display =
        showMapel ? 'block' : 'none';

    // Populate mapel dropdown based on type
    if (showMapel) {
        populateMapelDropdown(type);
    }

    // Hide mapel for piket and wali_kelas
    if (['piket', 'wali_kelas'].includes(type)) {
        document.getElementById('assign-mapel-group').style.display = 'none';
    }

    document.getElementById('assign-mentoring-group').style.display =
        type === 'mentoring' ? 'block' : 'none';

    document.getElementById('assign-hari-group').style.display =
        type === 'piket' ? 'block' : 'none';
}

async function saveAssignment(event) {
    event.preventDefault();

    const userId = document.getElementById('assign-user-id').value;
    const type = document.getElementById('assign-type').value;

    const formData = {
        assignment_type: type,
        tahun_ajaran: document.getElementById('assign-tahun').value,
        semester: document.getElementById('assign-semester').value,
        catatan: document.getElementById('assign-catatan').value || null
    };

    // Add type-specific fields
    if (['kbm', 'diniyah', 'wali_kelas'].includes(type)) {
        formData.kelas = document.getElementById('assign-kelas').value;
        if (!formData.kelas) {
            showToast('error', 'Kelas harus dipilih');
            return;
        }
    }

    if (['kbm', 'diniyah', 'halaqoh'].includes(type)) {
        formData.mata_pelajaran = document.getElementById('assign-mapel').value || null;
    }

    if (type === 'mentoring') {
        formData.mentoring_id = parseInt(document.getElementById('assign-mentoring').value);
        if (!formData.mentoring_id) {
            showToast('error', 'Mentoring harus dipilih');
            return;
        }
    }

    if (type === 'piket') {
        const checkboxes = document.querySelectorAll('input[name="hari"]:checked');
        const hariArr = Array.from(checkboxes).map(cb => cb.value);
        if (hariArr.length === 0) {
            showToast('error', 'Pilih minimal satu hari');
            return;
        }
        formData.hari = hariArr.join(',');
    }

    try {
        const data = await apiRequest(`/users/${userId}/assign/`, {
            method: 'PATCH',
            body: JSON.stringify(formData)
        });

        if (data.success) {
            showToast('success', data.message);
            closeAssignModal();
            loadUsers();
        }
    } catch (error) {
        showToast('error', error.message || 'Gagal assign user');
    }
}

// ============================================
// DELETE ASSIGNMENT
// ============================================

/**
 * Confirm and delete an assignment
 */
function confirmDeleteAssignment(userId, assignmentId, userName, assignmentLabel) {
    const confirmed = confirm(`Hapus assignment "${assignmentLabel}" dari ${userName}?`);
    if (confirmed) {
        deleteAssignment(userId, assignmentId);
    }
}

/**
 * Delete assignment via API
 */
async function deleteAssignment(userId, assignmentId) {
    try {
        const response = await window.apiFetch(`admin/users/${userId}/assignments/${assignmentId}/`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showToast('success', data.message || 'Assignment berhasil dihapus');
            loadUsers(); // Refresh table
        } else {
            showToast('error', data.message || 'Gagal menghapus assignment');
        }
    } catch (error) {
        console.error('[Users] Error deleting assignment:', error);
        showToast('error', 'Gagal menghapus assignment');
    }
}

// ============================================
// RESET PASSWORD
// ============================================
function openResetModal(userId, username) {
    document.getElementById('reset-user-id').value = userId;
    document.getElementById('reset-username').textContent = username;
    document.getElementById('reset-form').reset();

    document.getElementById('reset-modal-overlay').classList.add('active');
}

function closeResetModal() {
    document.getElementById('reset-modal-overlay').classList.remove('active');
}

async function submitResetPassword(event) {
    event.preventDefault();

    const userId = document.getElementById('reset-user-id').value;
    const newPassword = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm').value;

    if (newPassword !== confirmPassword) {
        showToast('error', 'Password tidak cocok');
        return;
    }

    try {
        const data = await apiRequest(`/users/${userId}/reset-password/`, {
            method: 'POST',
            body: JSON.stringify({
                new_password: newPassword,
                confirm_password: confirmPassword
            })
        });

        if (data.success) {
            showToast('success', data.message);
            closeResetModal();
        }
    } catch (error) {
        showToast('error', error.message || 'Gagal reset password');
    }
}

// ============================================
// ACTIVATE/DEACTIVATE USER
// ============================================
async function deactivateUser(userId) {
    if (!confirm('Yakin ingin menonaktifkan user ini?')) return;

    try {
        const data = await apiRequest(`/users/${userId}/`, {
            method: 'DELETE'
        });

        if (data.success) {
            showToast('success', data.message);
            loadUsers();
            loadStats();
        }
    } catch (error) {
        showToast('error', error.message || 'Gagal menonaktifkan user');
    }
}

async function activateUser(userId) {
    try {
        const data = await apiRequest(`/users/${userId}/activate/`, {
            method: 'POST'
        });

        if (data.success) {
            showToast('success', data.message);
            loadUsers();
            loadStats();
        }
    } catch (error) {
        showToast('error', error.message || 'Gagal mengaktifkan user');
    }
}

// ============================================
// ACTIVITY LOG
// ============================================
function openActivityLogModal() {
    document.getElementById('activity-modal-overlay').classList.add('active');
    loadActivityLog();
}

function closeActivityLogModal() {
    document.getElementById('activity-modal-overlay').classList.remove('active');
}

/**
 * Show error message in activity log table
 * @param {HTMLElement} tableBody - The table body element
 * @param {string} message - Error message to display
 * @param {string} details - Optional technical details
 */
function showActivityLogError(tableBody, message, details = '') {
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="3" class="text-center">
                <div class="activity-error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">${escapeHtml(message)}</div>
                    ${details ? `<div class="error-details text-muted">${escapeHtml(details)}</div>` : ''}
                    <button class="btn btn-sm btn-outline-primary mt-3" onclick="loadActivityLog()">
                        🔄 Coba Lagi
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Render a single activity row
 * @param {Object} activity - Activity data object
 * @returns {string} HTML string for the table row
 */
function renderActivityRow(activity) {
    const timestamp = new Date(activity.timestamp);
    const timeStr = timestamp.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const actionIcon = getActivityIcon(activity.action);
    const actionClass = getActivityClass(activity.action);
    const actionDisplay = activity.action_display || formatAction(activity.action);

    // Format details if present
    let detailsHtml = '';
    if (activity.details && typeof activity.details === 'object' && Object.keys(activity.details).length > 0) {
        detailsHtml = `<div class="activity-details-text">${formatActivityDetails(activity.details)}</div>`;
    }

    return `
        <tr class="activity-row">
            <td class="activity-time">
                <span class="time-badge">${timeStr}</span>
            </td>
            <td class="activity-user">
                <div class="user-badge">
                    <span class="user-avatar-sm">${getInitials(activity.user_username || 'SYS')}</span>
                    <span class="user-name">${escapeHtml(activity.user_username || 'System')}</span>
                </div>
            </td>
            <td class="activity-detail">
                <span class="action-badge ${actionClass}">
                    ${actionIcon} ${actionDisplay}
                </span>
                ${activity.target_username ? `
                    <span class="target-user">→ <strong>${escapeHtml(activity.target_username)}</strong></span>
                ` : ''}
                ${detailsHtml}
            </td>
        </tr>
    `;
}

/**
 * Render activities table from data array
 * @param {Array} activities - Array of activity objects
 * @param {HTMLElement} tableBody - Table body element to inject rows
 * @param {HTMLElement} emptyState - Empty state element
 * @param {HTMLElement} activityTable - Activity table element
 * @param {HTMLElement} countEl - Count display element
 */
function renderActivitiesTable(activities, tableBody, emptyState, activityTable, countEl) {
    // Update count
    if (countEl) countEl.textContent = activities.length;

    if (activities.length > 0) {
        // Render all activity rows
        tableBody.innerHTML = activities.map(activity => renderActivityRow(activity)).join('');

        if (emptyState) emptyState.style.display = 'none';
        if (activityTable) activityTable.style.display = 'table';
    } else {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (activityTable) activityTable.style.display = 'none';
    }
}

/**
 * Load activity log from API with proper response handling
 */
async function loadActivityLog() {
    const tableBody = document.getElementById('activity-log-table-body');
    const emptyState = document.getElementById('activity-empty-state');
    const activityTable = document.getElementById('activity-table');
    const countEl = document.getElementById('activity-count');

    // Show loading state
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center">
                    <div class="loading-spinner"></div>
                    <p class="text-muted">Memuat riwayat aktivitas...</p>
                </td>
            </tr>
        `;
    }
    if (emptyState) emptyState.style.display = 'none';
    if (activityTable) activityTable.style.display = 'table';

    try {
        // Build query params
        const action = document.getElementById('activity-action-filter')?.value || '';
        const params = new URLSearchParams();
        if (action) params.append('action', action);
        params.append('page_size', '50');

        // Get auth token
        const token = localStorage.getItem('access_token');
        if (!token) {
            showActivityLogError(tableBody, 'Sesi login tidak ditemukan', 'Silakan login ulang untuk melanjutkan.');
            return;
        }

        // Make API request with proper headers
        const url = `${API_BASE}/activities/?${params.toString()}`;
        console.log('[ActivityLog] Fetching:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('[ActivityLog] Response status:', response.status);
        console.log('[ActivityLog] Response content-type:', response.headers.get('content-type'));

        // Check if response is OK
        if (!response.ok) {
            // Try to get error message from response
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                const errorMsg = errorData.message || errorData.error || errorData.detail || 'Terjadi kesalahan';
                showActivityLogError(tableBody, errorMsg, `HTTP ${response.status}`);
            } else {
                // Response is not JSON (likely HTML error page)
                showActivityLogError(
                    tableBody,
                    'Gagal memuat aktivitas dari server.',
                    `Server mengembalikan format yang tidak valid (HTTP ${response.status}). Hubungi Admin.`
                );
            }
            return;
        }

        // Verify content type is JSON before parsing
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            console.error('[ActivityLog] Invalid content-type:', contentType);
            showActivityLogError(
                tableBody,
                'Format respons tidak valid.',
                'Server tidak mengembalikan data JSON. Hubungi Admin.'
            );
            return;
        }

        // Parse JSON response
        const data = await response.json();
        console.log('[ActivityLog] Parsed data:', data);

        // Check for API error in response body
        if (data.success === false) {
            showActivityLogError(tableBody, data.message || 'Terjadi kesalahan', data.error || '');
            return;
        }

        // Extract activities from different response structures:
        // - DRF Paginated: {count, results}
        // - Custom format: {success, activities}
        // - Direct array
        let activities = [];
        if (Array.isArray(data)) {
            activities = data;
        } else if (data.results && Array.isArray(data.results)) {
            activities = data.results;
        } else if (data.activities && Array.isArray(data.activities)) {
            activities = data.activities;
        } else if (data.data && Array.isArray(data.data)) {
            activities = data.data;
        }

        console.log('[ActivityLog] Activities extracted:', activities.length);

        // Render the activities table
        renderActivitiesTable(activities, tableBody, emptyState, activityTable, countEl);

    } catch (error) {
        console.error('[ActivityLog] Error:', error);

        // Determine error type for better messaging
        let errorMessage = 'Gagal memuat aktivitas.';
        let errorDetails = '';

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Tidak dapat terhubung ke server.';
            errorDetails = 'Periksa koneksi internet Anda.';
        } else if (error.name === 'SyntaxError') {
            errorMessage = 'Format data tidak valid.';
            errorDetails = 'Server mengembalikan respons yang tidak dapat dibaca.';
        } else {
            errorDetails = error.message || 'Kesalahan tidak diketahui';
        }

        showActivityLogError(tableBody, errorMessage, errorDetails);
    }
}

function getActivityClass(action) {
    const classes = {
        'create': 'badge-success',
        'update': 'badge-info',
        'delete': 'badge-danger',
        'reset_password': 'badge-warning',
        'assign': 'badge-primary',
        'unassign': 'badge-secondary',
        'activate': 'badge-success',
        'deactivate': 'badge-danger',
        'login': 'badge-info',
        'logout': 'badge-secondary'
    };
    return classes[action] || 'badge-secondary';
}

function formatAction(action) {
    const actions = {
        'create': 'Create User',
        'update': 'Update User',
        'delete': 'Delete User',
        'reset_password': 'Reset Password',
        'assign': 'Assign',
        'unassign': 'Unassign',
        'activate': 'Activate',
        'deactivate': 'Deactivate',
        'login': 'Login',
        'logout': 'Logout'
    };
    return actions[action] || action;
}

// ============================================
// BULK ASSIGN
// ============================================
function openBulkAssignModal() {
    showToast('info', 'Fitur Bulk Assign akan segera tersedia');
    // TODO: Implement bulk assign modal
}

// ============================================
// EXPORT
// ============================================
function exportUsers() {
    showToast('info', 'Fitur Export akan segera tersedia');
    // TODO: Implement export functionality
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatRole(role) {
    const roleMap = {
        'superadmin': 'Superadmin',
        'pimpinan': 'Pimpinan',
        'guru': 'Guru',
        'musyrif': 'Musyrif',
        'bk': 'Guru BK',
        'bendahara': 'Bendahara',
        'walisantri': 'Walisantri',
        'pendaftar': 'Pendaftar',
        'adituren': 'Alumni'
    };
    return roleMap[role] || role;
}

function getAssignmentIcon(type) {
    const icons = {
        'kbm': '📚',
        'diniyah': '📖',
        'mentoring': '🕌',
        'wali_kelas': '👨‍🏫',
        'piket': '📋'
    };
    return icons[type] || '📌';
}

function getActivityIcon(action) {
    const icons = {
        'create': '➕',
        'update': '✏️',
        'delete': '🗑️',
        'reset_password': '🔑',
        'assign': '📋',
        'unassign': '📤',
        'activate': '✅',
        'deactivate': '🚫',
        'login': '🔓',
        'logout': '🔒'
    };
    return icons[action] || '📌';
}

function formatActivityDetails(details) {
    if (!details || typeof details !== 'object') return '';

    const parts = [];

    // Format common detail fields
    if (details.role) parts.push(`Role: ${formatRole(details.role)}`);
    if (details.assignment_type) parts.push(`Tipe: ${details.assignment_type}`);
    if (details.target) parts.push(`Target: ${details.target}`);
    if (details.updated_fields) parts.push(`Fields: ${details.updated_fields.join(', ')}`);
    if (details.reason) parts.push(`Alasan: ${details.reason}`);
    if (details.reset_by) parts.push(`Oleh: ${details.reset_by}`);
    if (details.reactivated_by) parts.push(`Oleh: ${details.reactivated_by}`);

    return parts.length > 0 ? parts.join(' | ') : '';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(type, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// WINDOW EXPORTS
// ============================================
window.openCreateUserModal = openCreateUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = editUser;
window.viewUser = viewUser;
window.closeDetailModal = closeDetailModal;
window.editUserFromDetail = editUserFromDetail;
window.assignFromDetail = assignFromDetail;
window.openAssignModal = openAssignModal;
window.closeAssignModal = closeAssignModal;
window.saveAssignment = saveAssignment;
window.confirmDeleteAssignment = confirmDeleteAssignment;
window.deleteAssignment = deleteAssignment;
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;
window.submitResetPassword = submitResetPassword;
window.deactivateUser = deactivateUser;
window.activateUser = activateUser;
window.openActivityLogModal = openActivityLogModal;
window.closeActivityLogModal = closeActivityLogModal;
window.loadActivityLog = loadActivityLog;
window.openBulkAssignModal = openBulkAssignModal;
window.exportUsers = exportUsers;
window.debounceSearch = debounceSearch;
window.applyFilters = applyFilters;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.onRoleChange = onRoleChange;
window.onAssignTypeChange = onAssignTypeChange;
