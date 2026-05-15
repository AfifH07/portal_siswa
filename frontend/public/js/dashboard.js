let currentUser = null;
let attendanceChart = null;
let gradesChart = null;
let selectedChildNisn = null;  // For multi-child support
let childrenData = [];         // Cache for children data

// Dual-Chart instances
let academicRadarChart = null;
let diniyahBarChart = null;

// ============================================
// GLOBAL STATE: Active Student Context
// ============================================
window.activeStudentContext = {
    nisn: null,
    nama: null,
    kelas: null,
    isLoading: false,
    lastUpdated: null,
    data: {
        profile: null,
        grades: null,
        worship: null,
        behavior: null,
        attendance: null
    },
    errors: []
};

/**
 * Reset active student context
 */
function resetStudentContext() {
    window.activeStudentContext = {
        nisn: null,
        nama: null,
        kelas: null,
        isLoading: false,
        lastUpdated: null,
        data: {
            profile: null,
            grades: null,
            worship: null,
            behavior: null,
            attendance: null
        },
        errors: []
    };
}

/**
 * Update active student context
 */
function updateStudentContext(updates) {
    Object.assign(window.activeStudentContext, updates);
    window.activeStudentContext.lastUpdated = new Date().toISOString();
    debugLog('[StudentContext] Updated:', window.activeStudentContext);
}

// ============================================
// DEBUG MODE - Set to false for production
// ============================================
const DEBUG_MODE = false;
const debugLog = (...args) => { if (DEBUG_MODE) console.log(...args); };

// Fallback for escapeHtml if utils.js hasn't loaded
if (typeof escapeHtml !== 'function') {
    window.escapeHtml = function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
}

// Baron Light Emerald Color Palette
const EMERALD_COLORS = {
    // Primary Greens
    emerald400: '#34c99a',
    emerald500: '#1fa87a',
    emerald600: '#178560',
    emerald700: '#0f6347',
    // Brand Gold
    baronGold: '#c8961c',
    baronGoldLight: '#f0bf4c',
    // Accent Colors
    blue: '#3b82f6',
    purple: '#8b5cf6',
    red: '#ef4444',
    // Text (Light theme)
    textMain: '#0a2e20',
    textSub: '#3d6b57',
    textMuted: '#7aaa94',
    // Backgrounds
    bgCard: '#ffffff',
    bgBase: '#f2faf7',
    emerald50: '#f0faf7',
    // Grid & Borders
    gridColor: 'rgba(15, 99, 71, 0.07)',
    borderColor: 'rgba(15, 99, 71, 0.15)'
};

// Guru Dashboard Chart instance
let guruAttendanceChart = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Skip walisantri-specific init on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        debugLog('[Dashboard] Admin page detected, skipping dashboard init');
        return;
    }

    // First load user data to determine role
    await loadCurrentUser();

    // Check role and render appropriate dashboard
    if (currentUser && currentUser.role === 'walisantri') {
        debugLog('[Dashboard] Walisantri detected, rendering profile view');
        renderWalisantriDashboard();
    } else if (currentUser && currentUser.role === 'guru') {
        debugLog('[Dashboard] Guru detected, rendering guru dashboard');
        renderGuruDashboard();
    } else if (currentUser && currentUser.role === 'pimpinan') {
        debugLog('[Dashboard] Pimpinan detected, rendering pimpinan dashboard');
        renderPimpinanDashboard();
    } else {
        debugLog('[Dashboard] Admin/Superadmin detected, rendering admin dashboard');
        loadDashboardData();
    }
});

async function loadCurrentUser() {
    try {
        debugLog('[Dashboard] Fetching user data from /api/users/me/...');
        const response = await window.apiFetch('users/me/');

        if (!response) {
            console.error('[Dashboard] No response from apiFetch - auth redirect may have occurred');
            return;
        }

        if (!response.ok) {
            console.error('[Dashboard] Failed to load user:', response.status, response.statusText);
            throw new Error(`Failed to load user: ${response.status}`);
        }

        const data = await response.json();
        debugLog('[Dashboard] User data loaded:', data);
        currentUser = data;

        // Update sidebar user name display
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) {
            if (data.role === 'walisantri' && data.linked_student_name) {
                userNameDisplay.textContent = `Wali: ${data.linked_student_name}`;
            } else {
                userNameDisplay.textContent = data.name || data.username || 'User';
            }
        }

        // Update welcome title based on role
        const welcomeTitle = document.getElementById('welcome-title');
        if (welcomeTitle) {
            if (data.role === 'walisantri' && data.linked_student_name) {
                welcomeTitle.textContent = `Selamat Datang, Walisantri ${data.linked_student_name}!`;
            } else if (data.name) {
                welcomeTitle.textContent = `Selamat Datang, ${data.name}!`;
            } else {
                welcomeTitle.textContent = 'Selamat Datang!';
            }
        }

        // Update user info fields
        if (document.getElementById('user-username')) {
            document.getElementById('user-username').textContent = data.username || '-';
        }
        if (document.getElementById('user-name')) {
            // For walisantri, show linked student name
            if (data.role === 'walisantri' && data.linked_student_name) {
                document.getElementById('user-name').textContent = `Walisantri ${data.linked_student_name}`;
            } else {
                document.getElementById('user-name').textContent = data.name || '-';
            }
        }
        if (document.getElementById('user-role')) {
            // Format role nicely
            const roleDisplay = {
                'superadmin': 'Super Admin',
                'pimpinan': 'Pimpinan',
                'guru': 'Guru',
                'walisantri': 'Wali Santri'
            };
            document.getElementById('user-role').textContent = roleDisplay[data.role] || data.role || '-';
        }
        if (document.getElementById('user-email')) {
            document.getElementById('user-email').textContent = data.email || '-';
        }

        // Store updated user info for other pages
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_name', data.name || data.username);

    } catch (error) {
        console.error('[Dashboard] Error loading user:', error);

        // Try to use cached user data from localStorage as fallback
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
            try {
                currentUser = JSON.parse(cachedUser);
                debugLog('[Dashboard] Using cached user data:', currentUser);

                // Update UI with cached data
                const userNameDisplay = document.getElementById('user-name-display');
                if (userNameDisplay && currentUser.name) {
                    userNameDisplay.textContent = currentUser.name;
                }
            } catch (parseError) {
                console.error('[Dashboard] Failed to parse cached user data:', parseError);
            }
        }
    }
}

async function loadDashboardData() {
    // Show admin dashboard, hide others
    const adminDashboard = document.getElementById('dashboard-section');
    const walisantriDashboard = document.getElementById('walisantri-dashboard');
    const guruDashboard = document.getElementById('guru-dashboard');

    if (walisantriDashboard) walisantriDashboard.style.display = 'none';
    if (guruDashboard) guruDashboard.style.display = 'none';
    if (adminDashboard) {
        adminDashboard.style.display = 'block';
        adminDashboard.classList.add('active');
    }

    try {
        const [statsRes, attendanceRes, gradesRes, progressRes, activityRes] = await Promise.all([
            window.apiFetch('dashboard/stats/'),
            window.apiFetch('dashboard/attendance-chart/'),
            window.apiFetch('dashboard/grades-distribution/'),
            window.apiFetch('dashboard/progress-tracking/?limit=50'),
            window.apiFetch('dashboard/recent-activity/')
        ]);

        if (statsRes.ok) {
            const statsData = await statsRes.json();
            updateDashboardStats(statsData.stats);
        }

        if (attendanceRes.ok) {
            const attendanceData = await attendanceRes.json();
            renderAttendanceChart(attendanceData.data);
        }

        if (gradesRes.ok) {
            const gradesData = await gradesRes.json();
            renderGradesChart(gradesData.data);
        }

        if (progressRes.ok) {
            const progressData = await progressRes.json();
            renderProgressTable(progressData.data);
        }

        if (activityRes.ok) {
            const activityData = await activityRes.json();
            renderRecentActivity(activityData.data);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateDashboardStats(stats) {
    // Main stat cards
    if (document.getElementById('total-students')) {
        document.getElementById('total-students').textContent = stats.total_students || '-';
    }
    if (document.getElementById('total-classes')) {
        document.getElementById('total-classes').textContent = stats.total_classes || '-';
    }
    if (document.getElementById('today-attendance')) {
        document.getElementById('today-attendance').textContent = stats.attendance_today || '-';
    }
    if (document.getElementById('average-grade')) {
        document.getElementById('average-grade').textContent = stats.average_grade || '-';
    }
    if (document.getElementById('hafalan-progress')) {
        document.getElementById('hafalan-progress').textContent = (stats.hafalan_progress || '-') + '%';
    }

    // Welcome banner attendance
    if (document.getElementById('welcome-attendance')) {
        document.getElementById('welcome-attendance').textContent = stats.attendance_percentage ? stats.attendance_percentage + '%' : (stats.attendance_today || '-');
    }
    if (document.getElementById('welcome-attendance-detail')) {
        if (stats.attendance_hadir && stats.total_students) {
            document.getElementById('welcome-attendance-detail').textContent = `${stats.attendance_hadir} dari ${stats.total_students} santri hadir`;
        } else {
            document.getElementById('welcome-attendance-detail').textContent = '';
        }
    }

    // Update welcome title with user name
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle && currentUser) {
        if (currentUser.name) {
            welcomeTitle.textContent = `Selamat Datang, ${currentUser.name} 👋`;
        }
    }
}

function renderAttendanceChart(data) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    if (attendanceChart) {
        attendanceChart.destroy();
    }

    // Baron Light Emerald - Bar chart style
    const colorMap = {
        'Hadir': { bg: 'rgba(31, 168, 122, 0.7)', border: EMERALD_COLORS.emerald500 },
        'Sakit': { bg: 'rgba(59, 130, 246, 0.5)', border: EMERALD_COLORS.blue },
        'Izin': { bg: 'rgba(200, 150, 28, 0.5)', border: EMERALD_COLORS.baronGold },
        'Alpha': { bg: 'rgba(239, 68, 68, 0.5)', border: EMERALD_COLORS.red }
    };

    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: data.datasets.map((ds, idx) => {
                const colors = colorMap[ds.label] || {
                    bg: 'rgba(31, 168, 122, 0.7)',
                    border: EMERALD_COLORS.emerald500
                };
                return {
                    ...ds,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 0,
                    borderRadius: 6,
                    borderSkipped: false
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: EMERALD_COLORS.textSub,
                        usePointStyle: true,
                        padding: 16,
                        boxWidth: 10,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    titleColor: '#ffffff',
                    bodyColor: 'rgba(255, 255, 255, 0.85)',
                    borderColor: EMERALD_COLORS.borderColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: EMERALD_COLORS.gridColor, drawBorder: false },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
                        callback: v => v + '%'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: EMERALD_COLORS.textMuted, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } }
                }
            }
        }
    });
}

