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
    } else {
        debugLog('[Dashboard] Admin/Pimpinan detected, rendering admin dashboard');
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
        kehadiranEl.textContent = stats.persentase_kehadiran
            ? `${stats.persentase_kehadiran}%`
            : '-%';
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
 * Render materi list from e_report (jurnal mengajar)
 * @param {Array} materiList - Array of jurnal/materi objects
 */
function renderGuruMateriList(materiList) {
    const container = document.getElementById('guru-materi-list');
    if (!container) return;

    // Empty state
    if (!materiList || materiList.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>Belum ada jurnal mengajar hari ini</p>
                <a href="/attendance/" class="btn btn-primary btn-sm">Input Jurnal</a>
            </div>
        `;
        return;
    }

    // Render materi items
    container.innerHTML = materiList.map(item => `
        <div class="materi-item">
            <div class="materi-header">
                <span class="materi-kelas">${escapeHtml(item.kelas)}</span>
                <span class="materi-mapel">${escapeHtml(item.mata_pelajaran || '-')}</span>
            </div>
            <div class="materi-content">${escapeHtml(item.materi || 'Tidak ada materi tercatat')}</div>
            ${item.capaian_pembelajaran ? `<div class="materi-tujuan">📌 ${escapeHtml(item.capaian_pembelajaran)}</div>` : ''}
        </div>
    `).join('');
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

// ============================================================
// WALISANTRI DASHBOARD - Student Profile View
// ============================================================

async function renderWalisantriDashboard() {
    // Hide admin dashboard, show walisantri dashboard
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

    // Check for linked students (multi-child support)
    const linkedStudents = currentUser?.linked_students || [];
    const hasLinkedStudent = currentUser?.linked_student_nisn || linkedStudents.length > 0;

    if (!currentUser || !hasLinkedStudent) {
        console.warn('[Walisantri Dashboard] No linked student found!');
        profileContent.innerHTML = `
            <div class="empty-state-card glass-card" style="padding: 40px; text-align: center;">
                <div class="empty-state-icon" style="font-size: 64px; margin-bottom: 20px;">👨‍👩‍👧</div>
                <h3 style="color: white; margin-bottom: 15px;">Belum Ada Data Ananda</h3>
                <p style="color: rgba(255,255,255,0.7);">Akun Anda belum terhubung dengan data siswa. Silakan hubungi admin untuk menghubungkan akun dengan data ananda.</p>
                <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px; color: rgba(255,255,255,0.6);">
                    <strong>Debug Info:</strong><br>
                    username: ${currentUser?.username || 'NULL'}<br>
                    role: ${currentUser?.role || 'NULL'}<br>
                    linked_student_nisn: ${currentUser?.linked_student_nisn || 'NULL'}<br>
                    linked_students: ${JSON.stringify(linkedStudents)}
                </div>
            </div>
        `;
        return;
    }

    // Set up multi-child support
    if (linkedStudents.length > 1) {
        childrenData = linkedStudents;
        selectedChildNisn = selectedChildNisn || linkedStudents[0].nisn;
    } else if (linkedStudents.length === 1) {
        selectedChildNisn = linkedStudents[0].nisn;
    } else {
        selectedChildNisn = currentUser.linked_student_nisn;
    }

    // Show loading state
    profileContent.innerHTML = `
        <div class="profile-loading glass-card" style="padding: 40px; text-align: center;">
            <div class="loading-spinner"></div>
            <p style="color: rgba(255,255,255,0.8); margin-top: 15px;">Memuat profil ananda...</p>
        </div>
    `;

    try {
        const nisn = currentUser.linked_student_nisn;

        // Fetch student data and additional stats in parallel
        const [student, attendanceStats, gradeStats, evaluationStats] = await Promise.all([
            window.apiCall(`students/${nisn}/`),
            fetchWalisantriAttendanceStats(nisn).catch(() => null),
            fetchWalisantriGradeStats(nisn).catch(() => null),
            fetchWalisantriEvaluationStats(nisn).catch(() => null)
        ]);

        const progressPercent = student.progress_hafalan_percentage || 0;
        const hafalanStatus = student.hafalan_status === 'above_target';
        const attendancePercent = attendanceStats?.persentase_kehadiran || 0;
        const avgGrade = gradeStats?.rata_rata || '-';
        const initials = getWalisantriInitials(student.nama);

        const statusBadgeHtml = student.aktif
            ? `<span class="profile-status-badge status-aktif">Aktif</span>`
            : `<span class="profile-status-badge status-lulus">Alumni</span>`;

        // Check if we have multiple children for selector
        const showChildSelector = linkedStudents.length > 1;

        profileContent.innerHTML = `
            <div class="student-profile-dashboard">
                <!-- Multi-Child Selector (if applicable) -->
                ${showChildSelector ? `
                <div class="child-selector-section" id="child-selector-container">
                    <div class="child-selector glass-card">
                        <div class="selector-header">
                            <span class="selector-icon">👨‍👩‍👧‍👦</span>
                            <span class="selector-label">Pilih Anak:</span>
                        </div>
                        <select id="child-dropdown" class="child-dropdown" onchange="onChildSelected(this.value)">
                            ${linkedStudents.map(child => `
                                <option value="${child.nisn}" ${child.nisn === nisn ? 'selected' : ''}>
                                    ${escapeHtml(child.nama)} (${child.kelas || '-'})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                ` : ''}

                <!-- Profile Card -->
                <div class="profile-card glass-card">
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <div class="avatar-circle">
                                ${student.foto ? `<img src="${student.foto}" alt="${student.nama}">` : `<span class="avatar-initials">${initials}</span>`}
                            </div>
                            ${statusBadgeHtml}
                        </div>
                        <div class="profile-info">
                            <h2 class="profile-name">${escapeHtml(student.nama)}</h2>
                            <p class="profile-nisn">NISN: ${escapeHtml(student.nisn)}</p>
                            <div class="profile-tags">
                                <span class="profile-tag tag-kelas">📚 ${escapeHtml(student.kelas) || 'Belum ada kelas'}</span>
                                <span class="profile-tag tag-program">🎯 ${escapeHtml(student.program) || 'Reguler'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Flashcards Stats Section -->
                <div class="flashcards-section">
                    <h3 class="section-title">Ringkasan Pencapaian</h3>
                    <div class="flashcards-grid">
                        <!-- Hafalan Flashcard -->
                        <div class="flashcard flashcard-hafalan">
                            <div class="flashcard-icon">🏆</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Hafalan Al-Quran</div>
                                <div class="flashcard-value">${student.current_hafalan || 0}/${student.target_hafalan || 0} <span class="unit">Juz</span></div>
                                <div class="flashcard-progress">
                                    <div class="progress-track">
                                        <div class="progress-fill ${hafalanStatus ? 'above' : 'below'}" style="width: ${progressPercent}%"></div>
                                    </div>
                                    <span class="progress-text">${progressPercent}%</span>
                                </div>
                                <div class="flashcard-status ${hafalanStatus ? 'status-good' : 'status-warning'}">
                                    ${hafalanStatus ? '✓ Di atas target' : '⚠ Perlu ditingkatkan'}
                                </div>
                            </div>
                        </div>

                        <!-- Grade Flashcard -->
                        <div class="flashcard flashcard-grade">
                            <div class="flashcard-icon">📊</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Rata-rata Nilai</div>
                                <div class="flashcard-value flashcard-big" id="total-avg-display">${avgGrade}</div>
                                <div class="flashcard-subtitle">
                                    <span id="total-subjects-display">${gradeStats?.jumlah_mata_pelajaran || 0}</span> Mata Pelajaran | Target: ${student.target_nilai || 75}
                                </div>
                                <div class="flashcard-status ${parseFloat(avgGrade) >= (student.target_nilai || 75) ? 'status-good' : 'status-warning'}">
                                    ${parseFloat(avgGrade) >= (student.target_nilai || 75) ? '✓ Memenuhi target' : '⚠ Di bawah target'}
                                </div>
                            </div>
                        </div>

                        <!-- Attendance Flashcard -->
                        <div class="flashcard flashcard-attendance">
                            <div class="flashcard-icon">📅</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Kehadiran</div>
                                <div class="flashcard-value flashcard-big">${attendancePercent}<span class="unit">%</span></div>
                                <div class="flashcard-progress">
                                    <div class="progress-track">
                                        <div class="progress-fill ${attendancePercent >= 90 ? 'above' : 'below'}" style="width: ${attendancePercent}%"></div>
                                    </div>
                                </div>
                                <div class="flashcard-status ${attendancePercent >= 90 ? 'status-good' : 'status-warning'}">
                                    ${attendancePercent >= 90 ? '✓ Kehadiran baik' : '⚠ Perlu ditingkatkan'}
                                </div>
                            </div>
                        </div>

                        <!-- Evaluation Flashcard -->
                        <div class="flashcard flashcard-achievement">
                            <div class="flashcard-icon">⭐</div>
                            <div class="flashcard-content">
                                <div class="flashcard-label">Evaluasi</div>
                                <div class="flashcard-value flashcard-big">${evaluationStats?.total_evaluations || 0}</div>
                                <div class="flashcard-subtitle">
                                    <span style="color: #10b981;">✓ ${evaluationStats?.prestasi_count || 0} Prestasi</span> |
                                    <span style="color: #ef4444;">⚠ ${evaluationStats?.pelanggaran_count || 0} Pelanggaran</span>
                                </div>
                                <div class="flashcard-badges">
                                    ${generateWalisantriBadges(student, evaluationStats)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Details Section -->
                <div class="details-section">
                    <div class="details-grid">
                        <!-- Biodata Card -->
                        <div class="detail-card glass-card">
                            <div class="detail-card-header">
                                <span class="detail-card-icon">📋</span>
                                <h4>Biodata Siswa</h4>
                            </div>
                            <div class="detail-card-body">
                                <div class="detail-row">
                                    <span class="detail-label">Email</span>
                                    <span class="detail-value">${escapeHtml(student.email) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">No. HP</span>
                                    <span class="detail-value">${escapeHtml(student.phone) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Tanggal Masuk</span>
                                    <span class="detail-value">${formatWalisantriDate(student.tanggal_masuk) || '-'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Guardian Info Card -->
                        <div class="detail-card glass-card">
                            <div class="detail-card-header">
                                <span class="detail-card-icon">👨‍👩‍👧</span>
                                <h4>Informasi Wali</h4>
                            </div>
                            <div class="detail-card-body">
                                <div class="detail-row">
                                    <span class="detail-label">Nama Wali</span>
                                    <span class="detail-value">${escapeHtml(student.wali_nama) || '-'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">No. HP Wali</span>
                                    <span class="detail-value">${escapeHtml(student.wali_phone) || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Worship Tracker Section -->
                <div class="worship-section">
                    <h3 class="section-title">Ibadah Harian</h3>
                    <div id="worship-tracker-container" class="glass-card">
                        <div class="loading-mini">Memuat data ibadah...</div>
                    </div>
                </div>

                <!-- Grades Section -->
                <div class="grades-section">
                    <h3 class="section-title">Nilai Akademik</h3>
                    <div id="walisantri-grades-container" class="glass-card">
                        <div class="loading-mini">Memuat data nilai...</div>
                    </div>
                </div>

                <!-- Dual-Chart Visualization Section -->
                <div class="dual-chart-section">
                    <h3 class="section-title">Visualisasi Pencapaian</h3>
                    <div class="dual-chart-grid">
                        <!-- Chart A: Academic (Emerald) -->
                        <div class="chart-card glass-card">
                            <div class="chart-header">
                                <span class="chart-icon academic">📚</span>
                                <h4>Nilai Akademik</h4>
                            </div>
                            <div class="chart-container">
                                <canvas id="academic-radar-chart"></canvas>
                            </div>
                            <div id="academic-chart-loading" class="chart-loading">
                                <div class="loading-mini">Memuat chart...</div>
                            </div>
                        </div>

                        <!-- Chart B: Diniyah/Pondok (Baron Gold) -->
                        <div class="chart-card glass-card">
                            <div class="chart-header">
                                <span class="chart-icon diniyah">📖</span>
                                <h4>Diniyah & Tahfidz</h4>
                            </div>
                            <div class="chart-container">
                                <canvas id="diniyah-bar-chart"></canvas>
                            </div>
                            <div id="diniyah-chart-loading" class="chart-loading">
                                <div class="loading-mini">Memuat chart...</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions-section">
                    <h3 class="section-title">Akses Cepat</h3>
                    <div class="quick-actions-grid">
                        <a href="/attendance" class="quick-action-btn glass-card">
                            <span class="qa-icon">📅</span>
                            <span class="qa-label">Lihat Absensi</span>
                        </a>
                        <a href="/grades" class="quick-action-btn glass-card">
                            <span class="qa-icon">📝</span>
                            <span class="qa-label">Lihat Nilai</span>
                        </a>
                        <a href="/evaluations" class="quick-action-btn glass-card">
                            <span class="qa-icon">⭐</span>
                            <span class="qa-label">Lihat Evaluasi</span>
                        </a>
                        <button onclick="printRapor('${nisn}')" class="quick-action-btn glass-card print-btn">
                            <span class="qa-icon">🖨️</span>
                            <span class="qa-label">Cetak Rapor</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Render the grades table after DOM is updated
        if (gradeStats && gradeStats.grades) {
            renderWalisantriGradesTable(gradeStats, 'walisantri-grades-container');
        }

        // Render the worship tracker
        renderWorshipTracker(nisn);

        // Render the dual charts
        renderDualCharts(nisn);

    } catch (error) {
        console.error('Error loading walisantri dashboard:', error);
        profileContent.innerHTML = `
            <div class="error-state-card glass-card" style="padding: 40px; text-align: center;">
                <div class="error-state-icon" style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
                <h3 style="color: white; margin-bottom: 15px;">Gagal Memuat Data</h3>
                <p style="color: rgba(255,255,255,0.7);">Terjadi kesalahan saat memuat data ananda. Silakan coba lagi.</p>
                <button onclick="renderWalisantriDashboard()" class="btn btn-primary" style="margin-top: 20px;">Coba Lagi</button>
            </div>
        `;
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
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/kesantrian/worship-tracker/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
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
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/kesantrian/worship-tracker/${targetNisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
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
