/**
 * Dashboard Ustadz - Portal Ponpes Baron v2.3
 * Bento UI Dashboard with Assignment Cards & Inval Integration
 */

// ============================================
// GLOBALS
// ============================================
let currentUser = null;
let assignments = [];
let isPiket = false;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    updateDate();
    await checkAuth();
    await loadDashboardData();
});

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    document.getElementById('topbar-date').textContent = `📅 ${dateStr}`;
}

async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch('users/me/');

        if (!response || !response.ok) throw new Error('Auth failed');

        currentUser = await response.json();

        const allowedRoles = ['guru', 'musyrif', 'wali_kelas', 'bk', 'superadmin', 'pimpinan'];
        if (!allowedRoles.includes(currentUser.role)) {
            showToast('Akses ditolak. Halaman ini untuk Ustadz/Ustadzah.', 'error');
            setTimeout(() => window.location.href = '/dashboard', 2000);
            return;
        }

        // Update UI - match IDs in dashboard-ustadz.html
        const nameEl = document.getElementById('user-name-display');
        const avatarEl = document.getElementById('user-avatar-initials');
        const roleEl = document.getElementById('user-role-display');

        if (nameEl) nameEl.textContent = currentUser.name || currentUser.username;
        if (avatarEl) avatarEl.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
        if (roleEl) roleEl.textContent = getRoleDisplay(currentUser.role);
        document.getElementById('welcome-name').textContent = currentUser.name?.split(' ')[0] || 'Ustadz';

        // Check if user has piket assignment
        checkPiketStatus();

    } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }
}

function getRoleDisplay(role) {
    const displays = {
        'guru': 'Guru/Ustadz',
        'musyrif': 'Musyrif',
        'wali_kelas': 'Wali Kelas',
        'bk': 'Guru BK',
        'superadmin': 'Super Admin',
        'pimpinan': 'Pimpinan'
    };
    return displays[role] || role;
}

// ============================================
// PIKET STATUS CHECK
// ============================================
async function checkPiketStatus() {
    try {
        // Check assignments for piket duty
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch(`users/${currentUser.id}/assignments/`);

        if (response && response.ok) {
            const data = await response.json();
            const today = new Date().toISOString().split('T')[0];
            const todayDay = new Date().getDay(); // 0 = Sunday

            // Check if user has active piket assignment
            isPiket = data.some(a =>
                a.assignment_type === 'piket' &&
                a.status === 'active'
            );

            if (isPiket) {
                enablePiketFeatures();
            }
        }
    } catch (error) {
        console.error('Check piket error:', error);
    }
}

function enablePiketFeatures() {
    // Show piket-specific elements (with null checks)
    const navPiketLabel = document.getElementById('nav-piket-label');
    const navInval = document.getElementById('nav-inval');
    const btnInval = document.getElementById('btn-inval');
    const cardInval = document.getElementById('card-inval');
    const cardAssignments = document.getElementById('card-assignments');

    if (navPiketLabel) navPiketLabel.style.display = 'block';
    if (navInval) navInval.style.display = 'flex';
    if (btnInval) btnInval.style.display = 'flex';
    if (cardInval) cardInval.style.display = 'block';

    // Adjust assignment card span
    if (cardAssignments) {
        cardAssignments.classList.remove('bento-span-12');
        cardAssignments.classList.add('bento-span-8');
    }

    // Load inval stats
    loadInvalStats();
}

// ============================================
// LOAD DASHBOARD DATA
// ============================================
async function loadDashboardData() {
    try {
        await Promise.all([
            loadAssignments(),
            loadSchedule(),
            loadMyEvaluation(),
            loadClassOverview(),
            loadRecentActivity()
        ]);
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Gagal memuat data dashboard', 'error');
    }
}

// ============================================
// ASSIGNMENTS
// ============================================
async function loadAssignments() {
    try {
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch(`users/${currentUser.id}/assignments/`);

        if (!response || !response.ok) {
            setAssignmentsPlaceholder();
            return;
        }

        const data = await response.json();
        assignments = data.filter(a => a.status === 'active');

        if (assignments.length > 0) {
            renderAssignments();
        } else {
            setAssignmentsPlaceholder();
        }

        document.getElementById('assignment-count').textContent = `${assignments.length} Tugas`;

    } catch (error) {
        console.error('Load assignments error:', error);
        setAssignmentsPlaceholder();
    }
}

