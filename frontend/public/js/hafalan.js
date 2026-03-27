/**
 * ============================================
 * HAFALAN.JS - Program Al-Qur'an
 * Portal Ponpes Baron
 * Baron Light Emerald Theme
 * Multi-Role Views: Guru, Walisantri, Pimpinan
 * ============================================
 */

// ============================================
// SECTION 1: DATA DUMMY (JSON)
// ============================================

const hafalanData = {
    student: {
        id: 1,
        nama: "Ahmad Baihaqi",
        nisn: "0076540548",
        kelas: "XII A",
        program: "Tahfidz Intensif",
        foto: null
    },

    // Juz Progress Data (30 Juz)
    juzProgress: [
        { juz: 1, status: 'mutqin', tanggal: '2024-06-15', nilai: 92 },
        { juz: 2, status: 'mutqin', tanggal: '2024-08-20', nilai: 88 },
        { juz: 3, status: 'murojaah', tanggal: '2024-10-10', nilai: 85 },
        { juz: 4, status: 'proses', tanggal: null, nilai: 0 },
        { juz: 5, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 6, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 7, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 8, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 9, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 10, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 11, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 12, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 13, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 14, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 15, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 16, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 17, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 18, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 19, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 20, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 21, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 22, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 23, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 24, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 25, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 26, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 27, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 28, status: 'belum', tanggal: null, nilai: 0 },
        { juz: 29, status: 'mutqin', tanggal: '2024-04-10', nilai: 90 },
        { juz: 30, status: 'mutqin', tanggal: '2024-02-05', nilai: 95 }
    ],

    // Average days per juz (for prediction)
    avgDaysPerJuz: 21,

    tartil: [
        { id: 1, jilid: "Jilid 1", nilai: 85, capaian_persen: 100, status_lulus: true, tanggal_lulus: "2024-03-15" },
        { id: 2, jilid: "Jilid 2", nilai: 88, capaian_persen: 100, status_lulus: true, tanggal_lulus: "2024-06-20" },
        { id: 3, jilid: "Jilid 3", nilai: 82, capaian_persen: 100, status_lulus: true, tanggal_lulus: "2024-09-10" },
        { id: 4, jilid: "Tadarus", nilai: 78, capaian_persen: 75, status_lulus: false, tanggal_lulus: null },
        { id: 5, jilid: "Gharib", nilai: 0, capaian_persen: 0, status_lulus: false, tanggal_lulus: null },
        { id: 6, jilid: "Tajwid", nilai: 0, capaian_persen: 0, status_lulus: false, tanggal_lulus: null }
    ],

    tahfidz: [
        { id: 1, kategori: "Juz Hafal", nilai: 87, jumlah_juz: 5, total_juz_target: 12, detail: "Juz 1, 2, 3, 29, 30" },
        { id: 2, kategori: "Juz Uji", nilai: 90, jumlah_juz: 3, total_juz_target: 5, detail: "Juz 1, 2, 30 telah diuji" },
        { id: 3, kategori: "Tasmi'", nilai: 75, jumlah_juz: 0.65, total_juz_target: 1, detail: "Juz 4 - Halaman 62" },
        { id: 4, kategori: "Munaqosyah", nilai: 0, jumlah_juz: 0, total_juz_target: 1, detail: "Ujian Juz 4 - 25 Februari 2026" }
    ],

    kompetensi: {
        guru_tartil: "Ust. Abdullah Faqih",
        guru_tahfidz: "Ust. Muhammad Hafidz",
        status_khidmat: "Aktif",
        keterangan_khidmat: "Piket Masjid"
    },

    kehadiran: {
        bulan: "Februari 2026",
        hadir: 18,
        izin: 2,
        sakit: 0,
        alfa: 0,
        total_hari: 20,
        persentase: 90
    },

    catatan: "Santri menunjukkan perkembangan yang baik dalam hafalan. Perlu ditingkatkan pada aspek tajwid dan makhraj huruf. Target khatam 12 juz sebelum wisuda.",

    riwayat: [
        { tanggal: "2026-02-10", aktivitas: "Setoran Juz 4 halaman 60-62", hasil: "Lancar", guru: "Ust. Muhammad" },
        { tanggal: "2026-02-08", aktivitas: "Muroja'ah Juz 30", hasil: "Perlu perbaikan ayat 5-7 An-Naba", guru: "Ust. Muhammad" },
        { tanggal: "2026-02-05", aktivitas: "Tasmi' Juz 3", hasil: "Lulus", guru: "Ust. Abdullah" }
    ]
};

// Data dummy untuk Pimpinan (Summary per kelas)
const summaryData = {
    kelasComparison: [
        {
            kelas: "XII A",
            totalSantri: 30,
            lulusTartil: 24,
            rataJuzHafal: 6.5,
            rataKehadiran: 92,
            targetTercapai: 80
        },
        {
            kelas: "XII B",
            totalSantri: 28,
            lulusTartil: 20,
            rataJuzHafal: 5.8,
            rataKehadiran: 88,
            targetTercapai: 71
        },
        {
            kelas: "XII C",
            totalSantri: 25,
            lulusTartil: 18,
            rataJuzHafal: 5.2,
            rataKehadiran: 85,
            targetTercapai: 72
        }
    ],
    totals: {
        totalSantri: 83,
        totalLulusTartil: 62,
        rataJuzHafal: 5.83,
        rataKehadiran: 88.3,
        santriOnTrack: 65,
        santriNeedAttention: 18
    },
    topPerformers: [
        { nama: "Ahmad Baihaqi", kelas: "XII A", juzHafal: 12, status: "Khatam" },
        { nama: "Fatimah Azzahra", kelas: "XII A", juzHafal: 10, status: "On Track" },
        { nama: "Muhammad Fauzan", kelas: "XII B", juzHafal: 9, status: "On Track" }
    ]
};

// ============================================
// SECTION 2: STATE MANAGEMENT
// ============================================