function renderGradesChart(data) {
    const ctx = document.getElementById('gradesChart');
    if (!ctx) return;

    if (gradesChart) {
        gradesChart.destroy();
    }

    // Baron Light Emerald palette for donut chart
    const emeraldPalette = [
        'rgba(31, 168, 122, 0.85)',   // A - Emerald
        'rgba(52, 201, 154, 0.7)',     // B - Light Emerald
        'rgba(200, 150, 28, 0.75)',    // C - Gold
        'rgba(239, 68, 68, 0.65)'      // D - Red
    ];

    gradesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: data.datasets.map(ds => ({
                ...ds,
                backgroundColor: emeraldPalette.slice(0, data.labels.length),
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 4,
                hoverOffset: 8
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: EMERALD_COLORS.textSub,
                        usePointStyle: true,
                        padding: 12,
                        boxWidth: 10,
                        font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    titleColor: '#ffffff',
                    bodyColor: 'rgba(255, 255, 255, 0.85)',
                    borderColor: EMERALD_COLORS.borderColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });
}

function renderProgressTable(students) {
    const tbody = document.getElementById('progress-table-body');
    const countBadge = document.getElementById('progress-count-badge');
    const footerText = document.getElementById('progress-footer-text');

    if (!tbody) return;

    // Update count badge
    if (countBadge) {
        if (!students || students.length === 0) {
            countBadge.textContent = '0 Santri';
        } else {
            countBadge.textContent = `${students.length} Santri`;
        }
    }

    // Update footer text
    if (footerText) {
        if (!students || students.length === 0) {
            footerText.textContent = 'Tidak ada data';
        } else {
            footerText.textContent = `Menampilkan ${students.length} santri terbaru`;
        }
    }

    if (!students || students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted" style="padding: 30px;">Tidak ada data</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = students.map(student => {
        const hafalanPct = Math.min(student.hafalan_percentage || 0, 100);
        const gradePct = Math.min(student.grade_percentage || 0, 100);
        const hafalanFillClass = hafalanPct >= 80 ? 'fill-good' : hafalanPct >= 50 ? 'fill-ok' : 'fill-low';
        const gradeFillClass = gradePct >= 80 ? 'fill-good' : gradePct >= 50 ? 'fill-ok' : 'fill-low';
        const isOnTrack = student.hafalan_status === 'above' && student.grade_status === 'above';

        return `
            <tr>
                <td><strong>${escapeHtml(student.nama)}</strong></td>
                <td>${student.kelas || '-'}</td>
                <td>
                    <div class="mini-progress">
                        <div class="mini-track"><div class="mini-fill ${hafalanFillClass}" style="width:${hafalanPct}%"></div></div>
                        <span class="mini-pct">${hafalanPct}%</span>
                    </div>
                </td>
                <td>
                    <div class="mini-progress">
                        <div class="mini-track"><div class="mini-fill ${gradeFillClass}" style="width:${gradePct}%"></div></div>
                        <span class="mini-pct">${student.average_grade || '-'}</span>
                    </div>
                </td>
                <td>
                    <span class="badge ${isOnTrack ? 'badge-success' : 'badge-warning'}">
                        ${isOnTrack ? 'Baik' : 'Perlu Perhatian'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecentActivity(activities) {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--text-muted);">Tidak ada aktivitas terbaru</div>';
        return;
    }

    // Determine dot color based on activity type
    const getDotClass = (activity) => {
        if (activity.type === 'grade') return 'dot-green';
        if (activity.type === 'hafalan') return 'dot-gold';
        if (activity.type === 'attendance') return 'dot-blue';
        if (activity.type === 'evaluation') return activity.jenis === 'prestasi' ? 'dot-purple' : 'dot-green';
        return 'dot-green';
    };

    container.innerHTML = activities.map(activity => {
        let badgeClass = 'badge-info';
        if (activity.type === 'evaluation') {
            badgeClass = activity.jenis === 'prestasi' ? 'badge-success' : 'badge-danger';
        } else if (activity.type === 'grade') {
            badgeClass = activity.nilai >= 85 ? 'badge-success' : activity.nilai >= 70 ? 'badge-info' : 'badge-warning';
        }

        return `
            <div class="activity-item">
                <div class="activity-dot ${getDotClass(activity)}">${activity.icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(activity.title)}</div>
                    <div class="activity-sub">${escapeHtml(activity.student || '')} ${activity.nisn ? '· ' + activity.nisn : ''}</div>
                </div>
                <div class="activity-time">${activity.date || ''}</div>
            </div>
        `;
    }).join('');
}

// showToast and window.logout are provided globally by utils.js

// ============================================================
// GURU DASHBOARD - Todo List Oriented
// ============================================================

/**
 * Render Guru Dashboard - Main entry point
 * Shows/hides appropriate sections and loads data
 */
async function renderGuruDashboard() {
    // Hide other dashboard sections
    const adminDashboard = document.getElementById('dashboard-section');
    const walisantriDashboard = document.getElementById('walisantri-dashboard');
    const guruDashboard = document.getElementById('guru-dashboard');
    const pageTitle = document.getElementById('page-title');

    if (adminDashboard) adminDashboard.style.display = 'none';
    if (walisantriDashboard) walisantriDashboard.style.display = 'none';
    if (guruDashboard) {
        guruDashboard.style.display = 'block';
        guruDashboard.classList.add('active');
    }
    if (pageTitle) pageTitle.textContent = 'Dashboard Guru';

    // Update greeting based on time
    updateGuruGreeting();

    // Update date display
    updateGuruDateDisplay();

    // Load dashboard data from API
    await loadGuruDashboardData();
}

/**
 * Update greeting based on current time
 */
function updateGuruGreeting() {
    const greetingEl = document.getElementById('guru-greeting');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greeting = 'Selamat Pagi';
    if (hour >= 11 && hour < 15) greeting = 'Selamat Siang';
    else if (hour >= 15 && hour < 18) greeting = 'Selamat Sore';
    else if (hour >= 18) greeting = 'Selamat Malam';

    const userName = currentUser?.name || currentUser?.username || 'Ustadz/ah';
    greetingEl.textContent = `${greeting}, ${userName}! 👋`;
}

/**
 * Update date display in header
 */
function updateGuruDateDisplay() {
    const hariEl = document.getElementById('guru-hari');
    const tanggalEl = document.getElementById('guru-tanggal');

    if (!hariEl || !tanggalEl) return;

    const now = new Date();
    const hariOptions = { weekday: 'long' };
    const tanggalOptions = { day: 'numeric', month: 'long', year: 'numeric' };

    hariEl.textContent = now.toLocaleDateString('id-ID', hariOptions);
    tanggalEl.textContent = now.toLocaleDateString('id-ID', tanggalOptions);
}

/**
 * Load all guru dashboard data from API
 */
async function loadGuruDashboardData() {
    try {
        debugLog('[GuruDashboard] Fetching guru-today data...');
        const response = await window.apiFetch('dashboard/guru-today/');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        debugLog('[GuruDashboard] API Response:', data);

        // Update tahun ajaran
        if (data.tahun_ajaran) {
            const taEl = document.getElementById('guru-tahun-ajaran-badge');
            if (taEl) taEl.textContent = data.tahun_ajaran;
        }

        // Update stats cards
        updateGuruStats(data.statistik || {});

        // Render jadwal todo list
        renderGuruJadwalList(data.jadwal_hari_ini || []);

        // Render materi list (from e_report)
        renderGuruMateriList(data.e_report || []);

        // Render attendance chart
        renderGuruAttendanceChart(data.statistik?.chart_data || null);

        // Handle warnings
        handleGuruWarnings(data.warning_belum_absen || []);

        // Update shortcut badges
        updateShortcutBadges(data);

        // Load jadwal mingguan (separate API call)
        loadJadwalMingguan();

        // Load todo list (separate API call)
        loadGuruTodoList();

    } catch (error) {
        console.error('[GuruDashboard] Error loading data:', error);
        showEmptyGuruDashboard('Gagal memuat data dashboard');
    }
}

/**
 * Update stats cards with data
 */
function updateGuruStats(stats) {
    // Kehadiran Mengajar %
    const kehadiranEl = document.getElementById('guru-stat-kehadiran');
    if (kehadiranEl) {
        const pct = stats.persentase_kehadiran;
        const display = (pct !== null && pct !== undefined && !isNaN(pct))
            ? `${Number(pct).toFixed(1)}%`
            : '0%';
        kehadiranEl.textContent = display;
    }

    // Kelas Hari Ini
    const kelasEl = document.getElementById('guru-stat-kelas-hari-ini');
    if (kelasEl) {
        kelasEl.textContent = stats.total_jadwal_hari_ini || 0;
    }

    // Nilai Pending
    const nilaiEl = document.getElementById('guru-stat-nilai-pending');
    if (nilaiEl) {
        nilaiEl.textContent = stats.nilai_pending || 0;
    }

    // Evaluasi Bulan Ini
    const evaluasiEl = document.getElementById('guru-stat-evaluasi-bulan');
    if (evaluasiEl) {
        evaluasiEl.textContent = stats.evaluasi_bulan_ini || 0;
    }
}

/**
 * Load jadwal mingguan from API
 */
async function loadJadwalMingguan() {
    const container = document.getElementById('jadwal-mingguan-grid');
    if (!container) return;

    // Get current user's username
    const username = currentUser?.username;
    if (!username) {
        container.innerHTML = '<div class="jadwal-empty">Username tidak ditemukan</div>';
        return;
    }

    try {
        debugLog('[GuruDashboard] Fetching jadwal mingguan for:', username);
        const response = await window.apiFetch(`jadwal/guru/${username}/`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        debugLog('[GuruDashboard] Jadwal mingguan response:', data);

        renderJadwalMingguan(data.jadwal_mingguan || {});

    } catch (error) {
        console.error('[GuruDashboard] Error loading jadwal mingguan:', error);
        container.innerHTML = '<div class="jadwal-empty"><span class="jadwal-empty-icon">⚠️</span>Gagal memuat jadwal</div>';
    }
}

/**
 * Render jadwal mingguan grid (6 hari: Senin-Sabtu)
 * @param {Object} jadwalMingguan - Object with keys: Senin, Selasa, ... Sabtu
 */
function renderJadwalMingguan(jadwalMingguan) {
    const container = document.getElementById('jadwal-mingguan-grid');
    if (!container) return;

    // Get current day name in Indonesian
    const hariMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = hariMap[new Date().getDay()];

    const hariList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    container.innerHTML = hariList.map(hari => {
        const isToday = hari === today;
        const jadwalHari = jadwalMingguan[hari] || [];

        let bodyHtml = '';
        if (jadwalHari.length === 0) {
            bodyHtml = `
                <div class="jadwal-empty">
                    <span class="jadwal-empty-icon">-</span>
                </div>
            `;
        } else {
            bodyHtml = jadwalHari.map(item => {
                const jamDisplay = item.jam_ke
                    ? `Jam ${item.jam_ke}`
                    : (item.jam_mulai && item.jam_selesai
                        ? `${item.jam_mulai}-${item.jam_selesai}`
                        : '-');

                return `
                    <div class="jadwal-item-mini">
                        <div class="jadwal-item-jam">${jamDisplay}</div>
                        <div class="jadwal-item-kelas">${escapeHtml(item.kelas)}</div>
                        <div class="jadwal-item-mapel">${escapeHtml(item.mata_pelajaran || '-')}</div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div class="jadwal-hari-col ${isToday ? 'hari-today' : ''}">
                <div class="jadwal-hari-header">${hari}</div>
                <div class="jadwal-hari-body">
                    ${bodyHtml}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render jadwal todo list
 * @param {Array} jadwalList - Array of schedule objects
 */
function renderGuruJadwalList(jadwalList) {
    const container = document.getElementById('guru-jadwal-list');
    const badgeEl = document.getElementById('guru-jadwal-badge');

    if (!container) return;

    // Update badge
    if (badgeEl) {
        badgeEl.textContent = `${jadwalList.length} sesi`;
    }

    // Empty state
    if (!jadwalList || jadwalList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📅</span>
                <p>Tidak ada jadwal mengajar hari ini</p>
            </div>
        `;
        return;
    }

    // Get current time for comparison
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Sort jadwal by jam_ke or jam_mulai
    jadwalList.sort((a, b) => {
        if (a.jam_ke && b.jam_ke) return a.jam_ke - b.jam_ke;
        if (a.jam_mulai && b.jam_mulai) return a.jam_mulai.localeCompare(b.jam_mulai);
        return 0;
    });

    // Render items
    container.innerHTML = jadwalList.map(item => {
        // Determine status
        let statusClass = 'item-pending';
        let badgeClass = 'badge-pending';
        let statusText = 'Belum';
        let actionBtn = '';

        if (item.sudah_absen) {
            statusClass = 'item-done';
            badgeClass = 'badge-done';
            statusText = 'Selesai';
        } else {
            // Check if time has passed (overdue)
            if (item.jam_selesai) {
                const [endH, endM] = item.jam_selesai.split(':').map(Number);
                if (currentHour > endH || (currentHour === endH && currentMinute > endM)) {
                    statusClass = 'item-overdue';
                    badgeClass = 'badge-overdue';
                    statusText = 'Terlewat';
                }
            }

            // Show action button for pending items
            actionBtn = `<a href="/attendance/?kelas=${encodeURIComponent(item.kelas)}&mapel=${encodeURIComponent(item.mata_pelajaran || '')}" class="todo-action-btn">Absen</a>`;
        }

        // Format jam display
        const jamDisplay = item.jam_ke
            ? `Jam ${item.jam_ke}`
            : (item.jam_mulai || '-');

        const waktuDisplay = (item.jam_mulai && item.jam_selesai)
            ? `${item.jam_mulai} - ${item.jam_selesai}`
            : '';

        return `
            <div class="guru-todo-item ${statusClass}">
                <div class="todo-jam-badge ${badgeClass}">${jamDisplay}</div>
                <div class="todo-info">
                    <div class="todo-kelas">${escapeHtml(item.kelas)}</div>
                    <div class="todo-mapel">${escapeHtml(item.mata_pelajaran || '-')}</div>
                    ${waktuDisplay ? `<div class="todo-waktu">${waktuDisplay}</div>` : ''}
                </div>
                <div class="todo-status">
                    <span class="status-badge status-${item.sudah_absen ? 'done' : (statusClass === 'item-overdue' ? 'overdue' : 'pending')}">${statusText}</span>
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render jurnal list from e_report (jurnal mengajar hari ini)
 * @param {Array} jurnalList - Array of jurnal objects
 */
function renderGuruMateriList(jurnalList) {
    const container = document.getElementById('guru-materi-list');
    if (!container) return;

    // Empty state
    if (!jurnalList || jurnalList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>Belum ada jurnal mengajar hari ini</p>
                <a href="/attendance/" class="btn btn-primary btn-sm">Input Jurnal</a>
            </div>
        `;
        return;
    }

    // Render jurnal items with all fields
    container.innerHTML = jurnalList.map(item => `
        <div class="materi-item">
            <div class="materi-header">
                <span class="materi-kelas">${escapeHtml(item.jam_label || `JP ${item.jam_ke || '-'}`)} • ${escapeHtml(item.kelas)}</span>
                <span class="materi-mapel">${escapeHtml(item.mata_pelajaran || '-')}</span>
            </div>
            <div class="materi-content">${escapeHtml(item.materi || 'Tidak ada materi tercatat')}</div>
            ${item.capaian_pembelajaran ? `<div class="materi-tujuan">📌 ${escapeHtml(item.capaian_pembelajaran)}</div>` : ''}
            ${item.catatan ? `<div class="materi-tujuan" style="color: #6b7280;">💬 ${escapeHtml(item.catatan)}</div>` : ''}
        </div>
    `).join('');
}

/**
 * Load and render Todo List widget
 */
async function loadGuruTodoList() {
    const container = document.getElementById('todo-widget-list');
    const badge = document.getElementById('todo-widget-badge');

    if (!container) return;

    try {
        debugLog('[GuruDashboard] Fetching todo list...');
        const response = await window.apiFetch('dashboard/guru/todo-list/');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        debugLog('[GuruDashboard] Todo list response:', data);

        const items = data.items || [];

        // Update badge
        if (badge) {
            if (items.length === 0) {
                badge.textContent = '✅ Selesai';
                badge.style.background = '#dcfce7';
                badge.style.color = '#166534';
            } else {
                badge.textContent = `${items.length} tugas`;
                badge.style.background = '#fef3c7';
                badge.style.color = '#92400e';
            }
        }

        // Render items
        if (items.length === 0) {
            container.innerHTML = `
                <div class="todo-widget-success">
                    <span class="success-icon">✅</span>
                    <div class="success-text">Semua kewajiban sudah selesai!</div>
                    <div class="success-sub">Tidak ada tugas tertunda hari ini</div>
                </div>
            `;
            return;
        }

        // Render todo items
        container.innerHTML = items.map(item => {
            // Icon based on type
            let icon = '📋';
            let btnClass = 'btn-presensi';
            let btnText = 'Input';

            if (item.type === 'nilai') {
                icon = '📊';
                btnClass = 'btn-nilai';
                btnText = 'Input';
            } else if (item.type === 'titipan') {
                icon = '📦';
                btnClass = 'btn-titipan';
                btnText = 'Buat';
            }

            return `
                <div class="todo-widget-item">
                    <span class="todo-widget-icon">${icon}</span>
                    <div class="todo-widget-info">
                        <div class="todo-widget-label">${escapeHtml(item.label)}</div>
                        <div class="todo-widget-detail">${escapeHtml(item.detail)}</div>
                    </div>
                    <div class="todo-widget-action">
                        <a href="${escapeHtml(item.url)}" class="todo-widget-btn ${btnClass}">
                            ${btnText} →
                        </a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('[GuruDashboard] Error loading todo list:', error);

        if (badge) {
            badge.textContent = '-';
        }

        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <span class="empty-icon">⚠️</span>
                <p style="font-size: 0.8rem;">Gagal memuat daftar tugas</p>
            </div>
        `;
    }
}

/**
 * Render guru attendance chart (6 months bar chart)
 * @param {Object} chartData - { labels: [], values: [] }
 */
function renderGuruAttendanceChart(chartData) {
    const canvas = document.getElementById('guru-attendance-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (guruAttendanceChart) {
        guruAttendanceChart.destroy();
    }

    // Default data if none provided
    if (!chartData || !chartData.labels || chartData.labels.length === 0) {
        chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
            values: [0, 0, 0, 0, 0, 0]
        };
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, EMERALD_COLORS.emerald400);
    gradient.addColorStop(1, EMERALD_COLORS.emerald600);

    guruAttendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Kehadiran Mengajar',
                data: chartData.values,
                backgroundColor: gradient,
                borderColor: EMERALD_COLORS.emerald600,
                borderWidth: 0,
                borderRadius: 6,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    callbacks: {
                        label: (ctx) => `Kehadiran: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: EMERALD_COLORS.gridColor },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { size: 10 },
                        callback: v => v + '%'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

/**
 * Handle warning cards for belum absen
 * @param {Array} warnings - Array of warning items
 */
function handleGuruWarnings(warnings) {
    const card = document.getElementById('guru-warning-card');
    const content = document.getElementById('guru-warning-content');

    if (!card || !content) return;

    // Hide if no warnings
    if (!warnings || warnings.length === 0) {
        card.style.display = 'none';
        return;
    }

    // Show warning card
    card.style.display = 'block';

    // Render warning items
    content.innerHTML = warnings.map(item => `
        <div class="warning-item">
            <span class="warning-icon">⚠️</span>
            <span class="warning-text">
                <strong>${escapeHtml(item.kelas)}</strong> - ${escapeHtml(item.mata_pelajaran || 'Jadwal')}
                (Jam ${item.jam_ke || item.jam || '-'})
            </span>
            <a href="/attendance/?kelas=${encodeURIComponent(item.kelas)}" class="warning-action">Absen Sekarang</a>
        </div>
    `).join('');
}

/**
 * Update shortcut badges with counts
 */
function updateShortcutBadges(data) {
    const stats = data.statistik || {};

    // Jurnal badge - show jadwal count
    const jurnalBadge = document.getElementById('shortcut-jurnal-badge');
    if (jurnalBadge) {
        const pending = (data.jadwal_hari_ini || []).filter(j => !j.sudah_absen).length;
        jurnalBadge.textContent = pending > 0 ? pending : '';
    }

    // Nilai badge - show pending
    const nilaiBadge = document.getElementById('shortcut-nilai-badge');
    if (nilaiBadge) {
        nilaiBadge.textContent = stats.nilai_pending > 0 ? stats.nilai_pending : '';
    }

    // Evaluasi badge - no dynamic count for now
    const evaluasiBadge = document.getElementById('shortcut-evaluasi-badge');
    if (evaluasiBadge) {
        evaluasiBadge.textContent = '';
    }
}

/**
 * Show empty state for guru dashboard
 */
function showEmptyGuruDashboard(message) {
    const container = document.getElementById('guru-jadwal-list');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">⚠️</span>
                <p>${escapeHtml(message)}</p>
                <button onclick="loadGuruDashboardData()" class="btn btn-primary btn-sm">Coba Lagi</button>
            </div>
        `;
    }
}

// Export guru dashboard functions
window.renderGuruDashboard = renderGuruDashboard;
window.loadGuruDashboardData = loadGuruDashboardData;
window.loadGuruTodoList = loadGuruTodoList;

// ============================================================
// WALISANTRI DASHBOARD - Student Profile View
// ============================================================

async function renderWalisantriDashboard() {
    const adminDashboard = document.getElementById('dashboard-section');
    const walisantriDashboard = document.getElementById('walisantri-dashboard');
    const pageTitle = document.getElementById('page-title');

    if (adminDashboard) adminDashboard.style.display = 'none';
    if (walisantriDashboard) {
        walisantriDashboard.style.display = 'block';
        walisantriDashboard.classList.add('active');
    }
    if (pageTitle) pageTitle.textContent = 'Dashboard Ananda';

    const profileContent = document.getElementById('walisantri-profile-content');
    if (!profileContent) return;

    const linkedStudents = currentUser?.linked_students || [];
    const hasLinkedStudent = currentUser?.linked_student_nisn || linkedStudents.length > 0;

    if (!currentUser || !hasLinkedStudent) {
        profileContent.innerHTML = `
            <div style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">👨‍👩‍👧</div>
                <p style="color:#6b7280;">Akun belum terhubung dengan data siswa. Hubungi admin.</p>
            </div>`;
        return;
    }

    if (linkedStudents.length > 1) {
        selectedChildNisn = selectedChildNisn || linkedStudents[0].nisn;
    } else if (linkedStudents.length === 1) {
        selectedChildNisn = linkedStudents[0].nisn;
    } else {
        selectedChildNisn = currentUser.linked_student_nisn;
    }

    profileContent.innerHTML = `<div style="padding:32px;text-align:center;color:#6b7280;font-size:13px;">Memuat data ananda...</div>`;

    try {
        const nisn = selectedChildNisn || currentUser.linked_student_nisn;

        const [student, attendanceStats, gradeStats, tagihanList, summary] = await Promise.all([
            window.apiFetch(`students/${nisn}/`).then(r => typeof r?.json === 'function' ? r.json() : r),
            fetchWalisantriAttendanceStats(nisn).catch(() => null),
            fetchWalisantriGradeStats(nisn).catch(() => null),
            fetchWalisantriTagihan(nisn).catch(() => []),
            fetchWalisantriSummary(nisn).catch(() => null),
        ]);

        const initials = getWalisantriInitials(student.nama);
        const progressPct = student.progress_hafalan_percentage || 0;
        const attendancePct = attendanceStats?.persentase_kehadiran || 0;
        const ibadahPct = summary?.ibadah_summary?.week_percentage ?? 0;
        const kajianHadir = summary?.ibadah_summary?.total_hadir ?? 0;
        const kelompok = summary?.halaqoh ? `${summary.halaqoh.nama || ''} · ${summary.halaqoh.pengasuh || ''}`.trim() : '';

        const aktivitasHtml = (() => {
            const items = [];
            if (summary?.recent_pembinaan?.length) {
                summary.recent_pembinaan.slice(0, 2).forEach(p => {
                    items.push(`<div class="wd-act-item">
                        <div class="wd-act-dot" style="background:#E1F5EE;flex-shrink:0;">📖</div>
                        <div><div class="wd-act-text">${p.catatan || 'Pembinaan tercatat'}</div>
                        <div class="wd-act-time">${p.tanggal || ''}</div></div></div>`);
                });
            }
            if (attendancePct >= 90) {
                items.push(`<div class="wd-act-item">
                    <div class="wd-act-dot" style="background:#E1F5EE;flex-shrink:0;">✅</div>
                    <div><div class="wd-act-text">Kehadiran kelas sangat baik (${attendancePct}%)</div>
                    <div class="wd-act-time">Bulan ini</div></div></div>`);
            }
            if (progressPct >= 60) {
                items.push(`<div class="wd-act-item">
                    <div class="wd-act-dot" style="background:#E6F1FB;flex-shrink:0;">🏆</div>
                    <div><div class="wd-act-text">Hafalan mencapai ${progressPct}% dari target</div>
                    <div class="wd-act-time">Update terkini</div></div></div>`);
            }
            if (!items.length) {
                items.push(`<div style="font-size:12px;color:#9ca3af;text-align:center;padding:12px 0;">Belum ada aktivitas tercatat</div>`);
            }
            return items.join('');
        })();

        const tagihanHtml = tagihanList.length ? tagihanList.map(t => {
            const overdue = t.is_overdue;
            const lunas = t.status === 'lunas';
            const pillHtml = lunas
                ? `<span class="wd-pill wd-pill-green">Lunas</span>`
                : overdue ? `<span class="wd-pill wd-pill-red">Lewat jatuh tempo</span>`
                : `<span class="wd-pill" style="background:#FFF7E6;color:#854F0B;">Belum lunas</span>`;
            const amountStyle = lunas ? 'color:#9ca3af;text-decoration:line-through;' : overdue ? 'color:#854F0B;' : '';
            return `<div class="wd-tag-item">
                <div><div class="wd-tag-name">${t.tarif_nama || 'Tagihan'} ${t.bulan_display || ''}</div>
                <div class="wd-tag-due">${lunas ? 'Lunas' : 'Jatuh tempo: ' + (t.jatuh_tempo || '-')}</div></div>
                <div><div class="wd-tag-amount" style="${amountStyle}">Rp ${Number(t.sisa||0).toLocaleString('id-ID')}</div>${pillHtml}</div>
            </div>`;
        }).join('') : `<div style="font-size:12px;color:#9ca3af;text-align:center;padding:12px 0;">Tidak ada tagihan aktif</div>`;

        const waliName = currentUser.name || currentUser.username || 'Wali Santri';
        profileContent.innerHTML = `
        <div>
            <div class="wd-topbar">
                <div class="wd-greeting">Assalamu'alaikum, <strong>${waliName}</strong></div>
                ${linkedStudents.length > 1 ? `
                <div class="wd-child-selector">
                    <select id="wd-child-select-new" style="font-size:12px;border:0.5px solid #d1d5db;border-radius:6px;padding:4px 8px;">
                        ${linkedStudents.map(c => `<option value="${c.nisn}" ${c.nisn === nisn ? 'selected' : ''}>${c.nama} (${c.kelas || '-'})</option>`).join('')}
                    </select>
                </div>` : `
                <div class="wd-child-selector" style="font-size:12px;color:#374151;font-weight:500;">
                    ${student.nama} · ${student.kelas || '-'}
                </div>`}
            </div>
            <div class="wd-content">
                <div class="wd-hero">
                    <div class="wd-avatar">${student.foto ? `<img src="${student.foto}" alt="${student.nama}">` : initials}</div>
                    <div class="wd-hero-info">
                        <div class="wd-name">${student.nama || '-'}</div>
                        <div class="wd-sub">NISN: ${student.nisn || '-'} · ${student.kelas || '-'} · ${student.program || 'Reguler'}</div>
                        <div class="wd-hero-badges">
                            <span class="wd-badge wd-badge-green">● ${student.aktif ? 'Aktif' : 'Alumni'}</span>
                            ${kelompok ? `<span class="wd-badge wd-badge-gray">${kelompok}</span>` : ''}
                        </div>
                    </div>
                    <div class="wd-hero-stats">
                        <div class="wd-hstat"><div class="val">${student.current_hafalan || 0}/${student.target_hafalan || 0}</div><div class="lbl">Juz hafal</div></div>
                        <div class="wd-hstat"><div class="val">${ibadahPct}%</div><div class="lbl">Ibadah minggu ini</div></div>
                        <div class="wd-hstat"><div class="val">${kajianHadir}</div><div class="lbl">Hadir kajian</div></div>
                    </div>
                </div>

                <div class="wd-stats-grid">
                    <div class="wd-stat">
                        <div class="si">📖</div><div class="sl">Hafalan</div>
                        <div class="sv color-green">${student.current_hafalan || 0} Juz</div>
                        <div class="ss">Target: ${student.target_hafalan || 0} juz · ${progressPct}%</div>
                        <div class="sbar"><div class="sbar-fill" style="background:#1d9e75;width:${progressPct}%"></div></div>
                    </div>
                    <div class="wd-stat">
                        <div class="si">🌙</div><div class="sl">Ibadah minggu ini</div>
                        <div class="sv color-blue">${ibadahPct}%</div>
                        <div class="ss">${summary?.ibadah_summary?.total_sholat ?? '-'} sholat tercatat</div>
                        <div class="sbar"><div class="sbar-fill" style="background:#378ADD;width:${ibadahPct}%"></div></div>
                    </div>
                    <div class="wd-stat">
                        <div class="si">🕌</div><div class="sl">Kajian mingguan</div>
                        <div class="sv color-green">${kajianHadir}</div>
                        <div class="ss">Hadir bulan ini</div>
                        <div class="sbar"><div class="sbar-fill" style="background:#1d9e75;width:${Math.min(kajianHadir * 20, 100)}%"></div></div>
                    </div>
                    <div class="wd-stat">
                        <div class="si">🧾</div><div class="sl">Tagihan</div>
                        <div class="sv color-amber">${tagihanList.filter(t => t.status !== 'lunas').length ? tagihanList.filter(t => t.status !== 'lunas').length + ' belum lunas' : 'Semua lunas'}</div>
                        <div class="ss">${tagihanList.filter(t => t.is_overdue).length ? tagihanList.filter(t => t.is_overdue).length + ' lewat jatuh tempo' : 'Tidak ada yang overdue'}</div>
                        <div class="sbar"><div class="sbar-fill" style="background:#ba7517;width:${tagihanList.filter(t => t.is_overdue).length ? 60 : 0}%"></div></div>
                    </div>
                </div>

                <div class="wd-two-col">
                    <div class="wd-card">
                        <div class="wd-card-title">⚡ Aktivitas terkini</div>
                        ${aktivitasHtml}
                    </div>
                    <div class="wd-card">
                        <div class="wd-card-title">🧾 Status tagihan</div>
                        ${tagihanHtml}
                    </div>
                </div>

                <div class="wd-card">
                    <div class="wd-card-title">⚡ Akses cepat</div>
                    <div class="wd-menu-grid">
                        <a class="wd-menu-item" href="/hafalan"><div class="wd-menu-icon" style="background:#E1F5EE;">📖</div><div class="wd-menu-label">Hafalan</div></a>
                        <a class="wd-menu-item" href="/grades"><div class="wd-menu-icon" style="background:#E6F1FB;">📊</div><div class="wd-menu-label">Nilai</div></a>
                        <a class="wd-menu-item" href="/kehadiran"><div class="wd-menu-icon" style="background:#E1F5EE;">📅</div><div class="wd-menu-label">Kehadiran</div></a>
                        <a class="wd-menu-item" href="/tagihan"><div class="wd-menu-icon" style="background:#FAEEDA;">🧾</div><div class="wd-menu-label">Tagihan</div></a>
                        <a class="wd-menu-item" href="/pertemuan-pengasuhan"><div class="wd-menu-icon" style="background:#EAF3DE;">🕌</div><div class="wd-menu-label">Kajian</div></a>
                        <a class="wd-menu-item" href="/karakter"><div class="wd-menu-icon" style="background:#F3F4F6;">⭐</div><div class="wd-menu-label">Karakter</div></a>
                    </div>
                </div>

                <div class="wd-card" style="padding:0;overflow:hidden;">
                    <div id="worship-tracker-container" style="padding:14px 16px;"></div>
                </div>

                <div class="wd-two-col">
                    <div class="wd-card">
                        <div class="wd-card-title">📊 Nilai akademik</div>
                        <div id="walisantri-grades-container"><div style="font-size:13px;color:#9ca3af;text-align:center;padding:12px;">Memuat...</div></div>
                    </div>
                    <div class="wd-card">
                        <div class="wd-card-title">📖 Diniyah & tahfidz</div>
                        <canvas id="diniyah-bar-chart" style="max-height:200px;"></canvas>
                    </div>
                </div>

                <div class="wd-footer">Portal Ponpes Baron · Dashboard Wali Santri</div>
            </div>
        </div>`;

        if (linkedStudents.length > 1) {
            const sel = document.getElementById('wd-child-select-new');
            if (sel) {
                sel.onchange = function() {
                    selectedChildNisn = this.value;
                    renderWalisantriDashboard();
                };
            }
        }

        if (gradeStats?.grades) renderWalisantriGradesTable(gradeStats, 'walisantri-grades-container');
        renderWorshipTracker(nisn);
        if (typeof renderDualCharts === 'function') renderDualCharts(nisn);

    } catch (err) {
        console.error('[Dashboard Walisantri] Error:', err);
        profileContent.innerHTML = `
            <div style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                <p style="color:#6b7280;">Gagal memuat data. <button style="color:#0f6e56;background:none;border:none;cursor:pointer;text-decoration:underline;">Coba lagi</button></p>
            </div>`;
        const btn = profileContent.querySelector('button');
        if (btn) btn.onclick = renderWalisantriDashboard;
    }
}

async function fetchWalisantriTagihan(nisn) {
    try {
        const res = await window.apiFetch('finance/tagihan/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const list = Array.isArray(d) ? d : (d.results || []);
        return list.slice(0, 3);
    } catch (e) {
        return [];
    }
}

async function fetchWalisantriSummary(nisn) {
    try {
        const res = await window.apiFetch('kesantrian/my-children-summary/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const children = Array.isArray(d) ? d : (d.children || d.results || d.data || []);
        return children.find(c => c.nisn === nisn) || children[0] || null;
    } catch (e) {
        return null;
    }
}

// Helper functions for walisantri dashboard
async function fetchWalisantriAttendanceStats(nisn) {
    try {
        const response = await window.apiCall(`attendance/stats/${nisn}/`);
        if (response.success && response.statistics) {
            return {
                persentase_kehadiran: response.statistics.persentase_kehadiran || 0,
                total_hadir: response.statistics.total_hadir || 0,
                total_sakit: response.statistics.total_sakit || 0,
                total_izin: response.statistics.total_izin || 0,
                total_alpha: response.statistics.total_alpha || 0
            };
        }
        return { persentase_kehadiran: 0 };
    } catch (error) {
        console.warn('[fetchWalisantriAttendanceStats] Error:', error);
        return { persentase_kehadiran: 0 };
    }
}

// ============================================
// WALISANTRI GRADES MODULE - CLEAN VERSION
// Single source of truth: /api/grades/my-child/
// ============================================

/**
 * Fetch grade stats for walisantri's child
 * ONLY uses /api/grades/my-child/ endpoint - no legacy fallbacks
 */
async function fetchWalisantriGradeStats(nisn) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.error('[fetchWalisantriGradeStats] No token found');
        return { rata_rata: '-', grades: [] };
    }

    try {
        debugLog('[fetchWalisantriGradeStats] Fetching from /api/grades/my-child/');

        const response = await fetch('/api/grades/my-child/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // DEBUG: Log full API response
        debugLog('[fetchWalisantriGradeStats] API Response:', result);

        if (result.success) {
            return {
                rata_rata: result.rata_rata_total || 0,
                jumlah_mata_pelajaran: result.jumlah_mata_pelajaran || 0,
                grades: result.grades || [],
                nisn: result.nisn,
                nama: result.nama,
                kelas: result.kelas
            };
        }

        console.warn('[fetchWalisantriGradeStats] API success=false:', result.message);
        return { rata_rata: '-', grades: [] };

    } catch (error) {
        console.error('[fetchWalisantriGradeStats] Error:', error);
        return { rata_rata: '-', grades: [] };
    }
}

/**
 * Sync Grades UI - Refresh all grade displays from API
 * Call this after any grade-related changes
 */
async function syncGradesUI() {
    debugLog('[syncGradesUI] Starting grades sync...');

    const token = localStorage.getItem('access_token');
    if (!token) {
        console.error('[syncGradesUI] No token - user not logged in');
        return;
    }

    try {
        const response = await fetch('/api/grades/my-child/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // DEBUG: Full response logging
        debugLog('[syncGradesUI] Full API response:', JSON.stringify(result, null, 2));

        if (result.success) {
            // 1. Update Flashcard Stats
            const avgDisplay = document.getElementById('total-avg-display');
            const subjectsDisplay = document.getElementById('total-subjects-display');

            if (avgDisplay) {
                const avgValue = typeof result.rata_rata_total === 'number'
                    ? result.rata_rata_total.toFixed(1)
                    : '-';
                avgDisplay.textContent = avgValue;
                debugLog('[syncGradesUI] Updated avg display:', avgValue);
            }

            if (subjectsDisplay) {
                subjectsDisplay.textContent = result.jumlah_mata_pelajaran || 0;
                debugLog('[syncGradesUI] Updated subjects count:', result.jumlah_mata_pelajaran);
            }

            // 2. Render Grades List
            renderWalisantriGradesTable(result, 'walisantri-grades-container');

            debugLog('[syncGradesUI] Sync complete -', result.jumlah_mata_pelajaran, 'subjects rendered');
        } else {
            console.warn('[syncGradesUI] API returned success: false -', result.message);
        }
    } catch (error) {
        console.error('[syncGradesUI] Error:', error);
    }
}

/**
 * Render Walisantri Grades Table - CLEAN VERSION
 * Uses Hybrid Deep Emerald card design
 *
 * @param {Object} data - API response with grades array
 * @param {string} containerId - Target container ID
 */
function renderWalisantriGradesTable(data, containerId) {
    // =====================================================
    // DEBUG: Log RAW data from /api/grades/my-child/
    // =====================================================
    debugLog("=== RENDER WALISANTRI GRADES ===");
    debugLog("DEBUG DATA:", data);
    debugLog("DEBUG grades array:", data?.grades);

    const container = document.getElementById(containerId);

    if (!container) {
        console.error('[RENDER] Container not found:', containerId);
        return;
    }

    // FORCE CLEAR old content
    container.innerHTML = '';

    // Extract grades array from API response
    const grades = data?.grades || [];

    debugLog('[RENDER] grades.length =', grades.length);

    // Empty state
    if (grades.length === 0) {
        container.innerHTML = `
            <div class="empty-state-grades">
                <div class="empty-icon">📚</div>
                <h4>Belum Ada Data Nilai</h4>
                <p class="text-muted">Data nilai untuk siswa ini belum tersedia di database.</p>
                <p style="font-size:12px;color:#999;margin-top:10px;">
                    NISN: ${data?.nisn || 'N/A'} | Nama: ${data?.nama || 'N/A'}
                </p>
            </div>
        `;
        return;
    }

    const KKM = 75;

    // Build cards using CORRECT field names from backend:
    // - item.mata_pelajaran (string)
    // - item.rata_rata (float)
    // - item.nilai_tertinggi (int)
    // - item.nilai_terendah (int)
    // - item.jumlah_nilai (int)
    const cardsHtml = grades.map(item => {
        const avg = parseFloat(item.rata_rata) || 0;
        const statusClass = avg >= 85 ? 'status-excellent' :
                           avg >= KKM ? 'status-pass' : 'status-fail';
        const statusText = avg >= 85 ? 'Sangat Baik' :
                          avg >= KKM ? 'Tuntas' : 'Perlu Perbaikan';

        debugLog(`[RENDER] Mapel: ${item.mata_pelajaran}, Avg: ${avg}`);

        return `
            <div class="grade-item-card glass-card ${statusClass}">
                <div class="grade-item-main">
                    <div class="grade-item-info">
                        <h5 class="mapel-name">${escapeHtml(item.mata_pelajaran)}</h5>
                        <span class="assessment-count">${item.jumlah_nilai || 0} Penilaian</span>
                    </div>
                    <div class="grade-item-stats">
                        <div class="stat-box stat-min">
                            <span class="stat-label">Min</span>
                            <span class="stat-value">${item.nilai_terendah || '-'}</span>
                        </div>
                        <div class="stat-box stat-max">
                            <span class="stat-label">Max</span>
                            <span class="stat-value">${item.nilai_tertinggi || '-'}</span>
                        </div>
                        <div class="stat-box stat-avg">
                            <span class="stat-label">Rata-rata</span>
                            <span class="stat-value grade-value">${avg.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
                <div class="grade-item-status">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    }).join('');

    // Render final HTML
    container.innerHTML = `
        <div class="grades-list-wrapper">
            <div class="grades-list-header">
                <h4>📊 Rekap Nilai per Mata Pelajaran</h4>
                <span class="total-badge">${grades.length} Mapel</span>
            </div>
            <div class="grades-list-body">
                ${cardsHtml}
            </div>
        </div>
    `;

    debugLog('[RENDER] Complete -', grades.length, 'subjects rendered');
}

async function fetchWalisantriEvaluationStats(nisn) {
    try {
        const response = await window.apiCall(`evaluations/student/${nisn}/`);
        if (response.success) {
            if (response.summary) {
                return {
                    total_evaluations: response.summary.total || 0,
                    prestasi_count: response.summary.prestasi_count || 0,
                    pelanggaran_count: response.summary.pelanggaran_count || 0
                };
            }
            // Fallback calculation
            let prestasiCount = 0;
            let pelanggaranCount = 0;
            (response.evaluations || []).forEach(ev => {
                if (ev.jenis === 'Prestasi') prestasiCount++;
                else if (ev.jenis === 'Pelanggaran') pelanggaranCount++;
            });
            return {
                total_evaluations: (response.evaluations || []).length,
                prestasi_count: prestasiCount,
                pelanggaran_count: pelanggaranCount
            };
        }
        return { total_evaluations: 0, prestasi_count: 0, pelanggaran_count: 0 };
    } catch (error) {
        console.warn('[fetchWalisantriEvaluationStats] Error:', error);
        return { total_evaluations: 0, prestasi_count: 0, pelanggaran_count: 0 };
    }
}

function getWalisantriInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function generateWalisantriBadges(student, evaluationStats = null) {
    const badges = [];

    if (student.current_hafalan >= 30) {
        badges.push('<span class="achievement-badge badge-gold">🏅 Hafidz</span>');
    } else if (student.current_hafalan >= 15) {
        badges.push('<span class="achievement-badge badge-silver">🎖 Half Quran</span>');
    } else if (student.current_hafalan >= 5) {
        badges.push('<span class="achievement-badge badge-bronze">📖 5+ Juz</span>');
    }

    if (student.hafalan_status === 'above_target') {
        badges.push('<span class="achievement-badge badge-star">⭐ Target Tercapai</span>');
    }

    if (evaluationStats) {
        if (evaluationStats.prestasi_count >= 5) {
            badges.push('<span class="achievement-badge badge-gold">🏆 Berprestasi</span>');
        } else if (evaluationStats.prestasi_count >= 3) {
            badges.push('<span class="achievement-badge badge-silver">🌟 Aktif</span>');
        }
        if (evaluationStats.pelanggaran_count === 0 && evaluationStats.total_evaluations > 0) {
            badges.push('<span class="achievement-badge badge-star">✨ Disiplin</span>');
        }
    }

    if (badges.length === 0) {
        return '<span class="no-badges">Terus semangat!</span>';
    }
    return badges.join('');
}

function formatWalisantriDate(dateStr) {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

// ============================================
// MULTI-CHILD SUPPORT FUNCTIONS
// ============================================

/**
 * Render child selector dropdown for walisantri with multiple children
 * @param {Array} children - Array of {nisn, nama, kelas}
 * @param {string} containerId - Target container ID
 */
function renderChildSelector(children, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Store globally
    childrenData = children;

    // If only 1 child, hide selector
    if (children.length <= 1) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (children.length === 1) {
            selectedChildNisn = children[0].nisn;
        }
        return;
    }

    // Set default selection to first child
    if (!selectedChildNisn) {
        selectedChildNisn = children[0].nisn;
    }

    container.style.display = 'block';
    container.innerHTML = `
        <div class="child-selector glass-card">
            <div class="selector-header">
                <span class="selector-icon">👨‍👩‍👧‍👦</span>
                <span class="selector-label">Pilih Anak:</span>
            </div>
            <select id="child-dropdown" class="child-dropdown" onchange="onChildSelected(this.value)">
                ${children.map(child => `
                    <option value="${child.nisn}" ${child.nisn === selectedChildNisn ? 'selected' : ''}>
                        ${escapeHtml(child.nama)} (${child.kelas || '-'})
                    </option>
                `).join('')}
            </select>
        </div>
    `;

    debugLog('[MultiChild] Rendered selector with', children.length, 'children');
}

/**
 * Handle child selection change - Multi-Child UI Synchronization
 *
 * Sequence:
 * 1. Clean all UI elements (prevent data flicker)
 * 2. fetchStudentProfile(nisn)
 * 3. fetchAcademicGrades(nisn)
 * 4. fetchWorshipTracker(nisn)
 * 5. fetchBehaviorSummary(nisn)
 *
 * All operations are async with proper error handling
 */
async function onChildSelected(nisn) {
    debugLog('[MultiChild] ====== CHILD SELECTION START ======');
    debugLog('[MultiChild] Selected NISN:', nisn);

    // Prevent double-loading
    if (window.activeStudentContext.isLoading) {
        debugLog('[MultiChild] Already loading, skipping...');
        return;
    }

    // Update global state
    selectedChildNisn = nisn;
    updateStudentContext({
        nisn: nisn,
        isLoading: true,
        errors: []
    });

    // Get selected child info
    const selectedChild = childrenData.find(c => c.nisn === nisn);
    if (selectedChild) {
        updateStudentContext({
            nama: selectedChild.nama,
            kelas: selectedChild.kelas
        });
    }

    // ========================================
    // STEP 1: CLEAN RELOAD - Clear all UI elements
    // ========================================
    debugLog('[MultiChild] Step 1: Cleaning UI elements...');
    clearAllUIElements();

    // Show loading states
    showLoadingStates();

    // ========================================
    // STEP 2-5: Fetch data sequentially
    // ========================================
    const errors = [];

    try {
        // STEP 2: Fetch Student Profile
        debugLog('[MultiChild] Step 2: Fetching student profile...');
        const profileResult = await fetchStudentProfile(nisn);
        if (profileResult.success) {
            updateStudentContext({ data: { ...window.activeStudentContext.data, profile: profileResult.data } });
            updateProfileUI(profileResult.data);
        } else {
            errors.push({ section: 'profile', message: profileResult.message });
        }

        // STEP 3: Fetch Academic Grades
        debugLog('[MultiChild] Step 3: Fetching academic grades...');
        const gradesResult = await fetchAcademicGrades(nisn);
        if (gradesResult.success) {
            updateStudentContext({ data: { ...window.activeStudentContext.data, grades: gradesResult.data } });
            updateGradesUI(gradesResult.data);
        } else {
            errors.push({ section: 'grades', message: gradesResult.message });
        }

        // STEP 4: Fetch Worship Tracker
        debugLog('[MultiChild] Step 4: Fetching worship tracker...');
        const worshipResult = await fetchWorshipTracker(nisn);
        if (worshipResult.success) {
            updateStudentContext({ data: { ...window.activeStudentContext.data, worship: worshipResult.data } });
            // renderWorshipTrackerUI is called inside fetchWorshipTracker
        } else {
            errors.push({ section: 'worship', message: worshipResult.message });
        }

        // STEP 5: Fetch Behavior Summary
        debugLog('[MultiChild] Step 5: Fetching behavior summary...');
        const behaviorResult = await fetchBehaviorSummary(nisn);
        if (behaviorResult.success) {
            updateStudentContext({ data: { ...window.activeStudentContext.data, behavior: behaviorResult.data } });
            updateBehaviorUI(behaviorResult.data);
        } else {
            errors.push({ section: 'behavior', message: behaviorResult.message });
        }

        // BONUS: Refresh dual charts
        debugLog('[MultiChild] Bonus: Refreshing dual charts...');
        await renderDualCharts(nisn);

    } catch (error) {
        console.error('[MultiChild] Critical error:', error);
        errors.push({ section: 'general', message: error.message });
    }

    // ========================================
    // FINISH: Update context and show errors
    // ========================================
    updateStudentContext({
        isLoading: false,
        errors: errors
    });

    // Show friendly error messages if any
    if (errors.length > 0) {
        showFriendlyErrors(errors);
    }

    debugLog('[MultiChild] ====== CHILD SELECTION COMPLETE ======');
    debugLog('[MultiChild] Context:', window.activeStudentContext);
}

/**
 * Clear all UI elements before loading new data
 * Prevents data flicker from previous child
 */
function clearAllUIElements() {
    // Clear profile name
    const nameDisplay = document.querySelector('.profile-name');
    if (nameDisplay) nameDisplay.textContent = '—';

    // Clear NISN display
    const nisnDisplay = document.querySelector('.profile-nisn');
    if (nisnDisplay) nisnDisplay.textContent = 'NISN: —';

    // Clear flashcard values
    const flashcardValues = [
        'total-avg-display',
        'total-subjects-display'
    ];
    flashcardValues.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
    });

    // Clear grades container
    const gradesContainer = document.getElementById('walisantri-grades-container');
    if (gradesContainer) {
        gradesContainer.innerHTML = '<div class="loading-mini">Memuat data nilai...</div>';
    }

    // Clear worship tracker
    const worshipContainer = document.getElementById('worship-tracker-container');
    if (worshipContainer) {
        worshipContainer.innerHTML = '<div class="loading-mini">Memuat data ibadah...</div>';
    }

    // Destroy existing charts
    if (academicRadarChart) {
        academicRadarChart.destroy();
        academicRadarChart = null;
    }
    if (diniyahBarChart) {
        diniyahBarChart.destroy();
        diniyahBarChart = null;
    }

    // Show chart loading states
    const academicLoading = document.getElementById('academic-chart-loading');
    const diniyahLoading = document.getElementById('diniyah-chart-loading');
    if (academicLoading) academicLoading.style.display = 'block';
    if (diniyahLoading) diniyahLoading.style.display = 'block';

    debugLog('[ClearUI] All UI elements cleared');
}

/**
 * Show loading states for all sections
 */
function showLoadingStates() {
    // Add loading class to main container
    const dashboard = document.querySelector('.student-profile-dashboard');
    if (dashboard) {
        dashboard.classList.add('is-loading');
    }
}

/**
 * Fetch student profile data
 */
async function fetchStudentProfile(nisn) {
    try {
        const student = await window.apiCall(`students/${nisn}/`);
        return { success: true, data: student };
    } catch (error) {
        console.error('[fetchStudentProfile] Error:', error);
        return { success: false, message: 'Gagal memuat profil siswa' };
    }
}

/**
 * Fetch academic grades data
 */
async function fetchAcademicGrades(nisn) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/grades/my-child/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            return { success: true, data: result };
        }
        return { success: false, message: result.message || 'Data nilai tidak tersedia' };
    } catch (error) {
        console.error('[fetchAcademicGrades] Error:', error);
        return { success: false, message: 'Gagal memuat data nilai' };
    }
}

