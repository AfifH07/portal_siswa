/**
 * ============================================
 * HAFALAN.JS - Program Al-Qur'an
 * Portal Ponpes Baron
 * Baron Light Emerald Theme
 * Multi-Role Views: Guru, Walisantri, Pimpinan
 * ============================================
 */

// ============================================
// SECTION 1: DATA PLACEHOLDER (API-First)
// ============================================
// NOTE: Dummy data removed in v2.3.7 cleanup
// All data now loaded from API endpoints:
// - GET /api/kesantrian/hafalan/{nisn}/ - Student hafalan data
// - GET /api/kesantrian/hafalan/dashboard-stats/ - Pimpinan summary

// Empty state templates for when API returns no data
const EMPTY_STATE = {
    student: { id: null, nama: '', nisn: '', kelas: '', program: '', foto: null },
    juzProgress: [],
    tartil: [],
    tahfidz: [],
    kompetensi: { guru_tartil: '-', guru_tahfidz: '-', status_khidmat: '-', keterangan_khidmat: '-' },
    kehadiran: { bulan: '-', hadir: 0, izin: 0, sakit: 0, alfa: 0, total_hari: 0, persentase: 0 },
    catatan: 'Belum ada catatan.',
    riwayat: []
};

const JUZ_HALAMAN_MAP = {
    1: [1, 21], 2: [22, 41], 3: [42, 61], 4: [62, 81], 5: [82, 101],
    6: [102, 121], 7: [122, 141], 8: [142, 161], 9: [162, 181], 10: [182, 201],
    11: [202, 221], 12: [222, 241], 13: [242, 261], 14: [262, 281], 15: [282, 301],
    16: [302, 321], 17: [322, 341], 18: [342, 361], 19: [362, 381], 20: [382, 401],
    21: [402, 421], 22: [422, 441], 23: [442, 461], 24: [462, 481], 25: [482, 501],
    26: [502, 521], 27: [522, 541], 28: [542, 561], 29: [562, 581], 30: [582, 604]
};

const EMPTY_SUMMARY = {
    kelasComparison: [],
    totals: { totalSantri: 0, totalLulusTartil: 0, rataJuzHafal: 0, rataKehadiran: 0, santriOnTrack: 0, santriNeedAttention: 0 },
    topPerformers: []
};

// ============================================
// SECTION 2: STATE MANAGEMENT
// ============================================

let currentRole = 'guru'; // 'guru', 'walisantri', 'pimpinan'
let isEditing = false;
let unsavedChanges = {};
let chartInstances = {};

// Initialize hafalanData with empty state (will be populated from API)
let hafalanData = JSON.parse(JSON.stringify(EMPTY_STATE));

// Initialize summaryData for pimpinan view
let summaryData = JSON.parse(JSON.stringify(EMPTY_SUMMARY));

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
 * v2.3.7: Now accepts API data instead of hardcoded values
 */