let currentRole = 'guru'; // 'guru', 'walisantri', 'pimpinan'
let isEditing = false;
let unsavedChanges = {};
let chartInstances = {};

// ============================================
// SECTION 3: UTILITY FUNCTIONS
// ============================================

function getInitials(nama) {
    if (!nama) return 'XX';
    const words = nama.split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return nama.substring(0, 2).toUpperCase();
}

function getProgressFillClass(percent) {
    if (percent >= 100) return 'fill-good';
    if (percent >= 50) return 'fill-ok';
    if (percent > 0) return 'fill-ok';
    return '';
}

function getStatusBadge(statusLulus, capaianPersen) {
    if (statusLulus) {
        return '<span class="item-status badge badge-success">Lulus</span>';
    }
    if (capaianPersen > 0) {
        return '<span class="item-status badge badge-warning">Proses</span>';
    }
    return '<span class="item-status badge badge-info">Belum</span>';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.className = 'toast active ' + (type === 'error' ? 'error' : '');

        setTimeout(() => {
            toast.classList.remove('active');
            toast.classList.add('hide');
        }, 3000);
    }
}

function calculateOverallProgress(tahfidzData) {
    const juzHafal = tahfidzData.find(t => t.kategori === 'Juz Hafal');
    if (juzHafal) {
        return Math.round((juzHafal.jumlah_juz / juzHafal.total_juz_target) * 100);
    }
    return 0;
}