/**
 * Fetch worship tracker data
 */
async function fetchWorshipTracker(nisn) {
    try {
        const response = await window.apiFetch(`kesantrian/worship-tracker/${nisn}/`);
        const result = typeof response?.json === 'function' ? await response.json() : response;
        if (result.success) {
            // Render the tracker UI
            const container = document.getElementById('worship-tracker-container');
            if (container) {
                renderWorshipTrackerUI(result, container);
            }
            return { success: true, data: result };
        }
        return { success: false, message: result.message || 'Data ibadah tidak tersedia' };
    } catch (error) {
        console.error('[fetchWorshipTracker] Error:', error);

        // Show error in container
        const container = document.getElementById('worship-tracker-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state-worship">
                    <div class="empty-icon">⚠️</div>
                    <p>Gagal memuat data ibadah</p>
                </div>
            `;
        }
        return { success: false, message: 'Gagal memuat data ibadah' };
    }
}

/**
 * Fetch behavior summary data (using student-metrics endpoint)
 */
async function fetchBehaviorSummary(nisn) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/kesantrian/student-metrics/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            return { success: true, data: result };
        }
        return { success: false, message: result.message || 'Data perilaku tidak tersedia' };
    } catch (error) {
        console.error('[fetchBehaviorSummary] Error:', error);
        return { success: false, message: 'Gagal memuat data perilaku' };
    }
}

/**
 * Update profile UI with new data
 */
function updateProfileUI(student) {
    // Update name
    const nameDisplay = document.querySelector('.profile-name');
    if (nameDisplay && student.nama) {
        nameDisplay.textContent = student.nama;
    }

    // Update NISN
    const nisnDisplay = document.querySelector('.profile-nisn');
    if (nisnDisplay && student.nisn) {
        nisnDisplay.textContent = `NISN: ${student.nisn}`;
    }

    // Update class tag
    const kelasTag = document.querySelector('.tag-kelas');
    if (kelasTag && student.kelas) {
        kelasTag.innerHTML = `📚 ${escapeHtml(student.kelas)}`;
    }

    // Update avatar initials
    const avatarInitials = document.querySelector('.avatar-initials');
    if (avatarInitials && student.nama) {
        avatarInitials.textContent = getWalisantriInitials(student.nama);
    }

    debugLog('[UpdateProfileUI] Profile updated for:', student.nama);
}

/**
 * Update grades UI with new data
 */
function updateGradesUI(gradesData) {
    // Update flashcard stats
    const avgDisplay = document.getElementById('total-avg-display');
    const subjectsDisplay = document.getElementById('total-subjects-display');

    if (avgDisplay) {
        const avgValue = typeof gradesData.rata_rata_total === 'number'
            ? gradesData.rata_rata_total.toFixed(1)
            : '—';
        avgDisplay.textContent = avgValue;
    }

    if (subjectsDisplay) {
        subjectsDisplay.textContent = gradesData.jumlah_mata_pelajaran || 0;
    }

    // Render grades table
    renderWalisantriGradesTable(gradesData, 'walisantri-grades-container');

    debugLog('[UpdateGradesUI] Grades updated:', gradesData.jumlah_mata_pelajaran, 'subjects');
}

/**
 * Update behavior UI with metrics data
 */
function updateBehaviorUI(behaviorData) {
    // This can be extended to update behavior-specific UI elements
    // For now, the data is stored in context for potential use
    debugLog('[UpdateBehaviorUI] Behavior data:', behaviorData);

    // Update achievement flashcard if predikat available
    if (behaviorData.predikat) {
        const achievementValue = document.querySelector('.flashcard-achievement .flashcard-value');
        if (achievementValue) {
            // Could show predikat here
        }
    }
}

/**
 * Show friendly error messages to user
 */
function showFriendlyErrors(errors) {
    if (!errors || errors.length === 0) return;

    // Group errors by section
    const errorMessages = errors.map(err => {
        const sectionNames = {
            'profile': 'Profil Siswa',
            'grades': 'Data Nilai',
            'worship': 'Data Ibadah',
            'behavior': 'Data Perilaku',
            'general': 'Sistem'
        };
        const sectionName = sectionNames[err.section] || err.section;
        return `${sectionName}: ${err.message}`;
    });

    // Show toast notification
    if (typeof showToast === 'function') {
        if (errors.length === 1) {
            showToast('warning', errorMessages[0]);
        } else {
            showToast('warning', `Beberapa data gagal dimuat (${errors.length} error)`);
        }
    }

    // Log all errors
    console.warn('[FriendlyErrors] Errors encountered:', errorMessages);
}

// ============================================
// WORSHIP TRACKER (Sholat 5 Waktu)
// ============================================

/**
 * Fetch and render worship (sholat) tracker for a student
 * @param {string} nisn - Student NISN
 */
async function renderWorshipTracker(nisn) {
    const container = document.getElementById('worship-tracker-container');
    if (!container) {
        debugLog('[WorshipTracker] Container not found');
        return;
    }

    const targetNisn = nisn || selectedChildNisn || currentUser?.linked_student_nisn;
    if (!targetNisn) {
        container.innerHTML = `
            <div class="empty-state-worship">
                <div class="empty-icon">🕌</div>
                <p>Data ibadah tidak tersedia</p>
            </div>
        `;
        return;
    }

    // Show loading
    container.innerHTML = `
        <div class="loading-mini">Memuat data ibadah...</div>
    `;

    try {
        const response = await window.apiFetch(`kesantrian/worship-tracker/${targetNisn}/`);
        const result = typeof response?.json === 'function' ? await response.json() : response;
        debugLog('[WorshipTracker] API Response:', result);

        if (!result.success) {
            throw new Error(result.message || 'Gagal memuat data');
        }

        // Render the tracker
        renderWorshipTrackerUI(result, container);

    } catch (error) {
        console.error('[WorshipTracker] Error:', error);
        container.innerHTML = `
            <div class="empty-state-worship">
                <div class="empty-icon">⚠️</div>
                <p>Gagal memuat data ibadah</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

/**
 * Render the worship tracker UI
 */
function renderWorshipTrackerUI(data, container) {
    const { week_data, summary } = data;
    const waktuList = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const waktuLabels = {
        'subuh': '🌅 Subuh',
        'dzuhur': '☀️ Dzuhur',
        'ashar': '🌤️ Ashar',
        'maghrib': '🌅 Maghrib',
        'isya': '🌙 Isya'
    };

    // Status icons
    const getStatusIcon = (status) => {
        switch (status) {
            case 'hadir': return '<span class="status-icon status-hadir">✓</span>';
            case 'terlambat': return '<span class="status-icon status-terlambat">⏰</span>';
            case 'tidak_hadir': return '<span class="status-icon status-tidak">✗</span>';
            case 'izin': return '<span class="status-icon status-izin">📝</span>';
            case 'sakit': return '<span class="status-icon status-sakit">🏥</span>';
            default: return '<span class="status-icon status-empty">-</span>';
        }
    };

    // Build table rows (last 7 days)
    const rowsHtml = week_data.slice(0, 7).map(day => {
        const tanggalDate = new Date(day.tanggal);
        const isToday = day.tanggal === new Date().toISOString().split('T')[0];

        return `
            <tr class="${isToday ? 'today-row' : ''}">
                <td class="day-cell">
                    <div class="day-name">${day.hari}</div>
                    <div class="day-date">${tanggalDate.getDate()}/${tanggalDate.getMonth() + 1}</div>
                </td>
                ${waktuList.map(w => `<td class="worship-cell">${getStatusIcon(day[w])}</td>`).join('')}
            </tr>
        `;
    }).join('');

    // Summary section
    const percentage = summary.persentase || 0;
    const statusClass = percentage >= 90 ? 'excellent' : percentage >= 70 ? 'good' : 'needs-improvement';

    container.innerHTML = `
        <div class="worship-tracker-wrapper">
            <div class="worship-header">
                <h4>🕌 Tracking Sholat 5 Waktu</h4>
                <div class="worship-summary ${statusClass}">
                    <span class="summary-percentage">${percentage}%</span>
                    <span class="summary-detail">${summary.total_hadir}/${summary.total_sholat} sholat</span>
                </div>
            </div>

            <div class="worship-table-container">
                <table class="worship-table">
                    <thead>
                        <tr>
                            <th>Hari</th>
                            ${waktuList.map(w => `<th>${waktuLabels[w]}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <div class="worship-legend">
                <span class="legend-item"><span class="status-icon status-hadir">✓</span> Hadir</span>
                <span class="legend-item"><span class="status-icon status-terlambat">⏰</span> Terlambat</span>
                <span class="legend-item"><span class="status-icon status-tidak">✗</span> Tidak Hadir</span>
                <span class="legend-item"><span class="status-icon status-empty">-</span> Belum Dicatat</span>
            </div>
        </div>
    `;

    debugLog('[WorshipTracker] Rendered successfully');
}

/**
 * Fetch kesantrian summary for all children
 */
async function fetchKesantrianSummary() {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
        const response = await fetch('/api/kesantrian/my-children-summary/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        debugLog('[Kesantrian] Summary:', result);
        return result;

    } catch (error) {
        console.error('[Kesantrian] Error fetching summary:', error);
        return null;
    }
}

// ============================================
// DUAL-CHART VISUALIZATION
// ============================================

/**
 * Fetch chart data from API and render both charts
 */
async function renderDualCharts(nisn) {
    const targetNisn = nisn || selectedChildNisn || currentUser?.linked_student_nisn;
    if (!targetNisn) {
        debugLog('[DualCharts] No NISN available');
        return;
    }

    // Hide loading indicators
    const academicLoading = document.getElementById('academic-chart-loading');
    const diniyahLoading = document.getElementById('diniyah-chart-loading');

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/kesantrian/chart-data/${targetNisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        debugLog('[DualCharts] API Response:', result);

        if (!result.success) {
            throw new Error(result.message || 'Gagal memuat data chart');
        }

        // Hide loading indicators
        if (academicLoading) academicLoading.style.display = 'none';
        if (diniyahLoading) diniyahLoading.style.display = 'none';

        // Render Chart A: Academic Radar Chart
        renderAcademicRadarChart(result.academic_chart);

        // Render Chart B: Diniyah Bar Chart
        renderDiniyahBarChart(result.diniyah_chart);

    } catch (error) {
        console.error('[DualCharts] Error:', error);
        if (academicLoading) academicLoading.innerHTML = '<p style="color: #999;">Gagal memuat chart</p>';
        if (diniyahLoading) diniyahLoading.innerHTML = '<p style="color: #999;">Gagal memuat chart</p>';
    }
}

/**
 * Render Academic Radar Chart (Chart A)
 * Uses emerald600 color palette
 */
function renderAcademicRadarChart(data) {
    const canvas = document.getElementById('academic-radar-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if any
    if (academicRadarChart) {
        academicRadarChart.destroy();
    }

    // Short labels for radar chart
    const shortLabels = data.labels.map(label => {
        const mapping = {
            'Bahasa Indonesia': 'B.Indo',
            'Bahasa Inggris': 'B.Inggris',
            'Matematika': 'MTK',
            'IPA': 'IPA',
            'IPS': 'IPS',
            'PKN': 'PKN'
        };
        return mapping[label] || label.substring(0, 8);
    });

    academicRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: shortLabels,
            datasets: [{
                label: 'Nilai Akademik',
                data: data.values,
                backgroundColor: 'rgba(23, 133, 96, 0.2)',  // emerald600 with opacity
                borderColor: EMERALD_COLORS.emerald600,
                borderWidth: 2,
                pointBackgroundColor: EMERALD_COLORS.emerald600,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: EMERALD_COLORS.emerald600
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: { size: 10 },
                        color: EMERALD_COLORS.textMuted
                    },
                    grid: {
                        color: EMERALD_COLORS.gridColor
                    },
                    pointLabels: {
                        font: { size: 11, weight: '500' },
                        color: EMERALD_COLORS.textMain
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    titleFont: { size: 12 },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            return `Nilai: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render Diniyah Bar Chart (Chart B)
 * Uses baronGold color palette for premium look
 */
function renderDiniyahBarChart(data) {
    const canvas = document.getElementById('diniyah-bar-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if any
    if (diniyahBarChart) {
        diniyahBarChart.destroy();
    }

    // Create gradient for bars
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, EMERALD_COLORS.baronGoldLight);
    gradient.addColorStop(1, EMERALD_COLORS.baronGold);

    // Short labels for bar chart
    const shortLabels = data.labels.map(label => {
        const mapping = {
            'Aqidah': 'Aqidah',
            'Fiqih': 'Fiqih',
            'Al-Quran Hadist': 'Quran',
            'Bahasa Arab': 'B.Arab',
            'Akhlak': 'Akhlak',
            'Hafalan': 'Hafalan'
        };
        return mapping[label] || label.substring(0, 7);
    });

    diniyahBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shortLabels,
            datasets: [{
                label: 'Nilai/Progress',
                data: data.values,
                backgroundColor: gradient,
                borderColor: EMERALD_COLORS.baronGold,
                borderWidth: 1,
                borderRadius: 6,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',  // Horizontal bars
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: EMERALD_COLORS.gridColor
                    },
                    ticks: {
                        font: { size: 10 },
                        color: EMERALD_COLORS.textMuted
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 11, weight: '500' },
                        color: EMERALD_COLORS.textMain
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#b8860b',
                    titleFont: { size: 12 },
                    bodyFont: { size: 11 },
                    callbacks: {
                        label: function(context) {
                            const label = data.labels[context.dataIndex];
                            if (label === 'Hafalan') {
                                return `Progress: ${context.raw}%`;
                            }
                            return `Nilai: ${context.raw}`;
                        }
                    }
                }
            }
        }
    });
}