function renderProgressTrendChart(trendData = null) {
    const canvas = document.getElementById('progressTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    destroyChart('progressTrend');

    // Show empty state if no data
    if (!trendData || !trendData.labels || trendData.labels.length === 0) {
        const container = canvas.parentElement;
        if (container) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #6b7280;">
                    <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
                    <p style="margin: 0; font-size: 14px;">Belum ada data trend hafalan</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af;">Data akan muncul setelah periode berjalan</p>
                </div>
            `;
        }
        return;
    }

    // Build datasets from API data
    const colors = [
        { border: 'rgba(31, 168, 122, 1)', bg: 'rgba(31, 168, 122, 0.1)' },
        { border: 'rgba(59, 130, 246, 1)', bg: 'rgba(59, 130, 246, 0.1)' },
        { border: 'rgba(200, 150, 28, 1)', bg: 'rgba(200, 150, 28, 0.1)' },
        { border: 'rgba(239, 68, 68, 1)', bg: 'rgba(239, 68, 68, 0.1)' },
        { border: 'rgba(139, 92, 246, 1)', bg: 'rgba(139, 92, 246, 0.1)' }
    ];

    const datasets = (trendData.datasets || []).map((ds, i) => ({
        label: ds.label || `Kelas ${i + 1}`,
        data: ds.data || [],
        borderColor: colors[i % colors.length].border,
        backgroundColor: colors[i % colors.length].bg,
        tension: 0.4,
        fill: true
    }));

    chartInstances['progressTrend'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: datasets
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

async function renderHafalanGuru() {
    const nisn = hafalanData.student.nisn;
    if (nisn) {
        try {
            const rawRes = await window.apiFetch(`kesantrian/hafalan/siswa/${nisn}/`);
            const res = await rawRes.json();
            if (res.success && res.data) {
                // Build juzProgress: array 30 juz (juz 1–30)
                const juzSummary = res.data.juz_summary || [];
                const juzMap = {};
                juzSummary.forEach(j => { juzMap[j.juz] = j.halaman || 0; });

                hafalanData.juzProgress = Array.from({ length: 30 }, (_, i) => {
                    const juzNum = i + 1;
                    const halaman = juzMap[juzNum] || 0;
                    let status = 'belum';
                    if (halaman >= 20) status = 'murojaah';
                    else if (halaman > 0) status = 'proses';
                    return {
                        juz: juzNum,
                        status: status,
                        halaman: halaman
                    };
                });

                // Populate student data if not already set
                if (res.data.siswa) {
                    hafalanData.student.nama = hafalanData.student.nama || res.data.siswa.nama;
                    hafalanData.student.kelas = hafalanData.student.kelas || res.data.siswa.kelas;
                }
            }

            const tartilRawRes = await window.apiFetch(`kesantrian/hafalan/tartil/${nisn}/`);
            const tartilRes = await tartilRawRes.json();
            const DEFAULT_JILID = ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6'];
            const tartilMap = {};
            if (tartilRes.success && tartilRes.data) {
                tartilRes.data.forEach(t => { tartilMap[t.jilid] = t; });
            }
            hafalanData.tartil = DEFAULT_JILID.map((j, i) => {
                const db = tartilMap[j];
                return db ? {
                    id: db.id, jilid: db.jilid,
                    nilai: parseFloat(db.nilai) || 0,
                    capaian_persen: parseFloat(db.capaian_persen) || 0,
                    status_lulus: db.status_lulus,
                    tanggal_lulus: db.tanggal_lulus
                } : {
                    id: `tmp_tartil_${i}`, jilid: j,
                    nilai: 0, capaian_persen: 0,
                    status_lulus: false, tanggal_lulus: null
                };
            });

            const tahfidzRawRes = await window.apiFetch(`kesantrian/hafalan/tahfidz/${nisn}/`);
            const tahfidzRes = await tahfidzRawRes.json();
            const DEFAULT_TAHFIDZ = [
                { kategori: 'Juz Hafal', total_juz_target: 30, detail: '' },
                { kategori: 'Juz Uji', total_juz_target: 30, detail: '' },
                { kategori: "Tasmi'", total_juz_target: 30, detail: '' },
                { kategori: 'Munaqosyah', total_juz_target: 30, detail: '' },
            ];
            const tahfidzMap = {};
            if (tahfidzRes.success && tahfidzRes.data) {
                tahfidzRes.data.forEach(t => { tahfidzMap[t.kategori] = t; });
            }
            hafalanData.tahfidz = DEFAULT_TAHFIDZ.map((def, i) => {
                const db = tahfidzMap[def.kategori];
                return db ? {
                    id: db.id, kategori: db.kategori,
                    nilai: parseFloat(db.nilai) || 0,
                    jumlah_juz: parseFloat(db.jumlah_juz) || 0,
                    total_juz_target: parseFloat(db.total_juz_target) || 30,
                    detail: db.detail || ''
                } : {
                    id: `tmp_tahfidz_${i}`, kategori: def.kategori,
                    nilai: 0, jumlah_juz: 0,
                    total_juz_target: def.total_juz_target,
                    detail: def.detail
                };
            });
        } catch (err) {
            console.warn('[hafalan] Gagal fetch data siswa:', err);
        }
    }

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
                    <button class="btn-save-item" data-save-type="tartil" data-save-id="${item.id}">Simpan</button>
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
                    <button class="btn-save-item" data-save-type="tahfidz" data-save-id="${item.id}">Simpan</button>
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
    if (typeof juz.halaman === 'number' && juz.halaman > 0) {
        tooltip += ` | Halaman: ${juz.halaman}`;
    }
    if (juz.tanggal) {
        tooltip += ` | ${formatDate(juz.tanggal)}`;
    }
    if (typeof juz.nilai === 'number' && juz.nilai > 0) {
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
                    <button class="btn btn-save-item" id="btn-save-catatan">Simpan Catatan</button>
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

    document.querySelectorAll('.btn-save-item[data-save-type]').forEach(btn => {
        btn.onclick = () => saveItemChanges(btn.dataset.saveId, btn.dataset.saveType);
    });

    const btnSaveCatatan = document.getElementById('btn-save-catatan');
    if (btnSaveCatatan) {
        btnSaveCatatan.onclick = saveCatatan;
    }

    const juzInput = document.getElementById('setoran-juz');
    if (juzInput) {
        juzInput.onchange = updateHalamanRange;
        juzInput.oninput = updateHalamanRange;
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

async function saveItemChanges(id, type) {
    const container = document.querySelector(`[data-id="${id}"][data-type="${type}"]`);
    if (!container) return;
    const lookupId = String(id);

    const nisn = hafalanData.student.nisn;
    if (!nisn) {
        showToast('NISN siswa tidak diketahui', 'error');
        return;
    }

    const nilaiInput = container.querySelector('.input-nilai');
    const nilai = nilaiInput ? parseFloat(nilaiInput.value) : 0;
    let payload = {};
    let endpoint = '';

    if (type === 'tartil') {
        const item = hafalanData.tartil.find(t => String(t.id) === lookupId);
        if (!item) return;
        const capaianInput = container.querySelector('.input-capaian');
        const lulusInput = container.querySelector('.input-lulus');
        payload = {
            jilid: item.jilid,
            nilai: nilai,
            capaian_persen: capaianInput ? parseFloat(capaianInput.value) : item.capaian_persen,
            status_lulus: lulusInput ? lulusInput.checked : item.status_lulus,
            tanggal_lulus: (lulusInput && lulusInput.checked && !item.tanggal_lulus)
                ? new Date().toISOString().split('T')[0] : item.tanggal_lulus
        };
        endpoint = `kesantrian/hafalan/tartil/${nisn}/`;
    } else if (type === 'tahfidz') {
        const item = hafalanData.tahfidz.find(t => String(t.id) === lookupId);
        if (!item) return;
        const juzInput = container.querySelector('.input-juz');
        payload = {
            kategori: item.kategori,
            nilai: nilai,
            jumlah_juz: juzInput ? parseFloat(juzInput.value) : item.jumlah_juz
        };
        endpoint = `kesantrian/hafalan/tahfidz/${nisn}/`;
    }

    try {
        const rawRes = await window.apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const res = await rawRes.json();
        if (res.success) {
            if (type === 'tartil') {
                const idx = hafalanData.tartil.findIndex(t => String(t.id) === lookupId);
                if (idx !== -1) {
                    Object.assign(hafalanData.tartil[idx], {
                        ...res.data,
                        nilai: parseFloat(res.data.nilai) || 0,
                        capaian_persen: parseFloat(res.data.capaian_persen) || 0,
                        id: res.data.id
                    });
                }
            } else {
                const idx = hafalanData.tahfidz.findIndex(t => String(t.id) === lookupId);
                if (idx !== -1) {
                    Object.assign(hafalanData.tahfidz[idx], {
                        ...res.data,
                        nilai: parseFloat(res.data.nilai) || 0,
                        jumlah_juz: parseFloat(res.data.jumlah_juz) || 0,
                        total_juz_target: parseFloat(res.data.total_juz_target) || 30,
                        id: res.data.id
                    });
                }
            }
            delete unsavedChanges[`${type}_${id}`];
            container.querySelectorAll('.changed').forEach(el => el.classList.remove('changed'));
            showToast(`Data ${type} berhasil disimpan!`);
            if (type === 'tartil') renderTartilPanelGuru();
            else renderTahfidzPanelGuru();
            renderStudentProfile();
            attachEventListeners();
        } else {
            showToast('Gagal menyimpan: ' + (res.message || 'Error'), 'error');
        }
    } catch (err) {
        showToast('Gagal menyimpan data', 'error');
        console.error(err);
    }
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

async function saveAllChanges() {
    if (Object.keys(unsavedChanges).length === 0) {
        showToast('Tidak ada perubahan untuk disimpan', 'info');
        return;
    }

    for (const key of Object.keys(unsavedChanges)) {
        const { id, type } = unsavedChanges[key];
        await saveItemChanges(id, type);
    }

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

    // Show tab navigation for roles that can input hafalan
    const canInputHafalan = ['superadmin', 'admin', 'guru', 'musyrif'].includes(currentRole);
    const tabNavigation = document.getElementById('tab-navigation');
    if (tabNavigation && canInputHafalan) {
        tabNavigation.style.display = 'flex';

        // Hide import tab for non-admin roles
        const importTab = tabNavigation.querySelector('[data-tab="import"]');
        if (importTab && !['superadmin', 'admin'].includes(currentRole)) {
            importTab.style.display = 'none';
        }

        // Re-initialize Lucide icons for tab buttons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
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
// SECTION 11: SETORAN HAFALAN (CRUD)
// ============================================

let setoranData = [];
let setoranPage = 1;
let setoranPageSize = 10;
let selectedFileHafalan = null;

/**
 * Switch between hafalan tabs (Overview, Setoran, Import)
 */
function switchHafalanTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) {
        activeTab.style.display = 'block';
        activeTab.classList.add('active');
    }

    // Load data for specific tabs
    if (tabName === 'setoran') {
        loadSetoranHafalan();
        loadSiswaDropdown();
        loadKelasDropdown();
    }

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

/**
 * Load setoran hafalan data from API
 */
async function loadSetoranHafalan() {
    const tbody = document.getElementById('setoran-tbody');
    const countBadge = document.getElementById('setoran-count');

    if (!tbody) return;

    // Show loading
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center">
                <div class="loading-spinner"></div>
                <p>Memuat data...</p>
            </td>
        </tr>
    `;

    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('page', setoranPage);
        params.append('page_size', setoranPageSize);

        const kelas = document.getElementById('filter-kelas-setoran')?.value;
        const tanggalDari = document.getElementById('filter-tanggal-dari')?.value;
        const tanggalSampai = document.getElementById('filter-tanggal-sampai')?.value;
        const search = document.getElementById('search-siswa')?.value;

        if (kelas) params.append('kelas', kelas);
        if (tanggalDari) params.append('tanggal_dari', tanggalDari);
        if (tanggalSampai) params.append('tanggal_sampai', tanggalSampai);
        if (search) params.append('search', search);

        const response = await window.apiFetch(`kesantrian/hafalan/records/?${params.toString()}`);
        console.log('[setoran] fetch params:', params.toString());
        console.log('[setoran] response:', response);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Gagal memuat data');
        }

        const list = data.results ?? data;
        setoranData = Array.isArray(list) ? list : [];
        const totalCount = data.count || setoranData.length;

        if (countBadge) {
            countBadge.textContent = `${totalCount} data`;
        }

        if (setoranData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <div class="empty-state">
                            <i data-lucide="inbox" style="width: 48px; height: 48px; margin-bottom: 12px;"></i>
                            <p>Belum ada data setoran hafalan</p>
                            <p class="text-sm">Klik "Tambah Setoran" untuk menambah data baru</p>
                        </div>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Render table rows
        const setoranList = Array.isArray(setoranData) ? setoranData : (setoranData.results ?? []);
        tbody.innerHTML = setoranList.map(item => `
            <tr data-id="${item.id}">
                <td>${formatDate(item.tanggal)}</td>
                <td>
                    <div class="student-info">
                        <span class="student-name">${item.siswa_nama || item.siswa}</span>
                        <span class="student-nisn text-muted">${item.siswa}</span>
                    </div>
                </td>
                <td>${item.siswa_kelas || '-'}</td>
                <td>${item.juz ? `Juz ${item.juz}` : '-'}</td>
                <td>${item.halaman_dari && item.halaman_sampai ? `${item.halaman_dari} - ${item.halaman_sampai}` : '-'}</td>
                <td><span class="badge badge-success">${item.jumlah_halaman} hal</span></td>
                <td class="text-truncate" title="${item.catatan || ''}">${item.catatan || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-icon btn-sm btn-outline" onclick="editSetoran(${item.id})" title="Edit">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="btn btn-icon btn-sm btn-danger" onclick="deleteSetoran(${item.id})" title="Hapus">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Render pagination
        renderSetoranPagination(totalCount);

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('[Hafalan] Error loading setoran:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger">
                    <p>Gagal memuat data: ${error.message}</p>
                    <button class="btn btn-primary btn-sm" onclick="loadSetoranHafalan()">Coba Lagi</button>
                </td>
            </tr>
        `;
    }
}

/**
 * Render pagination for setoran table
 */
function renderSetoranPagination(totalCount) {
    const container = document.getElementById('setoran-pagination');
    if (!container) return;

    const totalPages = Math.ceil(totalCount / setoranPageSize);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';

    // Previous button
    html += `<button class="btn btn-sm ${setoranPage === 1 ? 'disabled' : ''}"
             onclick="goToSetoranPage(${setoranPage - 1})" ${setoranPage === 1 ? 'disabled' : ''}>
             <i data-lucide="chevron-left"></i>
             </button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= setoranPage - 2 && i <= setoranPage + 2)) {
            html += `<button class="btn btn-sm ${i === setoranPage ? 'btn-primary' : ''}"
                     onclick="goToSetoranPage(${i})">${i}</button>`;
        } else if (i === setoranPage - 3 || i === setoranPage + 3) {
            html += '<span class="pagination-dots">...</span>';
        }
    }

    // Next button
    html += `<button class="btn btn-sm ${setoranPage === totalPages ? 'disabled' : ''}"
             onclick="goToSetoranPage(${setoranPage + 1})" ${setoranPage === totalPages ? 'disabled' : ''}>
             <i data-lucide="chevron-right"></i>
             </button>`;

    html += '</div>';
    container.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function goToSetoranPage(page) {
    setoranPage = page;
    loadSetoranHafalan();
}

function updateHalamanRange() {
    const juzInput = document.getElementById('setoran-juz');
    const halamanDariInput = document.getElementById('setoran-halaman-dari');
    const halamanSampaiInput = document.getElementById('setoran-halaman-sampai');
    if (!juzInput) return;

    const juz = parseInt(juzInput.value);
    const range = JUZ_HALAMAN_MAP[juz];
    if (!range) return;

    const [minHal, maxHal] = range;

    if (halamanDariInput) {
        halamanDariInput.min = minHal;
        halamanDariInput.max = maxHal;
        halamanDariInput.placeholder = `${minHal}–${maxHal}`;
        if (halamanDariInput.value) {
            const v = parseInt(halamanDariInput.value);
            if (v < minHal) halamanDariInput.value = minHal;
            if (v > maxHal) halamanDariInput.value = maxHal;
        }
    }

    if (halamanSampaiInput) {
        halamanSampaiInput.min = minHal;
        halamanSampaiInput.max = maxHal;
        halamanSampaiInput.placeholder = `${minHal}–${maxHal}`;
        if (halamanSampaiInput.value) {
            const v = parseInt(halamanSampaiInput.value);
            if (v < minHal) halamanSampaiInput.value = minHal;
            if (v > maxHal) halamanSampaiInput.value = maxHal;
        }
    }
}

/**
 * Load siswa dropdown for setoran modal
 */
async function loadSiswaDropdown() {
    const select = document.getElementById('setoran-siswa');
    if (!select) return;

    try {
        const response = await window.apiFetch('students/');
        const data = await response.json();

        const students = data.results || data;

        select.innerHTML = '<option value="">Pilih Siswa...</option>';
        students.forEach(s => {
            select.innerHTML += `<option value="${s.nisn}">${s.nama} (${s.nisn}) - ${s.kelas}</option>`;
        });

    } catch (error) {
        console.error('[Hafalan] Error loading siswa:', error);
    }
}

/**
 * Load kelas dropdown for filter
 */
async function loadKelasDropdown() {
    const select = document.getElementById('filter-kelas-setoran');
    if (!select || select.options.length > 1) return; // Already loaded

    try {
        const response = await window.apiFetch('students/classes/');
        const data = await response.json();

        const kelasList = data.classes || data;

        if (Array.isArray(kelasList)) {
            kelasList.forEach(k => {
                select.innerHTML += `<option value="${k}">${k}</option>`;
            });
        }

    } catch (error) {
        console.error('[Hafalan] Error loading kelas:', error);
    }
}

/**
 * Open modal for new setoran
 */
function openModalSetoranBaru() {
    const modal = document.getElementById('modal-setoran');
    const title = document.getElementById('modal-setoran-title');
    const form = document.getElementById('form-setoran');

    if (!modal) return;

    // Reset form
    if (form) form.reset();
    document.getElementById('setoran-id').value = '';

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('setoran-tanggal').value = today;

    // Update title
    if (title) title.textContent = 'Tambah Setoran Hafalan';

    // Show modal
    modal.style.display = 'flex';
    updateHalamanRange();

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Edit setoran
 */
function editSetoran(id) {
    const item = setoranData.find(s => s.id === id);
    if (!item) return;

    const modal = document.getElementById('modal-setoran');
    const title = document.getElementById('modal-setoran-title');

    if (!modal) return;

    // Fill form
    document.getElementById('setoran-id').value = item.id;
    document.getElementById('setoran-siswa').value = item.siswa;
    document.getElementById('setoran-tanggal').value = item.tanggal;
    document.getElementById('setoran-juz').value = item.juz || '';
    document.getElementById('setoran-jumlah').value = item.jumlah_halaman;
    document.getElementById('setoran-halaman-dari').value = item.halaman_dari || '';
    document.getElementById('setoran-halaman-sampai').value = item.halaman_sampai || '';
    document.getElementById('setoran-catatan').value = item.catatan || '';

    // Update title
    if (title) title.textContent = 'Edit Setoran Hafalan';

    // Show modal
    modal.style.display = 'flex';
    updateHalamanRange();
}

/**
 * Close setoran modal
 */
function closeModalSetoran() {
    const modal = document.getElementById('modal-setoran');
    if (modal) modal.style.display = 'none';
}

/**
 * Submit setoran (create/update)
 */
async function submitSetoranHafalan() {
    const id = document.getElementById('setoran-id').value;
    const siswa = document.getElementById('setoran-siswa').value;
    const tanggal = document.getElementById('setoran-tanggal').value;
    const juz = document.getElementById('setoran-juz').value;
    const jumlah = document.getElementById('setoran-jumlah').value;
    const halamanDari = document.getElementById('setoran-halaman-dari').value;
    const halamanSampai = document.getElementById('setoran-halaman-sampai').value;
    const catatan = document.getElementById('setoran-catatan').value;

    // Validation
    if (!siswa || !tanggal || !jumlah) {
        showToast('Siswa, tanggal, dan jumlah halaman wajib diisi', 'error');
        return;
    }

    const juzInt = parseInt(document.getElementById('setoran-juz')?.value);
    const hDari = parseInt(document.getElementById('setoran-halaman-dari')?.value);
    const hSampai = parseInt(document.getElementById('setoran-halaman-sampai')?.value);
    const range = JUZ_HALAMAN_MAP[juzInt];
    if (range && hDari && (hDari < range[0] || hDari > range[1])) {
        showToast(`Halaman ${hDari} tidak valid untuk Juz ${juzInt} (${range[0]}–${range[1]})`, 'error');
        return;
    }
    if (range && hSampai && (hSampai < range[0] || hSampai > range[1])) {
        showToast(`Halaman ${hSampai} tidak valid untuk Juz ${juzInt} (${range[0]}–${range[1]})`, 'error');
        return;
    }

    const payload = {
        siswa_nisn: siswa,
        tanggal: tanggal,
        jumlah_halaman: parseInt(jumlah),
        juz: juz ? parseInt(juz) : null,
        halaman_dari: halamanDari ? parseInt(halamanDari) : null,
        halaman_sampai: halamanSampai ? parseInt(halamanSampai) : null,
        catatan: catatan
    };

    try {
        let response;
        if (id) {
            // Update
            response = await window.apiFetch(`kesantrian/hafalan/records/${id}/`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            response = await window.apiFetch('kesantrian/hafalan/records/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.detail || 'Gagal menyimpan data');
        }

        showToast(id ? 'Setoran berhasil diupdate' : 'Setoran berhasil ditambahkan', 'success');
        closeModalSetoran();
        loadSetoranHafalan();

    } catch (error) {
        console.error('[Hafalan] Error saving setoran:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Delete setoran
 */
async function deleteSetoran(id) {
    if (!confirm('Yakin ingin menghapus data setoran ini?')) return;

    try {
        const response = await window.apiFetch(`kesantrian/hafalan/records/${id}/`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Gagal menghapus data');
        }

        showToast('Setoran berhasil dihapus', 'success');
        loadSetoranHafalan();

    } catch (error) {
        console.error('[Hafalan] Error deleting setoran:', error);
        showToast(error.message, 'error');
    }
}

// ============================================
// SECTION 12: IMPORT EXCEL
// ============================================

/**
 * Handle drag over for dropzone
 */
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

/**
 * Handle drag leave for dropzone
 */
function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

/**
 * Handle file drop for hafalan import
 */
function handleDropHafalan(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleFileHafalan(files[0]);
    }
}

/**
 * Handle file select for hafalan import
 */
function handleFileSelectHafalan(event) {
    const files = event.target.files;
    if (files.length > 0) {
        handleFileHafalan(files[0]);
    }
}

/**
 * Process selected file
 */
function handleFileHafalan(file) {
    // Validate file type
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        showToast('File harus berformat Excel (.xlsx atau .xls)', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB', 'error');
        return;
    }

    selectedFileHafalan = file;

    // Show file preview
    const dropzone = document.getElementById('dropzone-hafalan');
    const preview = document.getElementById('file-preview-hafalan');
    const fileName = document.getElementById('file-name-hafalan');
    const fileSize = document.getElementById('file-size-hafalan');

    if (dropzone) dropzone.style.display = 'none';
    if (preview) preview.style.display = 'flex';
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Clear selected file
 */
function clearFileHafalan() {
    selectedFileHafalan = null;

    const dropzone = document.getElementById('dropzone-hafalan');
    const preview = document.getElementById('file-preview-hafalan');
    const fileInput = document.getElementById('file-import-hafalan');

    if (dropzone) dropzone.style.display = 'flex';
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';
}

/**
 * Import hafalan from Excel
 */
async function importHafalanExcel() {
    if (!selectedFileHafalan) {
        showToast('Pilih file Excel terlebih dahulu', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFileHafalan);

    // Show loading
    const preview = document.getElementById('file-preview-hafalan');
    const submitBtn = preview?.querySelector('.btn-success');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader"></i> Mengimport...';
    }

    try {
        const response = await window.apiFetch('kesantrian/hafalan/import/', {
            method: 'POST',
            body: formData
            // Note: Don't set Content-Type header - browser will set it with boundary for FormData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Import gagal');
        }

        // Show result
        showImportResult(data);

    } catch (error) {
        console.error('[Hafalan] Import error:', error);
        showToast(error.message, 'error');

        // Reset button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="upload"></i> Import Data';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

/**
 * Show import result
 */
function showImportResult(data) {
    const preview = document.getElementById('file-preview-hafalan');
    const result = document.getElementById('import-result-hafalan');
    const dropzone = document.getElementById('dropzone-hafalan');

    if (preview) preview.style.display = 'none';
    if (dropzone) dropzone.style.display = 'none';
    if (result) result.style.display = 'block';

    // Update stats
    document.getElementById('import-total').textContent = data.total || 0;
    document.getElementById('import-success').textContent = data.success || 0;
    document.getElementById('import-failed').textContent = data.failed || 0;

    // Show errors if any
    const errorsContainer = document.getElementById('import-errors');
    const errorList = document.getElementById('import-error-list');

    if (data.errors && data.errors.length > 0) {
        errorsContainer.style.display = 'block';
        errorList.innerHTML = data.errors.map(e => `<li>${e}</li>`).join('');
    } else {
        errorsContainer.style.display = 'none';
    }

    // Update result icon based on success/failure
    const resultIcon = result?.querySelector('.result-icon');
    if (resultIcon) {
        if (data.failed > 0) {
            resultIcon.classList.remove('success');
            resultIcon.classList.add('warning');
            resultIcon.setAttribute('data-lucide', 'alert-triangle');
        } else {
            resultIcon.classList.remove('warning');
            resultIcon.classList.add('success');
            resultIcon.setAttribute('data-lucide', 'check-circle');
        }
    }

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    showToast(`Import selesai: ${data.success} berhasil, ${data.failed} gagal`, data.failed > 0 ? 'warning' : 'success');
}

/**
 * Reset import section
 */
function resetImportHafalan() {
    selectedFileHafalan = null;

    const dropzone = document.getElementById('dropzone-hafalan');
    const preview = document.getElementById('file-preview-hafalan');
    const result = document.getElementById('import-result-hafalan');
    const fileInput = document.getElementById('file-import-hafalan');

    if (dropzone) dropzone.style.display = 'flex';
    if (preview) preview.style.display = 'none';
    if (result) result.style.display = 'none';
    if (fileInput) fileInput.value = '';

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// SECTION 13: WINDOW EXPORTS
// ============================================

window.saveItemChanges = saveItemChanges;
window.saveCatatan = saveCatatan;
window.saveAllChanges = saveAllChanges;
window.exportHafalanData = exportHafalanData;
window.switchRole = switchRole;

// Setoran exports
window.switchHafalanTab = switchHafalanTab;
window.loadSetoranHafalan = loadSetoranHafalan;
window.openModalSetoranBaru = openModalSetoranBaru;
window.editSetoran = editSetoran;
window.closeModalSetoran = closeModalSetoran;
window.submitSetoranHafalan = submitSetoranHafalan;
window.deleteSetoran = deleteSetoran;
window.goToSetoranPage = goToSetoranPage;

// Import exports
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDropHafalan = handleDropHafalan;
window.handleFileSelectHafalan = handleFileSelectHafalan;
window.clearFileHafalan = clearFileHafalan;
window.importHafalanExcel = importHafalanExcel;
window.resetImportHafalan = resetImportHafalan;

// ============================================
// SECTION 14: DOM READY
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Hafalan] Admin page detected, skipping init');
        return;
    }
    initHafalan();
});