function setTextContent(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function destroyChart(chartKey) {
    if (chartInstances[chartKey]) {
        chartInstances[chartKey].destroy();
        delete chartInstances[chartKey];
    }
}

/**
 * Destroy ALL chart instances completely - prevents Chart Ghosting
 * Called before switching to a different child's data
 */
function destroyAllChartsCompletely() {
    // Destroy all registered chart instances
    Object.keys(chartInstances).forEach(key => {
        if (chartInstances[key] && typeof chartInstances[key].destroy === 'function') {
            chartInstances[key].destroy();
        }
    });
    chartInstances = {};

    // Also clear canvases to ensure no visual artifacts remain
    const canvasElements = document.querySelectorAll('.chart-wrap canvas');
    canvasElements.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Reset Student Identity Header to loading state (name stays as anchor)
    const avatarEl = document.getElementById('avatar-initials');
    if (avatarEl) avatarEl.textContent = '-';

    setTextContent('student-name', 'Memuat data...');
    setTextContent('student-kelas', 'Kelas -');

    const nisnEl = document.getElementById('student-nisn');
    if (nisnEl) nisnEl.textContent = 'NISN: -';

    setTextContent('student-program', '-');
    setTextContent('total-juz', '0');
    setTextContent('progress-percent', '0%');

    // Reset progress ring
    const progressRing = document.querySelector('.progress-ring');
    if (progressRing) {
        progressRing.style.setProperty('--progress', '0%');
    }

    // Reset Prediction Card to loading state
    const predictionCard = document.getElementById('hafalan-prediction');
    if (predictionCard) {
        predictionCard.classList.remove('khatam', 'near-khatam');
        predictionCard.classList.add('loading');
    }

    const predictionIcon = document.getElementById('prediction-icon');
    if (predictionIcon) predictionIcon.textContent = '📊';

    setTextContent('prediction-title', 'Memuat analisis...');
    setTextContent('prediction-desc', 'Menganalisis progress hafalan ananda');
    setTextContent('avg-days-per-juz', '-');
    setTextContent('remaining-juz', '-');

    // Reset Juz Grid
    const juzGrid = document.getElementById('juz-grid');
    if (juzGrid) {
        juzGrid.innerHTML = '<div class="loading-placeholder">Memuat data juz...</div>';
    }

    // Reset Juz Summary
    setTextContent('mutqin-count', '0');
    setTextContent('murojaah-count', '0');
    setTextContent('proses-count', '0');
    setTextContent('belum-count', '0');
}

// ============================================
// SECTION 4: CHART.JS FUNCTIONS (Baron Light Theme)
// ============================================

/**
 * Render Attendance Donut Chart - Baron Light Theme Colors
 */
function renderAttendanceChart(data) {
    const canvas = document.getElementById('kehadiranChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    destroyChart('kehadiran');

    chartInstances['kehadiran'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Izin', 'Sakit', 'Alfa'],
            datasets: [{
                data: [data.hadir, data.izin, data.sakit, data.alfa],
                backgroundColor: [
                    'rgba(31, 168, 122, 0.85)',   // Emerald - Hadir
                    'rgba(200, 150, 28, 0.85)',   // Baron Gold - Izin
                    'rgba(59, 130, 246, 0.85)',   // Blue - Sakit
                    'rgba(239, 68, 68, 0.85)'     // Red - Alfa
                ],
                borderColor: [
                    'rgba(31, 168, 122, 1)',
                    'rgba(200, 150, 28, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#3d6b57',
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12,
                            weight: '600',
                            family: "'Plus Jakarta Sans', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    titleFont: { size: 14, weight: '700', family: "'Plus Jakarta Sans', sans-serif" },
                    bodyFont: { size: 13, family: "'Plus Jakarta Sans', sans-serif" },
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.parsed;
                            const percentage = Math.round((value / total) * 100);
                            return ` ${context.label}: ${value} hari (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            animation: {
                animateRotate: true,
                animateScale: true
            }
        }
    });
}

/**
 * Render Bar Chart for Class Comparison (Pimpinan View) - Baron Light Theme
 */
function renderClassComparisonChart(data) {
    const canvas = document.getElementById('classComparisonChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    destroyChart('classComparison');

    const labels = data.map(d => d.kelas);
    const juzData = data.map(d => d.rataJuzHafal);
    const kehadiranData = data.map(d => d.rataKehadiran);
    const targetData = data.map(d => d.targetTercapai);

    chartInstances['classComparison'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Rata-rata Juz Hafal',
                    data: juzData,
                    backgroundColor: 'rgba(31, 168, 122, 0.8)',
                    borderColor: 'rgba(31, 168, 122, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7
                },
                {
                    label: 'Kehadiran (%)',
                    data: kehadiranData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7
                },
                {
                    label: 'Target Tercapai (%)',
                    data: targetData,
                    backgroundColor: 'rgba(200, 150, 28, 0.8)',
                    borderColor: 'rgba(200, 150, 28, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    barPercentage: 0.7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#3d6b57',
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            weight: '600',
                            family: "'Plus Jakarta Sans', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    titleFont: { size: 14, weight: '700' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 10
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(15, 99, 71, 0.1)'
                    },
                    ticks: {
                        color: '#3d6b57',
                        font: { size: 12, weight: '600' }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(15, 99, 71, 0.1)'
                    },
                    ticks: {
                        color: '#3d6b57',
                        font: { size: 11 }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

/**
 * Render Progress Trend Chart (Line) - Baron Light Theme
 */
function renderProgressTrendChart() {
    const canvas = document.getElementById('progressTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    destroyChart('progressTrend');

    chartInstances['progressTrend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb'],
            datasets: [
                {
                    label: 'XII A',
                    data: [4.2, 4.8, 5.3, 5.8, 6.2, 6.5],
                    borderColor: 'rgba(31, 168, 122, 1)',
                    backgroundColor: 'rgba(31, 168, 122, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'XII B',
                    data: [3.8, 4.2, 4.6, 5.0, 5.4, 5.8],
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'XII C',
                    data: [3.5, 3.9, 4.2, 4.6, 4.9, 5.2],
                    borderColor: 'rgba(200, 150, 28, 1)',
                    backgroundColor: 'rgba(200, 150, 28, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#3d6b57',
                        padding: 15,
                        usePointStyle: true,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y} Juz`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(15, 99, 71, 0.1)' },
                    ticks: { color: '#3d6b57' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(15, 99, 71, 0.1)' },
                    ticks: { color: '#3d6b57' }
                }
            }
        }
    });
}

// ============================================
// SECTION 5: RENDER - GURU VIEW (Editable)
// ============================================

function renderHafalanGuru() {
    renderPrediction();
    renderJuzProgressGrid();
    renderStudentProfile();
    renderTartilPanelGuru();
    renderTahfidzPanelGuru();
    renderKompetensiSection();
    renderKehadiranSection();
    renderCatatanSectionGuru();
    attachEventListeners();
}

function renderStudentProfile() {
    const student = hafalanData.student;
    const tahfidz = hafalanData.tahfidz;

    // Avatar initials
    const avatarEl = document.getElementById('avatar-initials');
    if (avatarEl) avatarEl.textContent = getInitials(student.nama);

    // Student name
    setTextContent('student-name', student.nama);

    // NISN with prefix
    const nisnEl = document.getElementById('student-nisn');
    if (nisnEl) nisnEl.textContent = 'NISN: ' + student.nisn;

    // Class with "Kelas" prefix for new header layout
    const kelasEl = document.getElementById('student-kelas');
    if (kelasEl) {
        // Check if it's the new identity header (has identity-class class)
        if (kelasEl.classList.contains('identity-class')) {
            kelasEl.textContent = 'Kelas ' + student.kelas;
        } else {
            kelasEl.textContent = student.kelas;
        }
    }

    setTextContent('student-program', student.program);

    // Juz progress
    const juzHafal = tahfidz.find(t => t.kategori === 'Juz Hafal');
    if (juzHafal) {
        const juzCount = juzHafal.jumlah_juz || 0;
        const progressPct = calculateOverallProgress(tahfidz);

        setTextContent('total-juz', juzCount);
        setTextContent('progress-percent', progressPct + '%');

        // Update progress ring CSS variable for conic-gradient
        const progressRing = document.querySelector('.progress-ring');
        if (progressRing) {
            progressRing.style.setProperty('--progress', progressPct + '%');
        }
    }
}

function renderTartilPanelGuru() {
    const container = document.getElementById('tartil-panel');
    if (!container) return;

    let html = '<ul class="hafalan-list">';

    hafalanData.tartil.forEach(item => {
        const fillClass = getProgressFillClass(item.capaian_persen);
        const statusBadge = getStatusBadge(item.status_lulus, item.capaian_persen);
        const itemClass = item.status_lulus ? 'completed' : (item.capaian_persen > 0 ? 'in-progress' : '');

        html += `
            <li class="hafalan-item ${itemClass}" data-id="${item.id}" data-type="tartil">
                <div class="item-info">
                    <span class="item-name">${item.jilid}</span>
                    ${statusBadge}
                </div>
                <div class="item-edit-row">
                    <div class="edit-group">
                        <label>Nilai:</label>
                        <input type="number" class="input-nilai glass-input-mini" value="${item.nilai}" min="0" max="100" data-field="nilai" data-id="${item.id}" data-type="tartil">
                    </div>
                    <div class="edit-group">
                        <label>Capaian:</label>
                        <div class="input-with-suffix">
                            <input type="number" class="input-capaian glass-input-mini" value="${item.capaian_persen}" min="0" max="100" data-field="capaian_persen" data-id="${item.id}" data-type="tartil">
                            <span class="input-suffix">%</span>
                        </div>
                    </div>
                    <div class="edit-group checkbox-group">
                        <label>
                            <input type="checkbox" class="input-lulus" ${item.status_lulus ? 'checked' : ''} data-field="status_lulus" data-id="${item.id}" data-type="tartil">
                            Lulus
                        </label>
                    </div>
                    <button class="btn-save-item" onclick="saveItemChanges(${item.id}, 'tartil')">Simpan</button>
                </div>
                <div class="item-progress">
                    <div class="mini-progress">
                        <div class="mini-track">
                            <div class="mini-fill ${fillClass}" style="width: ${item.capaian_persen}%;"></div>
                        </div>
                        <span class="mini-pct">${item.capaian_persen}%</span>
                    </div>
                </div>
            </li>
        `;
    });

    html += '</ul>';
    container.innerHTML = html;
}

function renderTahfidzPanelGuru() {
    const container = document.getElementById('tahfidz-panel');
    if (!container) return;

    let html = '<ul class="hafalan-list">';

    hafalanData.tahfidz.forEach(item => {
        const isJuzItem = item.kategori === 'Juz Hafal' || item.kategori === 'Juz Uji';
        const progressPercent = isJuzItem ? Math.round((item.jumlah_juz / item.total_juz_target) * 100) : 0;
        const fillClass = getProgressFillClass(progressPercent);
        const itemClass = isJuzItem ? 'highlight' : (item.nilai > 0 ? 'in-progress' : '');

        let statusBadge = '';
        if (item.kategori === "Tasmi'") statusBadge = '<span class="item-status badge badge-warning">Proses</span>';
        else if (item.kategori === 'Munaqosyah') statusBadge = '<span class="item-status badge badge-info">Terjadwal</span>';

        html += `
            <li class="hafalan-item ${itemClass}" data-id="${item.id}" data-type="tahfidz">
                <div class="item-info">
                    <span class="item-name">${item.kategori}</span>
                    ${isJuzItem ? `<span class="item-value">${item.jumlah_juz} Juz</span>` : statusBadge}
                </div>
                <div class="item-edit-row">
                    <div class="edit-group">
                        <label>Nilai:</label>
                        <input type="number" class="input-nilai glass-input-mini" value="${item.nilai}" min="0" max="100" data-field="nilai" data-id="${item.id}" data-type="tahfidz">
                    </div>
                    <div class="edit-group">
                        <label>Juz:</label>
                        <input type="number" class="input-juz glass-input-mini" value="${item.jumlah_juz}" min="0" max="30" step="0.5" data-field="jumlah_juz" data-id="${item.id}" data-type="tahfidz">
                    </div>
                    <button class="btn-save-item" onclick="saveItemChanges(${item.id}, 'tahfidz')">Simpan</button>
                </div>
                <div class="item-detail">
                    <span class="detail-text">${item.detail}</span>
                    ${isJuzItem ? `
                        <div class="mini-progress">
                            <div class="mini-track">
                                <div class="mini-fill ${fillClass}" style="width: ${progressPercent}%;"></div>
                            </div>
                            <span class="mini-pct">${progressPercent}%</span>
                        </div>
                    ` : ''}
                </div>
            </li>
        `;
    });

    html += '</ul>';
    container.innerHTML = html;
}

function renderKompetensiSection() {
    const kompetensi = hafalanData.kompetensi;
    setTextContent('guru-tartil', kompetensi.guru_tartil);
    setTextContent('guru-tahfidz', kompetensi.guru_tahfidz);

    const khidmatEl = document.getElementById('status-khidmat');
    if (khidmatEl) {
        khidmatEl.textContent = kompetensi.status_khidmat;
        khidmatEl.className = 'kompetensi-value badge ' + (kompetensi.status_khidmat === 'Aktif' ? 'badge-success' : 'badge-warning');
    }
}

function renderKehadiranSection() {
    const kehadiran = hafalanData.kehadiran;
    setTextContent('hadir-count', kehadiran.hadir);
    setTextContent('izin-count', kehadiran.izin);
    setTextContent('alpa-count', kehadiran.alfa);
    renderAttendanceChart(kehadiran);
}

// ============================================
// JUZ PROGRESS GRID (30 Juz Visualization)
// ============================================

function renderJuzProgressGrid() {
    const container = document.getElementById('juz-grid');
    if (!container) return;

    const juzProgress = hafalanData.juzProgress;

    let html = '';
    juzProgress.forEach(juz => {
        const statusIcon = getJuzStatusIcon(juz.status);
        const tooltip = getJuzTooltip(juz);

        html += `
            <div class="juz-cell ${juz.status}" data-juz="${juz.juz}" data-tooltip="${tooltip}">
                <span class="juz-number">${juz.juz}</span>
                <span class="juz-status-icon">${statusIcon}</span>
            </div>
        `;
    });

    container.innerHTML = html;

    // Update summary counts
    const counts = {
        mutqin: juzProgress.filter(j => j.status === 'mutqin').length,
        murojaah: juzProgress.filter(j => j.status === 'murojaah').length,
        proses: juzProgress.filter(j => j.status === 'proses').length,
        belum: juzProgress.filter(j => j.status === 'belum').length
    };

    setTextContent('mutqin-count', counts.mutqin);
    setTextContent('murojaah-count', counts.murojaah);
    setTextContent('proses-count', counts.proses);
    setTextContent('belum-count', counts.belum);
}

function getJuzStatusIcon(status) {
    const icons = {
        'mutqin': '✓',
        'murojaah': '↻',
        'proses': '◐',
        'belum': ''
    };
    return icons[status] || '';
}

function getJuzTooltip(juz) {
    const statusLabels = {
        'mutqin': 'Mutqin (Hafal Lancar)',
        'murojaah': 'Murojaah (Perlu Ulang)',
        'proses': 'Sedang Dihafal',
        'belum': 'Belum Dimulai'
    };

    let tooltip = `Juz ${juz.juz}: ${statusLabels[juz.status]}`;
    if (juz.tanggal) {
        tooltip += ` | ${formatDate(juz.tanggal)}`;
    }
    if (juz.nilai > 0) {
        tooltip += ` | Nilai: ${juz.nilai}`;
    }
    return tooltip;
}

// ============================================
// PREDICTION ANALYTICS
// ============================================

function renderPrediction() {
    const predictionCard = document.getElementById('hafalan-prediction');
    const predictionTitle = document.getElementById('prediction-title');
    const predictionDesc = document.getElementById('prediction-desc');
    const predictionIcon = document.getElementById('prediction-icon');
    const avgDaysEl = document.getElementById('avg-days-per-juz');
    const remainingEl = document.getElementById('remaining-juz');

    if (!predictionTitle) return;

    const juzProgress = hafalanData.juzProgress;
    const completedJuz = juzProgress.filter(j => j.status === 'mutqin' || j.status === 'murojaah').length;
    const mutqinJuz = juzProgress.filter(j => j.status === 'mutqin').length;
    const murojaahJuz = juzProgress.filter(j => j.status === 'murojaah').length;
    const remainingJuz = 30 - completedJuz;
    const avgDaysPerJuz = hafalanData.avgDaysPerJuz || 21;

    // Calculate prediction
    const estimatedDays = remainingJuz * avgDaysPerJuz;
    const estimatedMonths = Math.ceil(estimatedDays / 30);

    // Update stats
    if (avgDaysEl) avgDaysEl.textContent = avgDaysPerJuz;
    if (remainingEl) remainingEl.textContent = remainingJuz;

    // Remove previous state classes
    if (predictionCard) {
        predictionCard.classList.remove('loading', 'khatam', 'near-khatam');
    }

    // Format prediction based on progress state
    if (remainingJuz === 0) {
        // KHATAM STATE
        if (predictionCard) predictionCard.classList.add('khatam');
        if (predictionIcon) predictionIcon.textContent = '🎉';
        predictionTitle.innerHTML = `Alhamdulillah! Ananda telah <span class="highlight-juz">Khatam 30 Juz</span>`;
        if (predictionDesc) {
            predictionDesc.innerHTML = `${mutqinJuz} juz mutqin, ${murojaahJuz} juz murojaah. Semoga istiqomah menjaga hafalan.`;
        }
    } else if (remainingJuz <= 5) {
        // NEAR KHATAM STATE
        if (predictionCard) predictionCard.classList.add('near-khatam');
        if (predictionIcon) predictionIcon.textContent = '🏁';
        predictionTitle.innerHTML = `Tinggal <span class="highlight-juz">${remainingJuz} Juz</span> lagi menuju Khatam!`;
        if (predictionDesc) {
            predictionDesc.innerHTML = `Diperkirakan selesai dalam <span class="highlight-time">${estimatedDays} hari</span> (±${estimatedMonths} bulan) dengan kecepatan saat ini.`;
        }
    } else if (completedJuz > 0) {
        // IN PROGRESS STATE
        if (predictionIcon) predictionIcon.textContent = '🎯';
        predictionTitle.innerHTML = `Progress Hafalan: <span class="highlight-juz">${mutqinJuz}/30 Juz</span> Mutqin`;
        if (predictionDesc) {
            predictionDesc.innerHTML = `Dengan rata-rata ${avgDaysPerJuz} hari/juz, target khatam dalam <span class="highlight-time">${estimatedMonths} bulan</span>.`;
        }
    } else {
        // STARTING STATE
        if (predictionIcon) predictionIcon.textContent = '📖';
        predictionTitle.innerHTML = `Memulai Perjalanan Menghafal Al-Qur'an`;
        if (predictionDesc) {
            predictionDesc.innerHTML = `Ananda belum memiliki catatan hafalan. Mari mulai dari Juz 1 atau Juz 30.`;
        }
    }

    // Update tahfidz data to match juz progress
    const juzHafal = hafalanData.tahfidz.find(t => t.kategori === 'Juz Hafal');
    if (juzHafal) {
        juzHafal.jumlah_juz = mutqinJuz;
    }
}

function renderCatatanSectionGuru() {
    const kehadiranSection = document.getElementById('kehadiran-section');
    if (!kehadiranSection) return;

    let catatanSection = document.querySelector('.catatan-section');
    if (!catatanSection) {
        catatanSection = document.createElement('section');
        catatanSection.className = 'catatan-section glass-card';
        kehadiranSection.insertAdjacentElement('afterend', catatanSection);
    }

    catatanSection.innerHTML = `
        <div class="card-head">
            <h3><span class="ch-icon">📝</span> Catatan Guru</h3>
            <button class="btn btn-save-item" onclick="saveCatatan()">Simpan Catatan</button>
        </div>
        <div class="card-body">
            <div class="catatan-content">
                <textarea id="catatan-guru" class="glass-textarea" rows="4" placeholder="Tulis catatan perkembangan santri...">${hafalanData.catatan}</textarea>
            </div>
            <div class="riwayat-section">
                <h4 class="subsection-title">Riwayat Aktivitas Terakhir</h4>
                <ul class="riwayat-list">
                    ${hafalanData.riwayat.map(r => `
                        <li class="riwayat-item">
                            <span class="riwayat-tanggal">${formatDate(r.tanggal)}</span>
                            <span class="riwayat-aktivitas">${r.aktivitas}</span>
                            <span class="riwayat-hasil badge ${r.hasil === 'Lulus' || r.hasil === 'Lancar' ? 'badge-success' : 'badge-warning'}">${r.hasil}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

// ============================================
// SECTION 6: RENDER - WALISANTRI VIEW (Read-Only)
// ============================================

function renderHafalanWalisantri() {
    // Hide admin elements
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.getElementById('page-title').textContent = 'Hafalan Ananda';

    renderPrediction();
    renderJuzProgressGrid();
    renderStudentProfile();
    renderTartilPanelWalisantri();
    renderTahfidzPanelWalisantri();
    renderKompetensiSection();
    renderKehadiranSection();
    renderCatatanSectionWalisantri();
}

function renderTartilPanelWalisantri() {
    const container = document.getElementById('tartil-panel');
    if (!container) return;

    let html = '<ul class="hafalan-list">';

    hafalanData.tartil.forEach(item => {
        const fillClass = getProgressFillClass(item.capaian_persen);
        const statusBadge = getStatusBadge(item.status_lulus, item.capaian_persen);
        const itemClass = item.status_lulus ? 'completed' : (item.capaian_persen > 0 ? 'in-progress' : '');

        html += `
            <li class="hafalan-item ${itemClass}">
                <div class="item-info">
                    <span class="item-name">${item.jilid}</span>
                    ${statusBadge}
                </div>
                <div class="item-readonly">
                    <div class="readonly-group">
                        <span class="readonly-label">Nilai:</span>
                        <span class="readonly-value ${item.nilai >= 75 ? 'good' : (item.nilai > 0 ? 'warning' : '')}">${item.nilai || '-'}</span>
                    </div>
                    ${item.status_lulus && item.tanggal_lulus ? `
                        <div class="readonly-group">
                            <span class="readonly-label">Lulus:</span>
                            <span class="readonly-value">${formatDate(item.tanggal_lulus)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="item-progress">
                    <div class="mini-progress">
                        <div class="mini-track">
                            <div class="mini-fill ${fillClass}" style="width: ${item.capaian_persen}%;"></div>
                        </div>
                        <span class="mini-pct">${item.capaian_persen}%</span>
                    </div>
                </div>
            </li>
        `;
    });

    html += '</ul>';
    container.innerHTML = html;
}

function renderTahfidzPanelWalisantri() {
    const container = document.getElementById('tahfidz-panel');
    if (!container) return;

    let html = '<ul class="hafalan-list">';

    hafalanData.tahfidz.forEach(item => {
        const isJuzItem = item.kategori === 'Juz Hafal' || item.kategori === 'Juz Uji';
        const progressPercent = isJuzItem ? Math.round((item.jumlah_juz / item.total_juz_target) * 100) : 0;
        const fillClass = progressPercent >= 50 ? 'success' : 'warning';
        const itemClass = isJuzItem ? 'highlight' : '';

        let statusBadge = '';
        if (item.kategori === "Tasmi'") statusBadge = '<span class="item-status badge badge-warning">Proses</span>';
        else if (item.kategori === 'Munaqosyah') statusBadge = '<span class="item-status badge badge-info">Terjadwal</span>';

        html += `
            <li class="hafalan-item ${itemClass}">
                <div class="item-info">
                    <span class="item-name">${item.kategori}</span>
                    ${isJuzItem ? `<span class="item-value">${item.jumlah_juz} / ${item.total_juz_target} Juz</span>` : statusBadge}
                </div>
                ${isJuzItem ? `
                    <div class="juz-progress-visual">
                        <div class="progress-bar-large">
                            <div class="progress-fill-large ${fillClass}" style="width: ${progressPercent}%;">
                                <span class="progress-label">${progressPercent}%</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <div class="item-detail">
                    <span class="detail-text">${item.detail}</span>
                </div>
            </li>
        `;
    });

    html += '</ul>';
    container.innerHTML = html;
}

function renderCatatanSectionWalisantri() {
    const kehadiranSection = document.getElementById('kehadiran-section');
    if (!kehadiranSection) return;

    let catatanSection = document.querySelector('.catatan-section');
    if (!catatanSection) {
        catatanSection = document.createElement('section');
        catatanSection.className = 'catatan-section glass-card';
        kehadiranSection.insertAdjacentElement('afterend', catatanSection);
    }

    catatanSection.innerHTML = `
        <div class="card-head">
            <h3><span class="ch-icon">📝</span> Catatan dari Guru</h3>
        </div>
        <div class="card-body">
            <div class="catatan-content">
                <div class="catatan-readonly">
                    <p class="catatan-text">${hafalanData.catatan || 'Belum ada catatan dari guru.'}</p>
                </div>
            </div>
            <div class="riwayat-section">
                <h4 class="subsection-title">Aktivitas Terakhir Ananda</h4>
                <ul class="riwayat-list">
                    ${hafalanData.riwayat.map(r => `
                        <li class="riwayat-item">
                            <span class="riwayat-tanggal">${formatDate(r.tanggal)}</span>
                            <span class="riwayat-aktivitas">${r.aktivitas}</span>
                            <span class="riwayat-hasil badge ${r.hasil === 'Lulus' || r.hasil === 'Lancar' ? 'badge-success' : 'badge-warning'}">${r.hasil}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
}

// ============================================
// SECTION 7: RENDER - PIMPINAN VIEW (Summary)
// ============================================

function renderHafalanPimpinan() {
    document.getElementById('page-title').textContent = 'Dashboard Program Al-Qur\'an';

    // Hide individual student sections
    const profileSection = document.getElementById('profile-section');
    const hafalanGrid = document.getElementById('hafalan-grid');
    const kompetensiSection = document.getElementById('kompetensi-section');
    const kehadiranSection = document.getElementById('kehadiran-section');
    const footer = document.querySelector('.page-footer');

    if (profileSection) profileSection.style.display = 'none';
    if (hafalanGrid) hafalanGrid.style.display = 'none';
    if (kompetensiSection) kompetensiSection.style.display = 'none';
    if (kehadiranSection) kehadiranSection.style.display = 'none';

    // Create pimpinan dashboard
    renderPimpinanDashboard();
}

function renderPimpinanDashboard() {
    const pageBody = document.querySelector('.page-body');
    const roleSwitcher = document.getElementById('role-switcher-container');

    // Remove existing pimpinan section if any
    const existingDashboard = document.querySelector('.pimpinan-dashboard');
    if (existingDashboard) existingDashboard.remove();

    // Create dashboard container
    const dashboard = document.createElement('div');
    dashboard.className = 'pimpinan-dashboard';

    dashboard.innerHTML = `
        <!-- Summary Stats Cards -->
        <section class="summary-stats-section">
            <div class="summary-stats-grid">
                <div class="glass-card summary-stat-card stat-primary">
                    <div class="summary-stat-icon">
                        <span>👥</span>
                    </div>
                    <div class="summary-stat-info">
                        <div class="summary-stat-value">${summaryData.totals.totalSantri}</div>
                        <div class="summary-stat-label">Total Santri Aktif</div>
                    </div>
                </div>
                <div class="glass-card summary-stat-card stat-success">
                    <div class="summary-stat-icon">
                        <span>✅</span>
                    </div>
                    <div class="summary-stat-info">
                        <div class="summary-stat-value">${summaryData.totals.totalLulusTartil}</div>
                        <div class="summary-stat-label">Lulus Tartil</div>
                        <div class="summary-stat-sub">${Math.round((summaryData.totals.totalLulusTartil / summaryData.totals.totalSantri) * 100)}% dari total</div>
                    </div>
                </div>
                <div class="glass-card summary-stat-card stat-info">
                    <div class="summary-stat-icon">
                        <span>📖</span>
                    </div>
                    <div class="summary-stat-info">
                        <div class="summary-stat-value">${summaryData.totals.rataJuzHafal.toFixed(1)}</div>
                        <div class="summary-stat-label">Rata-rata Juz Hafal</div>
                    </div>
                </div>
                <div class="glass-card summary-stat-card stat-warning">
                    <div class="summary-stat-icon">
                        <span>📅</span>
                    </div>
                    <div class="summary-stat-info">
                        <div class="summary-stat-value">${summaryData.totals.rataKehadiran.toFixed(0)}%</div>
                        <div class="summary-stat-label">Rata-rata Kehadiran</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Charts Section -->
        <section class="pimpinan-charts-section">
            <div class="pimpinan-charts-grid">
                <div class="glass-card chart-card">
                    <div class="chart-header">
                        <h3>Perbandingan Antar Kelas</h3>
                    </div>
                    <div class="chart-container-large">
                        <canvas id="classComparisonChart"></canvas>
                    </div>
                </div>
                <div class="glass-card chart-card">
                    <div class="chart-header">
                        <h3>Tren Perkembangan Hafalan</h3>
                    </div>
                    <div class="chart-container-large">
                        <canvas id="progressTrendChart"></canvas>
                    </div>
                </div>
            </div>
        </section>

        <!-- Class Detail Table -->
        <section class="glass-card class-detail-section">
            <div class="section-header">
                <h3 class="section-title">Detail Per Kelas</h3>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Kelas</th>
                            <th>Total Santri</th>
                            <th>Lulus Tartil</th>
                            <th>Rata-rata Juz</th>
                            <th>Kehadiran</th>
                            <th>Target Tercapai</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryData.kelasComparison.map(k => `
                            <tr>
                                <td><strong>${k.kelas}</strong></td>
                                <td>${k.totalSantri}</td>
                                <td>${k.lulusTartil} <span class="text-muted">(${Math.round((k.lulusTartil / k.totalSantri) * 100)}%)</span></td>
                                <td>${k.rataJuzHafal} Juz</td>
                                <td>${k.rataKehadiran}%</td>
                                <td>
                                    <div class="progress-inline">
                                        <div class="progress-bar-inline">
                                            <div class="progress-fill-inline ${k.targetTercapai >= 75 ? 'success' : 'warning'}" style="width: ${k.targetTercapai}%;"></div>
                                        </div>
                                        <span>${k.targetTercapai}%</span>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge ${k.targetTercapai >= 75 ? 'badge-success' : 'badge-warning'}">
                                        ${k.targetTercapai >= 75 ? 'On Track' : 'Perlu Perhatian'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Top Performers -->
        <section class="glass-card top-performers-section">
            <div class="section-header">
                <h3 class="section-title">Santri Berprestasi</h3>
            </div>
            <div class="top-performers-grid">
                ${summaryData.topPerformers.map((p, i) => `
                    <div class="performer-card ${i === 0 ? 'gold' : (i === 1 ? 'silver' : 'bronze')}">
                        <div class="performer-rank">#${i + 1}</div>
                        <div class="performer-info">
                            <div class="performer-name">${p.nama}</div>
                            <div class="performer-class">${p.kelas}</div>
                        </div>
                        <div class="performer-stats">
                            <div class="performer-juz">${p.juzHafal} Juz</div>
                            <span class="badge ${p.status === 'Khatam' ? 'badge-success' : 'badge-info'}">${p.status}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;

    roleSwitcher.insertAdjacentElement('afterend', dashboard);

    // Render charts after DOM is updated
    setTimeout(() => {
        renderClassComparisonChart(summaryData.kelasComparison);
        renderProgressTrendChart();
    }, 100);
}

// ============================================
// SECTION 8: EVENT HANDLERS
// ============================================

function attachEventListeners() {
    document.querySelectorAll('.input-nilai, .input-capaian, .input-juz, .input-lulus').forEach(input => {
        input.addEventListener('change', function() {
            const id = this.dataset.id;
            const type = this.dataset.type;
            const field = this.dataset.field;
            const value = this.type === 'checkbox' ? this.checked : parseFloat(this.value);
            trackChange(id, type, field, value);
            this.classList.add('changed');
        });
    });

    const filterBulan = document.getElementById('filter-bulan');
    if (filterBulan) {
        filterBulan.addEventListener('change', function() {
            showToast('Data bulan diperbarui');
        });
    }

    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', exportHafalanData);
    }
}

function trackChange(id, type, field, value) {
    const key = `${type}_${id}`;
    if (!unsavedChanges[key]) {
        unsavedChanges[key] = { id, type, changes: {} };
    }
    unsavedChanges[key].changes[field] = value;
    isEditing = true;
}

function saveItemChanges(id, type) {
    const container = document.querySelector(`[data-id="${id}"][data-type="${type}"]`);
    if (!container) return;

    const nilaiInput = container.querySelector('.input-nilai');
    const nilai = nilaiInput ? parseFloat(nilaiInput.value) : 0;

    if (type === 'tartil') {
        const item = hafalanData.tartil.find(t => t.id === id);
        if (item) {
            const capaianInput = container.querySelector('.input-capaian');
            const lulusInput = container.querySelector('.input-lulus');

            item.nilai = nilai;
            item.capaian_persen = capaianInput ? parseFloat(capaianInput.value) : item.capaian_persen;
            item.status_lulus = lulusInput ? lulusInput.checked : item.status_lulus;

            if (item.status_lulus && !item.tanggal_lulus) {
                item.tanggal_lulus = new Date().toISOString().split('T')[0];
            }
        }
    } else if (type === 'tahfidz') {
        const item = hafalanData.tahfidz.find(t => t.id === id);
        if (item) {
            const juzInput = container.querySelector('.input-juz');
            item.nilai = nilai;
            item.jumlah_juz = juzInput ? parseFloat(juzInput.value) : item.jumlah_juz;
        }
    }

    delete unsavedChanges[`${type}_${id}`];
    container.querySelectorAll('.changed').forEach(el => el.classList.remove('changed'));

    showToast(`Data ${type} berhasil disimpan!`);

    if (type === 'tartil') renderTartilPanelGuru();
    else renderTahfidzPanelGuru();

    renderStudentProfile();
    attachEventListeners();
}

function saveCatatan() {
    const textarea = document.getElementById('catatan-guru');
    if (!textarea) return;
    hafalanData.catatan = textarea.value;
    showToast('Catatan berhasil disimpan!');
}

function exportHafalanData() {
    const exportData = {
        student: hafalanData.student,
        tartil: hafalanData.tartil,
        tahfidz: hafalanData.tahfidz,
        kehadiran: hafalanData.kehadiran,
        catatan: hafalanData.catatan,
        exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hafalan_${hafalanData.student.nisn}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Data berhasil di-export!');
}

function saveAllChanges() {
    if (Object.keys(unsavedChanges).length === 0) {
        showToast('Tidak ada perubahan untuk disimpan', 'info');
        return;
    }

    Object.keys(unsavedChanges).forEach(key => {
        const { id, type } = unsavedChanges[key];
        saveItemChanges(id, type);
    });

    unsavedChanges = {};
    isEditing = false;
    showToast('Semua perubahan berhasil disimpan!');
}

// ============================================
// SECTION 9: ROLE SWITCHER (Demo)
// ============================================

function switchRole(role) {
    currentRole = role;

    // Destroy all charts
    Object.keys(chartInstances).forEach(key => destroyChart(key));

    // Remove dynamic sections
    const catatanSection = document.querySelector('.catatan-section');
    const pimpinanDashboard = document.querySelector('.pimpinan-dashboard');
    if (catatanSection) catatanSection.remove();
    if (pimpinanDashboard) pimpinanDashboard.remove();

    // Show all hidden sections
    const profileSection = document.getElementById('profile-section');
    const hafalanGrid = document.getElementById('hafalan-grid');
    const kompetensiSection = document.getElementById('kompetensi-section');
    const kehadiranSection = document.getElementById('kehadiran-section');

    if (profileSection) profileSection.style.display = '';
    if (hafalanGrid) hafalanGrid.style.display = '';
    if (kompetensiSection) kompetensiSection.style.display = '';
    if (kehadiranSection) kehadiranSection.style.display = '';

    // Render based on role
    if (role === 'pimpinan') {
        renderHafalanPimpinan();
    } else if (role === 'walisantri') {
        renderHafalanWalisantri();
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
        document.getElementById('page-title').textContent = 'Program Al-Qur\'an';
        renderHafalanGuru();
    }

    showToast(`Mode: ${role.charAt(0).toUpperCase() + role.slice(1)}`);
}

// ============================================
// SECTION 10: INITIALIZATION
// ============================================

function initHafalan() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    currentRole = user.role || 'guru';

    // Read persisted child selection from localStorage (for multi-child state consistency)
    const selectedChildNisn = localStorage.getItem('selected_child_nisn');
    const selectedChildData = localStorage.getItem('selected_child_data');

    if (selectedChildData) {
        try {
            const child = JSON.parse(selectedChildData);
            // Update student profile with selected child data
            hafalanData.student.nama = child.nama || hafalanData.student.nama;
            hafalanData.student.nisn = child.nisn || hafalanData.student.nisn;
            hafalanData.student.kelas = child.kelas || hafalanData.student.kelas;
        } catch (e) {
            console.warn('Could not parse selected child data:', e);
        }
    }

    // Render based on actual user role from session
    if (currentRole === 'pimpinan') {
        renderHafalanPimpinan();
    } else if (currentRole === 'walisantri') {
        renderHafalanWalisantri();
    } else {
        // Default: guru, superadmin - editable view
        renderHafalanGuru();
    }

    // Listen for child switch events from other pages
    window.addEventListener('childSwitched', function(e) {
        if (e.detail && e.detail.child) {
            const child = e.detail.child;

            // IMPORTANT: Destroy all charts BEFORE updating data
            // This prevents "Chart Ghosting" where old child's data shadows new child
            destroyAllChartsCompletely();

            // Update student data
            hafalanData.student.nama = child.nama || hafalanData.student.nama;
            hafalanData.student.nisn = child.nisn || hafalanData.student.nisn;
            hafalanData.student.kelas = child.kelas || hafalanData.student.kelas;

            // Re-render if walisantri
            if (currentRole === 'walisantri') {
                renderHafalanWalisantri();
            }
        }
    });

    window.addEventListener('beforeunload', function(e) {
        if (isEditing && Object.keys(unsavedChanges).length > 0) {
            e.preventDefault();
            e.returnValue = 'Ada perubahan yang belum disimpan.';
            return e.returnValue;
        }
    });
}

// ============================================
// SECTION 11: WINDOW EXPORTS
// ============================================

window.saveItemChanges = saveItemChanges;
window.saveCatatan = saveCatatan;
window.saveAllChanges = saveAllChanges;
window.exportHafalanData = exportHafalanData;
window.switchRole = switchRole;

// ============================================
// SECTION 12: DOM READY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Hafalan] Admin page detected, skipping init');
        return;
    }
    initHafalan();
});