// ============================================
// UNIVERSAL PRINT ENGINE
// ============================================

/**
 * Print rapor for a student
 * Opens rapor in new window for printing
 */
async function printRapor(nisn) {
    const targetNisn = nisn || selectedChildNisn || currentUser?.linked_student_nisn;
    if (!targetNisn) {
        showToast && showToast('error', 'NISN tidak tersedia');
        return;
    }

    // Show loading
    showToast && showToast('info', 'Menyiapkan rapor...');

    try {
        const token = localStorage.getItem('access_token');

        // Open rapor in new window with HTML format (using dedicated HTML endpoint)
        const raporUrl = `/api/kesantrian/print-rapor-html/${targetNisn}/`;

        // Create a form to submit with auth token
        const form = document.createElement('form');
        form.method = 'GET';
        form.action = raporUrl;
        form.target = '_blank';

        // Since we need auth, fetch the HTML first
        const response = await fetch(raporUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const htmlContent = await response.text();

        // Open in new window
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        showToast && showToast('success', 'Rapor siap dicetak');

    } catch (error) {
        console.error('[PrintRapor] Error:', error);
        showToast && showToast('error', 'Gagal memuat rapor: ' + error.message);
    }
}

/**
 * Bulk print rapor for a class (wali_kelas only)
 */
async function printBulkRapor(kelas) {
    if (!kelas) {
        showToast && showToast('error', 'Kelas tidak ditentukan');
        return;
    }

    showToast && showToast('info', 'Menyiapkan rapor kelas...');

    try {
        const token = localStorage.getItem('access_token');

        // Get all students in class
        const studentsResponse = await fetch(`/api/students/?kelas=${encodeURIComponent(kelas)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!studentsResponse.ok) {
            throw new Error('Gagal mengambil data siswa');
        }

        const studentsData = await studentsResponse.json();
        const students = studentsData.results || studentsData;

        if (!students.length) {
            showToast && showToast('warning', 'Tidak ada siswa di kelas ini');
            return;
        }

        // Open each rapor in sequence
        for (const student of students) {
            await printRapor(student.nisn);
            // Small delay between prints
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        showToast && showToast('success', `${students.length} rapor siap dicetak`);

    } catch (error) {
        console.error('[BulkPrint] Error:', error);
        showToast && showToast('error', 'Gagal mencetak rapor: ' + error.message);
    }
}

// ============================================
// WINDOW EXPORTS FOR WALISANTRI FUNCTIONS
// ============================================================
// PIMPINAN DASHBOARD
// ============================================================

// Chart instances for pimpinan
let pimpinanGradesChart = null;
let pimpinanHafalanChart = null;
let pimpinanAttendanceChart = null;
let pimpinanBreakdownChart = null;

/**
 * Render Pimpinan Dashboard - Main entry point
 */
async function renderPimpinanDashboard() {
    // Hide other dashboard sections
    const adminDashboard = document.getElementById('dashboard-section');
    const walisantriDashboard = document.getElementById('walisantri-dashboard');
    const guruDashboard = document.getElementById('guru-dashboard');
    const pimpinanDashboard = document.getElementById('pimpinan-dashboard');
    const pageTitle = document.getElementById('page-title');

    if (adminDashboard) adminDashboard.style.display = 'none';
    if (walisantriDashboard) walisantriDashboard.style.display = 'none';
    if (guruDashboard) guruDashboard.style.display = 'none';
    if (pimpinanDashboard) {
        pimpinanDashboard.style.display = 'block';
        pimpinanDashboard.classList.add('active');
    }
    if (pageTitle) pageTitle.textContent = 'Dashboard Pimpinan';

    // Update welcome title
    const welcomeTitle = document.getElementById('pimpinan-welcome-title');
    if (welcomeTitle && currentUser) {
        const name = currentUser.name || currentUser.username || 'Pimpinan';
        welcomeTitle.textContent = `Selamat Datang, ${name} 👋`;
    }

    // Load pimpinan data
    await loadPimpinanDashboardData();

    // Also load attendance chart (reuse existing endpoint)
    await loadPimpinanAttendanceChart();

    // Also load grades distribution
    await loadPimpinanGradesChart();
}

/**
 * Load pimpinan dashboard data from API
 */
async function loadPimpinanDashboardData() {
    try {
        debugLog('[PimpinanDashboard] Fetching pimpinan summary...');
        const response = await window.apiFetch('dashboard/pimpinan/summary/');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        debugLog('[PimpinanDashboard] API Response:', data);

        // Update hari display
        const hariDisplay = document.getElementById('pimpinan-hari-display');
        if (hariDisplay && data.hari) {
            hariDisplay.textContent = `hari ${data.hari}`;
        }

        // Update stats cards
        updatePimpinanStats(data.stats || {});

        // Render presensi guru table
        renderPimpinanPresensiGuru(data.presensi_guru || []);

        // Render hafalan per kelas chart
        renderPimpinanHafalanChart(data.hafalan_per_kelas || []);

        // Render evaluasi stats
        renderPimpinanEvaluasi(data.evaluasi || {});

        // Render breakdown chart
        renderPimpinanBreakdownChart(data.breakdown_kelas || []);

    } catch (error) {
        console.error('[PimpinanDashboard] Error loading data:', error);
        showPimpinanError('Gagal memuat data dashboard');
    }
}

/**
 * Update pimpinan stats cards
 */
function updatePimpinanStats(stats) {
    // Total Santri
    const santriEl = document.getElementById('pimpinan-stat-santri');
    if (santriEl) santriEl.textContent = stats.total_santri || 0;

    // Total Guru
    const guruEl = document.getElementById('pimpinan-stat-guru');
    if (guruEl) guruEl.textContent = stats.total_guru || 0;

    // Efektivitas KBM
    const efektivitasEl = document.getElementById('pimpinan-stat-efektivitas');
    const efektivitasCard = document.getElementById('pimpinan-stat-efektivitas-card');
    const efektivitas = stats.efektivitas_kbm || 0;

    if (efektivitasEl) efektivitasEl.textContent = `${efektivitas}%`;

    // Color coding for efektivitas
    if (efektivitasCard) {
        efektivitasCard.classList.remove('status-good', 'status-warning', 'status-danger', 'sc-gold', 'sc-green', 'sc-red');
        if (efektivitas >= 80) {
            efektivitasCard.classList.add('sc-green');
        } else if (efektivitas >= 50) {
            efektivitasCard.classList.add('sc-gold');
        } else {
            efektivitasCard.classList.add('sc-red');
        }
    }

    // Welcome banner efektivitas
    const efektivitasBadge = document.getElementById('pimpinan-efektivitas-badge');
    const efektivitasDetail = document.getElementById('pimpinan-efektivitas-detail');
    if (efektivitasBadge) efektivitasBadge.textContent = `${efektivitas}%`;
    if (efektivitasDetail) {
        efektivitasDetail.textContent = `${stats.jurnal_terisi || 0} dari ${stats.total_jadwal_hari_ini || 0} jadwal terisi`;
    }

    // Jam Kosong
    const kosongEl = document.getElementById('pimpinan-stat-kosong');
    const kosongCard = document.getElementById('pimpinan-stat-kosong-card');
    const jamKosong = stats.jam_kosong || 0;

    if (kosongEl) kosongEl.textContent = jamKosong;

    // Color coding for jam kosong
    if (kosongCard) {
        kosongCard.classList.remove('sc-red', 'sc-green', 'sc-gold');
        if (jamKosong === 0) {
            kosongCard.classList.add('sc-green');
        } else if (jamKosong <= 3) {
            kosongCard.classList.add('sc-gold');
        } else {
            kosongCard.classList.add('sc-red');
        }
    }
}

/**
 * Render presensi guru table
 */
function renderPimpinanPresensiGuru(presensiGuru) {
    const tbody = document.getElementById('pimpinan-presensi-tbody');
    const badge = document.getElementById('pimpinan-presensi-badge');

    if (!tbody) return;

    // Update badge
    if (badge) {
        const totalGuru = presensiGuru.length;
        const guruLengkap = presensiGuru.filter(g => g.kosong === 0).length;
        badge.textContent = `${guruLengkap}/${totalGuru} Lengkap`;
    }

    // Empty state (weekend/holiday)
    if (!presensiGuru || presensiGuru.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="presensi-empty">
                        <div class="presensi-empty-icon">📅</div>
                        <div>Tidak ada jadwal mengajar hari ini</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Render rows
    tbody.innerHTML = presensiGuru.map(guru => {
        let statusClass = 'status-lengkap';
        let statusText = 'Lengkap';

        if (guru.terisi === 0) {
            statusClass = 'status-belum';
            statusText = 'Belum Mengajar';
        } else if (guru.kosong > 0) {
            statusClass = 'status-ada-kosong';
            statusText = 'Ada Kosong';
        }

        return `
            <tr>
                <td><strong>${escapeHtml(guru.nama)}</strong></td>
                <td style="text-align: center;">${guru.jadwal}</td>
                <td style="text-align: center;">${guru.terisi}</td>
                <td style="text-align: center; ${guru.kosong > 0 ? 'color: #dc2626; font-weight: 700;' : ''}">${guru.kosong}</td>
                <td style="text-align: center;">
                    <span class="presensi-status-badge ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Render hafalan per kelas chart (horizontal bar)
 */
function renderPimpinanHafalanChart(hafalanData) {
    const canvas = document.getElementById('pimpinan-hafalan-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (pimpinanHafalanChart) {
        pimpinanHafalanChart.destroy();
    }

    if (!hafalanData || hafalanData.length === 0) {
        // Empty state
        ctx.font = '14px Plus Jakarta Sans';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText('Tidak ada data hafalan', canvas.width / 2, canvas.height / 2);
        return;
    }

    const labels = hafalanData.map(h => h.kelas);
    const values = hafalanData.map(h => h.persentase);

    // Generate colors based on percentage
    const backgroundColors = values.map(v => {
        if (v >= 70) return 'rgba(16, 185, 129, 0.7)';  // green
        if (v >= 40) return 'rgba(245, 158, 11, 0.7)';  // yellow
        return 'rgba(239, 68, 68, 0.7)';  // red
    });

    const borderColors = values.map(v => {
        if (v >= 70) return '#10b981';
        if (v >= 40) return '#f59e0b';
        return '#ef4444';
    });

    pimpinanHafalanChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Progress Hafalan (%)',
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 0,
                borderRadius: 4,
                barThickness: 20
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    callbacks: {
                        label: (ctx) => `Progress: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: EMERALD_COLORS.gridColor },
                    ticks: {
                        color: EMERALD_COLORS.textMuted,
                        callback: v => v + '%'
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: EMERALD_COLORS.textMain }
                }
            }
        }
    });
}

/**
 * Load pimpinan attendance chart (6 months)
 */
async function loadPimpinanAttendanceChart() {
    const canvas = document.getElementById('pimpinan-attendance-chart');
    if (!canvas) return;

    try {
        const response = await window.apiFetch('dashboard/attendance-chart/');
        if (response.ok) {
            const data = await response.json();
            renderPimpinanAttendanceChartData(data.data);
        }
    } catch (error) {
        console.error('[PimpinanDashboard] Error loading attendance chart:', error);
    }
}

/**
 * Render pimpinan attendance chart
 */
function renderPimpinanAttendanceChartData(data) {
    const canvas = document.getElementById('pimpinan-attendance-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (pimpinanAttendanceChart) {
        pimpinanAttendanceChart.destroy();
    }

    const colorMap = {
        'Hadir': { bg: 'rgba(31, 168, 122, 0.7)', border: EMERALD_COLORS.emerald500 },
        'Sakit': { bg: 'rgba(59, 130, 246, 0.5)', border: EMERALD_COLORS.blue },
        'Izin': { bg: 'rgba(200, 150, 28, 0.5)', border: EMERALD_COLORS.baronGold },
        'Alpha': { bg: 'rgba(239, 68, 68, 0.5)', border: EMERALD_COLORS.red }
    };

    pimpinanAttendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: data.datasets.map(ds => {
                const colors = colorMap[ds.label] || { bg: 'rgba(31, 168, 122, 0.7)', border: EMERALD_COLORS.emerald500 };
                return {
                    ...ds,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 0,
                    borderRadius: 6
                };
            })
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: EMERALD_COLORS.textSub,
                        usePointStyle: true,
                        padding: 12,
                        boxWidth: 10,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: EMERALD_COLORS.gridColor },
                    ticks: { color: EMERALD_COLORS.textMuted, font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: EMERALD_COLORS.textMuted, font: { size: 10 } }
                }
            }
        }
    });
}

/**
 * Load and render grades distribution chart
 */
async function loadPimpinanGradesChart() {
    const canvas = document.getElementById('pimpinan-grades-chart');
    if (!canvas) return;

    try {
        const response = await window.apiFetch('dashboard/grades-distribution/');
        if (response.ok) {
            const data = await response.json();
            renderPimpinanGradesChartData(data.data);
        }
    } catch (error) {
        console.error('[PimpinanDashboard] Error loading grades chart:', error);
    }
}

/**
 * Render pimpinan grades donut chart
 */
function renderPimpinanGradesChartData(data) {
    const canvas = document.getElementById('pimpinan-grades-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (pimpinanGradesChart) {
        pimpinanGradesChart.destroy();
    }

    const emeraldPalette = [
        'rgba(31, 168, 122, 0.85)',   // A
        'rgba(52, 201, 154, 0.7)',     // B
        'rgba(200, 150, 28, 0.75)',    // C
        'rgba(239, 68, 68, 0.65)'      // D
    ];

    pimpinanGradesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: data.datasets.map(ds => ({
                ...ds,
                backgroundColor: emeraldPalette.slice(0, data.labels.length),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverOffset: 8
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: EMERALD_COLORS.textSub,
                        usePointStyle: true,
                        padding: 10,
                        boxWidth: 10,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700
                }
            }
        }
    });
}

/**
 * Render evaluasi stats and feed
 */
function renderPimpinanEvaluasi(evaluasi) {
    // Update stats
    const totalEl = document.getElementById('pimpinan-eval-total');
    const prestasiEl = document.getElementById('pimpinan-eval-prestasi');
    const pelanggaranEl = document.getElementById('pimpinan-eval-pelanggaran');
    const pendingBadge = document.getElementById('pimpinan-evaluasi-pending-badge');

    if (totalEl) totalEl.textContent = evaluasi.total || 0;
    if (prestasiEl) prestasiEl.textContent = evaluasi.prestasi || 0;
    if (pelanggaranEl) pelanggaranEl.textContent = evaluasi.pelanggaran || 0;
    if (pendingBadge) pendingBadge.textContent = `${evaluasi.pending_approval || 0} Pending`;

    // Render feed
    const feedContainer = document.getElementById('pimpinan-evaluasi-feed');
    if (!feedContainer) return;

    const terbaru = evaluasi.terbaru || [];

    if (terbaru.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-state" style="padding: 1rem; text-align: center; color: #6b7280;">
                <span style="font-size: 1.5rem;">📋</span>
                <p style="margin-top: 0.5rem; font-size: 0.85rem;">Belum ada evaluasi</p>
            </div>
        `;
        return;
    }

    feedContainer.innerHTML = terbaru.map(ev => {
        const icon = ev.jenis === 'prestasi' ? '🏆' : '⚠️';
        const badgeClass = ev.is_approved ? 'approved' : 'pending';
        const badgeText = ev.is_approved ? 'Approved' : 'Pending';

        return `
            <div class="eval-feed-item">
                <span class="eval-feed-icon">${icon}</span>
                <div class="eval-feed-content">
                    <div class="eval-feed-title">${escapeHtml(ev.name)}</div>
                    <div class="eval-feed-meta">${escapeHtml(ev.siswa_nama)} · ${ev.siswa_kelas} · ${ev.tanggal}</div>
                </div>
                <span class="eval-feed-badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

/**
 * Render breakdown santri per kelas chart
 */
function renderPimpinanBreakdownChart(breakdownData) {
    const canvas = document.getElementById('pimpinan-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (pimpinanBreakdownChart) {
        pimpinanBreakdownChart.destroy();
    }

    if (!breakdownData || breakdownData.length === 0) {
        ctx.font = '14px Plus Jakarta Sans';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText('Tidak ada data kelas', canvas.width / 2, canvas.height / 2);
        return;
    }

    const labels = breakdownData.map(b => b.kelas || '-');
    const values = breakdownData.map(b => b.total);

    // Generate gradient colors
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, EMERALD_COLORS.emerald400);
    gradient.addColorStop(1, EMERALD_COLORS.emerald600);

    pimpinanBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Santri',
                data: values,
                backgroundColor: gradient,
                borderColor: EMERALD_COLORS.emerald600,
                borderWidth: 0,
                borderRadius: 4,
                barThickness: 28
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.emerald700,
                    callbacks: {
                        label: (ctx) => `${ctx.raw} santri`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: EMERALD_COLORS.gridColor },
                    ticks: { color: EMERALD_COLORS.textMuted }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: EMERALD_COLORS.textMain }
                }
            }
        }
    });
}

/**
 * Show error state for pimpinan dashboard
 */
function showPimpinanError(message) {
    const presensiTbody = document.getElementById('pimpinan-presensi-tbody');
    if (presensiTbody) {
        presensiTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #dc2626;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <p style="margin-top: 0.5rem;">${escapeHtml(message)}</p>
                    <button onclick="loadPimpinanDashboardData()" class="btn btn-primary btn-sm" style="margin-top: 0.5rem;">Coba Lagi</button>
                </td>
            </tr>
        `;
    }
}

// Export pimpinan dashboard functions
window.renderPimpinanDashboard = renderPimpinanDashboard;
window.loadPimpinanDashboardData = loadPimpinanDashboardData;

// ============================================
window.syncGradesUI = syncGradesUI;
window.renderWalisantriGradesTable = renderWalisantriGradesTable;
window.fetchWalisantriGradeStats = fetchWalisantriGradeStats;
window.renderWalisantriDashboard = renderWalisantriDashboard;
window.renderChildSelector = renderChildSelector;
window.onChildSelected = onChildSelected;
window.renderWorshipTracker = renderWorshipTracker;
window.fetchKesantrianSummary = fetchKesantrianSummary;
window.renderDualCharts = renderDualCharts;
window.printRapor = printRapor;
window.printBulkRapor = printBulkRapor;

// Multi-Child Sync Functions
window.resetStudentContext = resetStudentContext;
window.updateStudentContext = updateStudentContext;
window.clearAllUIElements = clearAllUIElements;
window.fetchStudentProfile = fetchStudentProfile;
window.fetchAcademicGrades = fetchAcademicGrades;
window.fetchWorshipTracker = fetchWorshipTracker;
window.fetchBehaviorSummary = fetchBehaviorSummary;

// ============================================
// AUTO-SYNC GRADES ON PAGE LOAD (WALISANTRI)
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main init to complete, then force sync grades
    setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'walisantri') {
            debugLog('[AUTO-SYNC] Walisantri detected, triggering grades sync...');
            syncGradesUI();
        }
    }, 1500); // Delay to ensure DOM is ready after main render
});