function renderAssignments() {
    const container = document.getElementById('assignment-grid');

    container.innerHTML = assignments.map(a => {
        const icon = getAssignmentIcon(a.assignment_type);
        const iconClass = a.assignment_type;

        return `
            <div class="assignment-card" data-id="${a.id}">
                <div class="assignment-header">
                    <div class="assignment-icon ${iconClass}">${icon}</div>
                    <div>
                        <div class="assignment-title">${getAssignmentTitle(a)}</div>
                        <div class="assignment-subtitle">${a.assignment_type_display || a.assignment_type}</div>
                    </div>
                </div>
                <div class="assignment-details">
                    ${a.kelas ? `<span class="assignment-tag">Kelas ${a.kelas}</span>` : ''}
                    ${a.mata_pelajaran ? `<span class="assignment-tag">${a.mata_pelajaran}</span>` : ''}
                    ${a.halaqoh_name ? `<span class="assignment-tag">${a.halaqoh_name}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getAssignmentIcon(type) {
    const icons = {
        'kbm': '📚',
        'diniyah': '📖',
        'halaqoh': '🌙',
        'piket': '🔔',
        'wali_kelas': '👥'
    };
    return icons[type] || '📋';
}

function getAssignmentTitle(assignment) {
    switch (assignment.assignment_type) {
        case 'kbm':
            return assignment.mata_pelajaran || 'Mengajar KBM';
        case 'diniyah':
            return assignment.mata_pelajaran || 'Mengajar Diniyah';
        case 'halaqoh':
            return assignment.halaqoh_name || 'Pembimbing Halaqoh';
        case 'piket':
            return 'Ustadz Piket';
        case 'wali_kelas':
            return `Wali Kelas ${assignment.kelas || ''}`;
        default:
            return assignment.assignment_type_display || assignment.assignment_type;
    }
}

function setAssignmentsPlaceholder() {
    document.getElementById('assignment-grid').innerHTML = `
        <div class="assignment-card" style="grid-column: span 2; text-align: center; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
            <div class="assignment-title">Belum ada penugasan</div>
            <div class="assignment-subtitle" style="margin-top: 8px;">Hubungi admin untuk penugasan baru</div>
        </div>
    `;
}

// ============================================
// SCHEDULE
// ============================================
async function loadSchedule() {
    // In production, this would come from a schedule API
    // For now, generate placeholder based on assignments

    const container = document.getElementById('schedule-list');
    let scheduleCount = 0;

    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="schedule-item" style="justify-content: center;">
                <div style="text-align: center; color: var(--text-muted);">
                    Tidak ada jadwal hari ini
                </div>
            </div>
        `;
        document.getElementById('today-schedule-count').textContent = '0';
        return;
    }

    // Generate mock schedule items based on assignments
    const scheduleItems = [];
    const times = ['07:00', '08:30', '10:00', '13:00', '14:30', '16:00'];
    let timeIdx = 0;

    for (const a of assignments) {
        if (a.assignment_type === 'kbm' || a.assignment_type === 'diniyah') {
            if (timeIdx < times.length) {
                scheduleItems.push({
                    time: times[timeIdx],
                    title: a.mata_pelajaran || getAssignmentTitle(a),
                    room: a.kelas ? `Kelas ${a.kelas}` : 'Ruang Umum',
                    status: timeIdx === 0 ? 'ongoing' : (timeIdx === 1 ? 'upcoming' : 'upcoming')
                });
                timeIdx++;
                scheduleCount++;
            }
        }
    }

    if (scheduleItems.length === 0) {
        container.innerHTML = `
            <div class="schedule-item" style="justify-content: center;">
                <div style="text-align: center; color: var(--text-muted);">
                    Tidak ada jadwal mengajar hari ini
                </div>
            </div>
        `;
    } else {
        container.innerHTML = scheduleItems.map(item => `
            <div class="schedule-item">
                <div class="schedule-time">${item.time}</div>
                <div class="schedule-info">
                    <div class="schedule-title">${item.title}</div>
                    <div class="schedule-room">${item.room}</div>
                </div>
                <div class="schedule-status ${item.status}">${getStatusLabel(item.status)}</div>
            </div>
        `).join('');
    }

    document.getElementById('today-schedule-count').textContent = scheduleCount.toString();
}

function getStatusLabel(status) {
    const labels = {
        'ongoing': 'Berlangsung',
        'upcoming': 'Akan Datang',
        'done': 'Selesai'
    };
    return labels[status] || status;
}

// ============================================
// MY EVALUATION
// ============================================
async function loadMyEvaluation() {
    try {
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch(`kesantrian/employee-evaluations/user/${currentUser.id}/`);

        if (!response || !response.ok) {
            setEvaluationPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.summary) {
            updateEvaluationCard(data.summary);
        } else {
            setEvaluationPlaceholder();
        }

    } catch (error) {
        console.error('Load evaluation error:', error);
        setEvaluationPlaceholder();
    }
}

function updateEvaluationCard(summary) {
    document.getElementById('eval-total').textContent = formatPoin(summary.total_poin || 0);

    // Calculate prestasi and pelanggaran totals
    const prestasi = summary.prestasi_count || 0;
    const pelanggaran = summary.pelanggaran_count || 0;
    const invalPlus = summary.inval_plus_count || 0;
    const invalMinus = summary.inval_minus_count || 0;

    document.getElementById('eval-prestasi').textContent = `+${prestasi * 10}`; // Assuming 10 points per prestasi
    document.getElementById('eval-minus').textContent = `-${pelanggaran * 5}`;
    document.getElementById('eval-inval-plus').textContent = `+${invalPlus * 5}`;
    document.getElementById('eval-inval-minus').textContent = `-${invalMinus * 5}`;
}

function setEvaluationPlaceholder() {
    document.getElementById('eval-total').textContent = '+0';
    document.getElementById('eval-prestasi').textContent = '+0';
    document.getElementById('eval-minus').textContent = '0';
    document.getElementById('eval-inval-plus').textContent = '0';
    document.getElementById('eval-inval-minus').textContent = '0';
}

function formatPoin(poin) {
    return poin >= 0 ? `+${poin}` : poin.toString();
}

// ============================================
// INVAL STATS (Piket Only)
// ============================================
async function loadInvalStats() {
    const today = new Date().toISOString().split('T')[0];

    try {
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch(`kesantrian/inval/?tanggal=${today}`);

        if (!response || !response.ok) return;

        const data = await response.json();

        if (data.success && data.summary) {
            document.getElementById('inval-today').textContent = data.summary.total || 0;
            document.getElementById('inval-pending').textContent = data.summary.pending || 0;
        }

    } catch (error) {
        console.error('Load inval stats error:', error);
    }
}

// ============================================
// CLASS OVERVIEW (Wali Kelas Only)
// ============================================
async function loadClassOverview() {
    // Check if user is wali kelas
    const waliKelasAssignment = assignments.find(a => a.assignment_type === 'wali_kelas');

    if (!waliKelasAssignment) {
        document.getElementById('card-class-overview').style.display = 'none';
        return;
    }

    const kelas = waliKelasAssignment.kelas;
    document.getElementById('card-class-overview').style.display = 'block';
    document.getElementById('wali-kelas-name').textContent = kelas;

    try {
        // Load class students - use apiFetch for automatic token handling
        const response = await window.apiFetch(`students/?kelas=${kelas}`);

        if (!response || !response.ok) return;

        const data = await response.json();
        const students = data.data || data || [];

        // Calculate stats
        const total = students.length;
        document.getElementById('class-total').textContent = total;

        // Other stats would need additional API calls
        document.getElementById('class-hadir').textContent = '-';
        document.getElementById('class-avg').textContent = '-';
        document.getElementById('class-hafalan').textContent = '-';
        document.getElementById('class-blp').textContent = '-';

    } catch (error) {
        console.error('Load class overview error:', error);
    }
}

// ============================================
// RECENT ACTIVITY
// ============================================
async function loadRecentActivity() {
    try {
        // Use apiFetch for automatic token handling
        const response = await window.apiFetch('dashboard/recent-activity/');

        if (!response || !response.ok) {
            setActivityPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderActivityList(data.data);
        } else {
            setActivityPlaceholder();
        }

    } catch (error) {
        console.error('Load activity error:', error);
        setActivityPlaceholder();
    }
}

function renderActivityList(activities) {
    const container = document.getElementById('activity-list');

    container.innerHTML = activities.slice(0, 5).map(activity => {
        return `
            <div class="activity-item">
                <div class="activity-dot ${getDotClass(activity.type)}">${activity.icon || '📋'}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-sub">${activity.student || ''} ${activity.jenis ? `- ${activity.jenis}` : ''}</div>
                </div>
                <div class="activity-time">${activity.date}</div>
            </div>
        `;
    }).join('');
}

function getDotClass(type) {
    const classes = {
        'evaluation': 'dot-gold',
        'grade': 'dot-blue',
        'attendance': 'dot-green',
        'hafalan': 'dot-purple'
    };
    return classes[type] || 'dot-green';
}

function setActivityPlaceholder() {
    document.getElementById('activity-list').innerHTML = `
        <div class="activity-item">
            <div class="activity-dot dot-green">📋</div>
            <div class="activity-content">
                <div class="activity-title">Belum ada aktivitas terbaru</div>
                <div class="activity-sub">Aktivitas akan muncul setelah ada input data</div>
            </div>
        </div>
    `;
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
}
