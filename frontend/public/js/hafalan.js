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

let hafalanChildrenData = [];

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
                const data = res.data;
                const juzSummary = data.juz_summary || [];
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
                if (data.siswa) {
                    hafalanData.student.nama = hafalanData.student.nama || data.siswa.nama;
                    hafalanData.student.kelas = hafalanData.student.kelas || data.siswa.kelas;
                }
                if (data.catatan_guru !== undefined) {
                    hafalanData.catatan = data.catatan_guru;
                }
                const textarea = document.getElementById('catatan-guru');
                if (textarea) textarea.value = hafalanData.catatan;
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

            await fetchKehadiranKajian(nisn);
        } catch (err) {
            console.warn('[hafalan] Gagal fetch data siswa:', err);
        }
    }

    if (nisn) {
        try {
            const resK = await window.apiFetch(`kesantrian/kompetensi/${nisn}/`);
            const dK = typeof resK?.json === 'function' ? await resK.json() : resK;
            if (dK.success) {
                hafalanData.kompetensi = {
                    guru_tartil: dK.data.guru_tartil_nama,
                    guru_tahfidz: dK.data.guru_tahfidz_nama,
                    guru_tartil_id: dK.data.guru_tartil_id,
                    guru_tahfidz_id: dK.data.guru_tahfidz_id,
                    status_khidmat: dK.data.status_khidmat === 'aktif' ? 'Aktif' :
                                    dK.data.status_khidmat === 'tidak_aktif' ? 'Tidak Aktif' :
                                    'Mutakhirij',
                    keterangan_khidmat: dK.data.keterangan_khidmat,
                };
            }
        } catch (e) { /* silent */ }
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

async function initStudentSelector() {
    const bar = document.getElementById('student-selector-bar');
    if (!bar) return;
    if (!['guru', 'musyrif', 'admin', 'superadmin'].includes(currentRole)) return;
    bar.style.display = 'block';

    let allStudents = [];

    // Render UI custom dropdown
    bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;position:relative;">
            <label style="font-size:13px;font-weight:500;white-space:nowrap;color:#374151;">
                Pilih Santri:
            </label>
            <div id="student-selector-wrapper" style="position:relative;flex:1;max-width:420px;">
                <div id="student-selector-display"
                     style="display:flex;align-items:center;justify-content:space-between;
                            padding:8px 12px;border:1px solid #d1e9df;border-radius:8px;
                            background:#fff;cursor:pointer;font-size:13px;
                            color:#111827;user-select:none;">
                    <span id="student-selector-label" style="flex:1;overflow:hidden;
                          text-overflow:ellipsis;white-space:nowrap;">-- Pilih santri --</span>
                    <span style="margin-left:8px;color:#6b7280;font-size:11px;">▼</span>
                </div>
                <div id="student-selector-dropdown"
                     style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;
                            background:#fff;border:1px solid #d1e9df;border-radius:10px;
                            box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:999;
                            max-height:360px;overflow:hidden;flex-direction:column;">
                    <div style="padding:8px;">
                        <input id="student-selector-search" type="text"
                               placeholder="Cari nama atau NISN..."
                               style="width:100%;padding:7px 10px;border:1px solid #e5e7eb;
                                      border-radius:6px;font-size:13px;outline:none;
                                      box-sizing:border-box;">
                    </div>
                    <div id="student-selector-list"
                         style="overflow-y:auto;max-height:290px;padding:0 4px 6px;"></div>
                </div>
            </div>
        </div>`;

    try {
        const rawRes = await window.apiFetch('students/?limit=1000');
        const res = typeof rawRes?.json === 'function' ? await rawRes.json() : rawRes;
        allStudents = res.data || res.results || [];
    } catch (e) {
        console.warn('[hafalan] gagal load students:', e);
        return;
    }

    function groupByKelas(students) {
        const map = {};
        students.forEach(s => {
            const k = s.kelas || 'Lainnya';
            if (!map[k]) map[k] = [];
            map[k].push(s);
        });
        return map;
    }

    function renderList(students) {
        const list = document.getElementById('student-selector-list');
        if (!list) return;
        if (students.length === 0) {
            list.innerHTML = `<p style="text-align:center;color:#9ca3af;font-size:12px;
                                        padding:16px;">Santri tidak ditemukan</p>`;
            return;
        }
        const grouped = groupByKelas(students);
        const kelasSorted = Object.keys(grouped).sort();
        let html = '';
        kelasSorted.forEach(kelas => {
            html += `<div style="padding:6px 8px 2px;font-size:10px;font-weight:600;
                                  color:#1d9e75;text-transform:uppercase;
                                  letter-spacing:0.05em;">${kelas}</div>`;
            grouped[kelas].forEach(s => {
                const isActive = s.nisn === hafalanData.student.nisn;
                html += `<div class="student-option" data-nisn="${s.nisn}"
                              data-nama="${s.nama}" data-kelas="${s.kelas || ''}"
                              style="padding:7px 10px;border-radius:6px;cursor:pointer;
                                     font-size:13px;display:flex;justify-content:space-between;
                                     align-items:center;background:${isActive ? '#f0faf5' : 'transparent'};
                                     color:${isActive ? '#1d9e75' : '#111827'};">
                             <span>${s.nama}</span>
                             <span style="font-size:11px;color:#9ca3af;">${s.nisn}</span>
                         </div>`;
            });
        });
        list.innerHTML = html;

        list.querySelectorAll('.student-option').forEach(el => {
            el.onmouseenter = () => { if (el.dataset.nisn !== hafalanData.student.nisn) el.style.background = '#f9fafb'; };
            el.onmouseleave = () => { if (el.dataset.nisn !== hafalanData.student.nisn) el.style.background = 'transparent'; };
            el.onclick = async () => {
                const nisn = el.dataset.nisn;
                const nama = el.dataset.nama;
                const kelas = el.dataset.kelas;
                const labelEl = document.getElementById('student-selector-label');
                if (labelEl) labelEl.textContent = `${nama} — ${kelas}`;
                const dd = document.getElementById('student-selector-dropdown');
                if (dd) dd.style.display = 'none';
                hafalanData.student.nisn = nisn;
                hafalanData.student.nama = nama;
                hafalanData.student.kelas = kelas;
                await renderHafalanGuru();
                const labelEl2 = document.getElementById('student-selector-label');
                if (labelEl2) labelEl2.textContent = `${nama} — ${kelas}`;
            };
        });
    }

    if (hafalanData.student.nisn && hafalanData.student.nama) {
        const labelEl = document.getElementById('student-selector-label');
        if (labelEl) labelEl.textContent =
            `${hafalanData.student.nama} — ${hafalanData.student.kelas}`;
    }

    renderList(allStudents);

    const display = document.getElementById('student-selector-display');
    const dropdown = document.getElementById('student-selector-dropdown');
    if (display && dropdown) {
        display.onclick = () => {
            const isOpen = dropdown.style.display === 'flex';
            dropdown.style.display = isOpen ? 'none' : 'flex';
            if (!isOpen) {
                const search = document.getElementById('student-selector-search');
                if (search) {
                    search.value = '';
                    search.focus();
                }
                renderList(allStudents);
            }
        };
    }

    const searchInput = document.getElementById('student-selector-search');
    if (searchInput) {
        searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase();
            const filtered = allStudents.filter(s =>
                s.nama.toLowerCase().includes(q) || s.nisn.includes(q)
            );
            renderList(filtered);
        };
    }

    document.addEventListener('click', function closeSelector(e) {
        const wrapper = document.getElementById('student-selector-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            const dd = document.getElementById('student-selector-dropdown');
            if (dd) dd.style.display = 'none';
        }
    });
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

    const kompetensiSection = document.getElementById('kompetensi-section');
    if (kompetensiSection) {
        const existingBtn = kompetensiSection.querySelector('.btn-edit-kompetensi');
        if (!existingBtn && ['superadmin', 'admin', 'pimpinan'].includes(currentRole)) {
            let cardHead = kompetensiSection.querySelector('.card-head');
            if (!cardHead) {
                const title = kompetensiSection.querySelector('.section-title');
                if (title) {
                    cardHead = document.createElement('div');
                    cardHead.className = 'card-head';
                    cardHead.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';
                    kompetensiSection.insertBefore(cardHead, title);
                    cardHead.appendChild(title);
                }
            }
            if (cardHead) {
                const btn = document.createElement('button');
                btn.className = 'btn-edit-kompetensi';
                btn.textContent = 'Edit';
                btn.style.cssText = 'font-size:12px;padding:4px 12px;' +
                    'border:1px solid #d1e9df;border-radius:6px;' +
                    'background:#fff;cursor:pointer;color:#1d9e75;';
                btn.onclick = openKompetensiEdit;
                cardHead.appendChild(btn);
            }
        } else if (existingBtn && !['superadmin', 'admin', 'pimpinan'].includes(currentRole)) {
            existingBtn.remove();
        }
    }
}

async function openKompetensiEdit() {
    const nisn = hafalanData.student.nisn;
    if (!nisn) return;
    if (!['superadmin', 'admin', 'pimpinan'].includes(currentRole)) return;

    const existing = hafalanData.kompetensi;

    let users = [];
    try {
        const r1 = await window.apiFetch('auth/users/?role=guru');
        const d1 = typeof r1?.json === 'function' ? await r1.json() : r1;
        const r2 = await window.apiFetch('auth/users/?role=musyrif');
        const d2 = typeof r2?.json === 'function' ? await r2.json() : r2;
        users = [...(d1.data || []), ...(d2.data || [])];
        users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (e) {}

    const userOpts = '<option value="">– Tidak ada –</option>' +
        users.map(u => `<option value="${u.id}" ${u.id == existing.guru_tartil_id ? 'selected' : ''}>${u.name}</option>`).join('');
    const userOpts2 = '<option value="">– Tidak ada –</option>' +
        users.map(u => `<option value="${u.id}" ${u.id == existing.guru_tahfidz_id ? 'selected' : ''}>${u.name}</option>`).join('');

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:flex;justify-content:center;align-items:center;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 20px;font-size:15px;font-weight:600;color:#111827;">
                Edit Kompetensi & Pengajar
            </h3>
            <div style="margin-bottom:13px;">
                <label style="font-size:12px;font-weight:500;color:#374151;display:block;margin-bottom:5px;">Guru Tartil</label>
                <select id="ke-guru-tartil" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;outline:none;background:#fff;">${userOpts}</select>
            </div>
            <div style="margin-bottom:13px;">
                <label style="font-size:12px;font-weight:500;color:#374151;display:block;margin-bottom:5px;">Guru Tahfidz</label>
                <select id="ke-guru-tahfidz" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;outline:none;background:#fff;">${userOpts2}</select>
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-size:12px;font-weight:500;color:#374151;display:block;margin-bottom:5px;">Status Khidmat</label>
                <select id="ke-status-khidmat" style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;outline:none;background:#fff;">
                    <option value="aktif" ${existing.status_khidmat==='Aktif'?'selected':''}>Aktif</option>
                    <option value="tidak_aktif" ${existing.status_khidmat==='Tidak Aktif'?'selected':''}>Tidak Aktif</option>
                    <option value="mutakhirij" ${existing.status_khidmat==='Mutakhirij'?'selected':''}>Mutakhirij</option>
                </select>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="ke-cancel" style="padding:8px 18px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;">Batal</button>
                <button id="ke-save" style="padding:8px 18px;background:#1d9e75;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">Simpan</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('ke-cancel').onclick = () => modal.remove();
    document.getElementById('ke-save').onclick = async () => {
        try {
            await window.apiFetch(`kesantrian/kompetensi/${nisn}/update/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guru_tartil_id: document.getElementById('ke-guru-tartil').value || null,
                    guru_tahfidz_id: document.getElementById('ke-guru-tahfidz').value || null,
                    status_khidmat: document.getElementById('ke-status-khidmat').value,
                })
            });
            modal.remove();
            await renderHafalanGuru();
        } catch (e) {
            alert('Gagal menyimpan.');
        }
    };
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

async function renderHafalanWalisantri() {
    // Hide admin elements
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.getElementById('page-title').textContent = 'Hafalan Ananda';

    const nisn = hafalanData.student?.nisn;

    if (nisn) {
        try {
            const rawRes = await window.apiFetch(`kesantrian/hafalan/siswa/${nisn}/`);
            const res = typeof rawRes?.json === 'function' ? await rawRes.json() : rawRes;
            if (res?.data) {
                const data = res.data;
                const juzSummary = data.juz_summary || [];
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

                if (data.siswa) {
                    hafalanData.student.nama = hafalanData.student.nama || data.siswa.nama;
                    hafalanData.student.kelas = hafalanData.student.kelas || data.siswa.kelas;
                }
                if (data.catatan_guru !== undefined) {
                    hafalanData.catatan = data.catatan_guru;
                }
            }

            const tartilRaw = await window.apiFetch(`kesantrian/hafalan/tartil/${nisn}/`);
            const tartilRes = typeof tartilRaw?.json === 'function' ? await tartilRaw.json() : tartilRaw;
            const DEFAULT_JILID = ['Jilid 1', 'Jilid 2', 'Jilid 3', 'Jilid 4', 'Jilid 5', 'Jilid 6'];
            const tartilMap = {};
            if (tartilRes?.data) {
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

            const tahfidzRaw = await window.apiFetch(`kesantrian/hafalan/tahfidz/${nisn}/`);
            const tahfidzRes = typeof tahfidzRaw?.json === 'function' ? await tahfidzRaw.json() : tahfidzRaw;
            const DEFAULT_TAHFIDZ = [
                { kategori: 'Juz Hafal', total_juz_target: 30, detail: '' },
                { kategori: 'Juz Uji', total_juz_target: 30, detail: '' },
                { kategori: "Tasmi'", total_juz_target: 30, detail: '' },
                { kategori: 'Munaqosyah', total_juz_target: 30, detail: '' },
            ];
            const tahfidzMap = {};
            if (tahfidzRes?.data) {
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

            const resK = await window.apiFetch(`kesantrian/kompetensi/${nisn}/`);
            const dK = typeof resK?.json === 'function' ? await resK.json() : resK;
            if (dK?.data) {
                hafalanData.kompetensi = {
                    guru_tartil: dK.data.guru_tartil_nama || dK.data.guru_tartil || '-',
                    guru_tahfidz: dK.data.guru_tahfidz_nama || dK.data.guru_tahfidz || '-',
                    guru_tartil_id: dK.data.guru_tartil_id,
                    guru_tahfidz_id: dK.data.guru_tahfidz_id,
                    status_khidmat: dK.data.status_khidmat === 'aktif' ? 'Aktif' :
                                    dK.data.status_khidmat === 'tidak_aktif' ? 'Tidak Aktif' :
                                    dK.data.status_khidmat === 'mutakhirij' ? 'Mutakhirij' :
                                    (dK.data.status_khidmat || '-'),
                    keterangan_khidmat: dK.data.keterangan_khidmat || '-'
                };
            }
        } catch (e) {
            console.error('[hafalan] gagal fetch data walisantri:', e);
        }
    }

    renderPrediction();
    renderJuzProgressGrid();
    renderStudentProfile();
    renderTartilPanelWalisantri();
    renderTahfidzPanelWalisantri();
    renderKompetensiSection();
    renderKehadiranSection();
    renderCatatanSectionWalisantri();
    if (nisn) fetchKehadiranKajian(nisn);
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
        filterBulan.onchange = () => {
            const nisn = hafalanData.student.nisn;
            if (nisn) fetchKehadiranKajian(nisn, filterBulan.value);
        };
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

async function saveCatatan() {
    const textarea = document.getElementById('catatan-guru');
    if (!textarea) return;
    const nisn = hafalanData.student.nisn;
    if (!nisn) { showToast('Pilih santri terlebih dahulu.'); return; }
    try {
        await window.apiFetch(`students/${nisn}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ catatan: textarea.value })
        });
        hafalanData.catatan = textarea.value;
        showToast('Catatan berhasil disimpan!');
    } catch (e) {
        showToast('Gagal menyimpan catatan.');
    }
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

async function loadHafalanChildrenData() {
    try {
        const res = await window.apiFetch('kesantrian/my-children-summary/');
        const data = typeof res?.json === 'function' ? await res.json() : res;
        if (data?.success && data?.children) {
            hafalanChildrenData = data.children;
            renderHafalanChildSelector();
        }
    } catch (e) {
        console.error('[hafalan] gagal load children:', e);
    }
}

function renderHafalanChildSelector() {
    const container = document.getElementById('hafalan-child-selector');
    if (!container) return;

    if (!hafalanChildrenData.length || hafalanChildrenData.length === 1) {
        container.style.display = 'none';
        return;
    }

    const savedNisn = localStorage.getItem('selected_child_nisn');
    container.style.display = 'flex';
    container.innerHTML = hafalanChildrenData.map((child, idx) => {
        const isActive = savedNisn ? child.nisn === savedNisn : idx === 0;
        const initials = (child.nama || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0])
            .join('')
            .toUpperCase() || 'SN';

        return `
            <div class="child-tab ${isActive ? 'active' : ''}"
                 data-nisn="${child.nisn}"
                 id="hafalan-child-tab-${child.nisn}">
                <div class="child-avatar">${initials}</div>
                <div class="child-info">
                    <h4>${child.nama}</h4>
                    <span>Kelas ${child.kelas || '-'} | NISN: ${child.nisn}</span>
                </div>
            </div>`;
    }).join('');

    container.querySelectorAll('.child-tab').forEach(tab => {
        tab.onclick = function() {
            selectHafalanChild(this.dataset.nisn);
        };
    });
}

async function selectHafalanChild(nisn) {
    const child = hafalanChildrenData.find(c => c.nisn === nisn);
    if (!child) return;

    localStorage.setItem('selected_child_nisn', nisn);
    localStorage.setItem('selected_child_data', JSON.stringify({
        nisn: child.nisn,
        nama: child.nama,
        kelas: child.kelas || ''
    }));

    document.querySelectorAll('#hafalan-child-selector .child-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.nisn === nisn);
    });

    destroyAllChartsCompletely();
    hafalanData.student.nisn = child.nisn;
    hafalanData.student.nama = child.nama;
    hafalanData.student.kelas = child.kelas || '';

    window.dispatchEvent(new CustomEvent('childSwitched', {
        detail: { nisn, child }
    }));

    await renderHafalanWalisantri();
}

async function initHafalan() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    currentRole = user.role || window.getUserRole?.() || localStorage.getItem('user_role') || 'guru';

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
    if (tabNavigation && (canInputHafalan || ['superadmin', 'admin', 'pimpinan'].includes(currentRole))) {
        tabNavigation.style.display = 'flex';

        // Hide import tab for non-admin roles
        const importTab = tabNavigation.querySelector('[data-tab="import"]');
        if (importTab && !['superadmin', 'admin'].includes(currentRole)) {
            importTab.style.display = 'none';
        }

        // Tampilkan tab Kelompok hanya untuk admin/pimpinan/superadmin
        const kelompokTabBtn = document.getElementById('tab-btn-kelompok');
        if (kelompokTabBtn && ['superadmin', 'admin', 'pimpinan'].includes(currentRole)) {
            kelompokTabBtn.style.display = '';
        }

        const kelompokHafalanTabBtn = document.getElementById('tab-btn-kelompok-hafalan');
        if (kelompokHafalanTabBtn && ['superadmin', 'admin', 'pimpinan'].includes(currentRole)) {
            kelompokHafalanTabBtn.style.display = '';
            kelompokHafalanTabBtn.onclick = () => switchHafalanTab('kelompok-hafalan');
        }

        // Tampilkan tab Kajian Mingguan untuk guru dan musyrif
        const kajianTabBtn = document.getElementById('tab-btn-kajian');
        if (kajianTabBtn && ['guru', 'musyrif'].includes(currentRole)) {
            kajianTabBtn.style.display = '';
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
        await loadHafalanChildrenData();

        if (hafalanChildrenData.length > 0) {
            const childExists = selectedChildNisn &&
                hafalanChildrenData.some(c => c.nisn === selectedChildNisn);
            const initialNisn = childExists ? selectedChildNisn : hafalanChildrenData[0].nisn;
            const initialChild = hafalanChildrenData.find(c => c.nisn === initialNisn);

            if (initialChild) {
                hafalanData.student.nisn = initialChild.nisn;
                hafalanData.student.nama = initialChild.nama;
                hafalanData.student.kelas = initialChild.kelas || '';

                localStorage.setItem('selected_child_nisn', initialChild.nisn);
                localStorage.setItem('selected_child_data', JSON.stringify({
                    nisn: initialChild.nisn,
                    nama: initialChild.nama,
                    kelas: initialChild.kelas || ''
                }));
                renderHafalanChildSelector();
            }
        }

        await renderHafalanWalisantri();
    } else {
        // Default: guru, superadmin - editable view
        initStudentSelector();
        renderHafalanGuru();
    }

    // Listen for child switch events from other pages
    window.addEventListener('childSwitched', function(e) {
        if (e.detail && e.detail.child) {
            const child = e.detail.child;

            if (currentRole === 'walisantri') {
                const targetNisn = e.detail.nisn || child.nisn;
                if (targetNisn && targetNisn !== hafalanData.student.nisn) {
                    selectHafalanChild(targetNisn);
                }
                return;
            }

            // IMPORTANT: Destroy all charts BEFORE updating data
            // This prevents "Chart Ghosting" where old child's data shadows new child
            destroyAllChartsCompletely();

            // Update student data
            hafalanData.student.nama = child.nama || hafalanData.student.nama;
            hafalanData.student.nisn = child.nisn || hafalanData.student.nisn;
            hafalanData.student.kelas = child.kelas || hafalanData.student.kelas;

        }
    });

    window.addEventListener('beforeunload', function(e) {
        if (isEditing && Object.keys(unsavedChanges).length > 0) {
            e.preventDefault();
            e.returnValue = 'Ada perubahan yang belum disimpan.';
            return e.returnValue;
        }
    });

    const btnBuatKelompok = document.getElementById('btn-buat-kelompok');
    if (btnBuatKelompok) {
        btnBuatKelompok.onclick = () => bukaModalKelompok(null);
    }
    const btnCancel = document.getElementById('btn-modal-kelompok-cancel');
    if (btnCancel) {
        btnCancel.onclick = () => {
            document.getElementById('modal-kelompok').style.display = 'none';
        };
    }
    const btnBuatKelompokHafalan = document.getElementById('btn-buat-kelompok-hafalan');
    if (btnBuatKelompokHafalan) {
        btnBuatKelompokHafalan.onclick = () => bukaModalKelompokHafalan(null);
    }
    const btnGenerateKelompokHafalan = document.getElementById('btn-generate-kelompok-hafalan');
    if (btnGenerateKelompokHafalan) {
        btnGenerateKelompokHafalan.onclick = bukaModalGenerateKelompokHafalan;
    }
    const filterKelasHafalan = document.getElementById('kh-filter-kelas');
    if (filterKelasHafalan) {
        filterKelasHafalan.onchange = () => loadKelompokHafalanTab();
    }
}

// ============================================
// SECTION 11: SETORAN HAFALAN (CRUD)
// ============================================

let setoranData = [];
let setoranPage = 1;
let setoranPageSize = 10;
let selectedFileHafalan = null;
let kajianState = {
    kelompok: null,
    pertemuanList: [],
    anggotaList: [],
};
let kelompokState = {
    list: [],
    guruList: [],
    allStudents: [],
    expandedId: null,
    expandedPertemuanId: null,
    pertemuanByKelompok: {},
    presensiByPertemuan: {},
    pertemuanModalKelompokId: null,
    editingId: null,
};
const kelompokHafalanState = {
    list: [],
    guruList: [],
    allStudents: [],
    kelasList: [],
    expandedId: null,
    editingId: null
};

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

    if (tabName === 'kelompok') {
        loadKelompokTab();
    }

    if (tabName === 'kelompok-hafalan') {
        loadKelompokHafalanTab();
    }

    if (tabName === 'kajian') {
        loadKajianTab();
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
            <td colspan="9" class="text-center">
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

        const list = data.results ?? data.data ?? data;
        setoranData = Array.isArray(list) ? list : [];
        const totalCount = data.count || setoranData.length;

        if (countBadge) {
            countBadge.textContent = `${totalCount} data`;
        }

        if (setoranData.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted">
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
                <td>${renderSetoranStatusBadge(item.status)}</td>
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

function renderSetoranStatusBadge(status) {
    const labelMap = {
        lancar: 'Lancar',
        perlu_ulang: 'Perlu Ulang',
        belum_selesai: 'Belum Selesai'
    };
    const styleMap = {
        lancar: 'background:#d1fae5;color:#065f46;',
        perlu_ulang: 'background:#fef3c7;color:#92400e;',
        belum_selesai: 'background:#fee2e2;color:#991b1b;'
    };
    const normalized = status || 'lancar';
    return `<span style="border-radius:12px;padding:2px 10px;font-size:11px;font-weight:600;${styleMap[normalized] || styleMap.lancar}">
        ${labelMap[normalized] || labelMap.lancar}
    </span>`;
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
    const statusSelect = document.getElementById('setoran-status');
    if (statusSelect) statusSelect.value = 'lancar';

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
    const statusSelect = document.getElementById('setoran-status');
    if (statusSelect) statusSelect.value = item.status || 'lancar';

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
    const status = document.getElementById('setoran-status').value;

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
        status: status,
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

async function legacyLoadKelompokTab() {
    const container = document.getElementById('kelompok-list-container');

    try {
        const res = await window.apiFetch('kesantrian/kelompok-pengasuhan/');
        const data = typeof res?.json === 'function' ? await res.json() : res;
        kelompokState.list = data.data || [];
    } catch (e) {
        if (container) container.innerHTML =
            '<p style="color:#ef4444;text-align:center;padding:32px;">Gagal memuat kelompok.</p>';
        return;
    }

    try {
        const res2 = await window.apiFetch('students/?limit=1000');
        const d2 = typeof res2?.json === 'function' ? await res2.json() : res2;
        kelompokState.allStudents = d2.data || d2.results || [];
    } catch (e) {
        kelompokState.allStudents = [];
    }

    renderKelompokList();
    setupKelompokSearch();
}

function legacyRenderKelompokList() {
    const container = document.getElementById('kelompok-list-container');
    if (!container) return;
    const list = kelompokState.list;

    if (list.length === 0) {
        container.innerHTML =
            '<p style="color:#9ca3af;text-align:center;padding:32px;">Belum ada kelompok.</p>';
        return;
    }

    container.innerHTML = list.map(k => `
        <div class="kelompok-card" data-id="${k.id}"
             style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;
                    margin-bottom:12px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:16px 20px;cursor:pointer;"
                 data-expand-id="${k.id}">
                <div>
                    <div style="font-size:14px;font-weight:600;color:#111827;">
                        ${k.nama}
                    </div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                        Musyrif: ${k.pengasuh_name || '—'} &nbsp;·&nbsp;
                        ${k.jumlah_santri} santri
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button class="btn-edit-kelompok" data-id="${k.id}"
                            style="font-size:11px;padding:5px 10px;border:1px solid #d1d5db;
                                   border-radius:6px;background:#fff;cursor:pointer;">
                        Edit
                    </button>
                    <button class="btn-hapus-kelompok" data-id="${k.id}"
                            style="font-size:11px;padding:5px 10px;border:1px solid #fecaca;
                                   border-radius:6px;background:#fff;color:#ef4444;
                                   cursor:pointer;">
                        Hapus
                    </button>
                    <span style="font-size:11px;color:#9ca3af;">▼</span>
                </div>
            </div>
            <div id="anggota-panel-${k.id}" style="display:none;
                 border-top:1px solid #f3f4f6;padding:16px 20px;background:#fafafa;">
                <div id="anggota-list-${k.id}" style="margin-bottom:12px;">
                    <p style="color:#9ca3af;font-size:12px;">Memuat anggota...</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;position:relative;">
                    <input id="anggota-search-${k.id}" type="text"
                           placeholder="Cari santri untuk ditambahkan..."
                           style="flex:1;padding:7px 10px;border:1px solid #d1e9df;
                                  border-radius:6px;font-size:12px;outline:none;">
                    <div id="anggota-dropdown-${k.id}"
                         style="display:none;position:absolute;background:#fff;
                                border:1px solid #d1e9df;border-radius:8px;
                                box-shadow:0 8px 20px rgba(0,0,0,0.1);
                                z-index:100;max-height:200px;overflow-y:auto;
                                min-width:280px;"></div>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-expand-id]').forEach(el => {
        el.onclick = (e) => {
            if (e.target.closest('.btn-edit-kelompok') ||
                e.target.closest('.btn-hapus-kelompok')) return;
            const id = el.dataset.expandId;
            toggleAnggotaPanel(id);
        };
    });

    container.querySelectorAll('.btn-edit-kelompok').forEach(btn => {
        btn.onclick = () => openKelompokModal(parseInt(btn.dataset.id));
    });

    container.querySelectorAll('.btn-hapus-kelompok').forEach(btn => {
        btn.onclick = () => hapusKelompok(parseInt(btn.dataset.id));
    });
}

async function legacyToggleAnggotaPanel(kelompokId) {
    const panel = document.getElementById(`anggota-panel-${kelompokId}`);
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        await loadAnggotaPanel(kelompokId);
    }
}

async function legacyLoadAnggotaPanel(kelompokId) {
    const listEl = document.getElementById(`anggota-list-${kelompokId}`);
    if (!listEl) return;

    let anggota = [];
    try {
        const res = await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        anggota = d.data || [];
        const k = kelompokState.list.find(x => x.id == kelompokId);
        if (k) k.anggota_list = anggota;
    } catch (e) {
        listEl.innerHTML = '<p style="color:#ef4444;font-size:12px;">Gagal memuat anggota.</p>';
        return;
    }

    if (anggota.length === 0) {
        listEl.innerHTML = '<p style="color:#9ca3af;font-size:12px;">Belum ada anggota.</p>';
    } else {
        listEl.innerHTML = anggota.map(a => `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <div>
                    <span style="font-size:13px;color:#111827;">${a.nama}</span>
                    <span style="font-size:11px;color:#9ca3af;margin-left:8px;">
                        ${a.kelas} · ${a.nisn}
                    </span>
                </div>
                <button class="btn-hapus-anggota" data-nisn="${a.nisn}"
                        data-kelompok="${kelompokId}"
                        style="font-size:11px;padding:3px 8px;color:#ef4444;
                               border:1px solid #fecaca;border-radius:5px;
                               background:#fff;cursor:pointer;">
                    Hapus
                </button>
            </div>
        `).join('');

        listEl.querySelectorAll('.btn-hapus-anggota').forEach(btn => {
            btn.onclick = () => hapusAnggota(btn.dataset.kelompok, btn.dataset.nisn);
        });
    }

    setupAddAnggotaSearch(kelompokId);
}

function legacySetupAddAnggotaSearch(kelompokId) {
    const input = document.getElementById(`anggota-search-${kelompokId}`);
    const dropdown = document.getElementById(`anggota-dropdown-${kelompokId}`);
    if (!input || !dropdown) return;

    const assignedNisns = new Set();
    kelompokState.list.forEach(k => {
        (k.anggota_list || []).forEach(a => assignedNisns.add(a.nisn));
    });

    const available = kelompokState.allStudents.filter(s => !assignedNisns.has(s.nisn));

    input.oninput = () => {
        const q = input.value.toLowerCase().trim();
        if (!q) { dropdown.style.display = 'none'; return; }
        const filtered = available.filter(s =>
            s.nama.toLowerCase().includes(q) || s.nisn.includes(q)
        ).slice(0, 10);
        if (filtered.length === 0) {
            dropdown.style.display = 'none'; return;
        }
        dropdown.style.display = 'block';
        dropdown.innerHTML = filtered.map(s => `
            <div class="add-anggota-option" data-nisn="${s.nisn}"
                 data-nama="${s.nama}"
                 style="padding:8px 12px;cursor:pointer;font-size:13px;
                        border-bottom:1px solid #f3f4f6;">
                <span>${s.nama}</span>
                <span style="font-size:11px;color:#9ca3af;margin-left:6px;">
                    ${s.kelas} · ${s.nisn}
                </span>
            </div>
        `).join('');
        dropdown.querySelectorAll('.add-anggota-option').forEach(opt => {
            opt.onclick = async () => {
                dropdown.style.display = 'none';
                input.value = '';
                await tambahAnggota(kelompokId, opt.dataset.nisn);
            };
        });
    };

    document.addEventListener('click', function closeDropdown(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

async function legacyTambahAnggota(kelompokId, nisn) {
    try {
        await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nisn })
        });
        await loadAnggotaPanel(kelompokId);
        await refreshKelompokCard(kelompokId);
    } catch (e) {
        alert('Gagal menambahkan santri.');
    }
}

async function legacyHapusAnggota(kelompokId, nisn) {
    if (!confirm('Hapus santri ini dari kelompok?')) return;
    try {
        await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/${nisn}/`, {
            method: 'DELETE'
        });
        await loadAnggotaPanel(kelompokId);
        await refreshKelompokCard(kelompokId);
    } catch (e) {
        alert('Gagal menghapus santri.');
    }
}

async function legacyRefreshKelompokCard(kelompokId) {
    try {
        const res = await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kelompokId}/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const updated = d.data;
        if (!updated) return;
        const idx = kelompokState.list.findIndex(x => x.id == kelompokId);
        if (idx !== -1) {
            kelompokState.list[idx] = {
                ...kelompokState.list[idx], ...updated };
        }
        const card = document.querySelector(`.kelompok-card[data-id="${kelompokId}"]`);
        if (card) {
            const subtitle = card.querySelector('[data-expand-id] div div:last-child');
            if (subtitle) subtitle.textContent =
                `Musyrif: ${updated.pengasuh_name || '—'} · ${updated.jumlah_santri} santri`;
        }
    } catch (e) { /* silent */ }
}

async function legacyOpenKelompokModal(kelompokId = null) {
    const modal = document.getElementById('modal-kelompok');
    const title = document.getElementById('modal-kelompok-title');
    const inputNama = document.getElementById('input-kelompok-nama');
    const selectMusyrif = document.getElementById('input-kelompok-musyrif');
    if (!modal) return;

    kelompokState.editingId = kelompokId;
    title.textContent = kelompokId ? 'Edit Kelompok' : 'Buat Kelompok';
    inputNama.value = '';
    selectMusyrif.innerHTML = '<option value="">-- Pilih Musyrif --</option>';

    try {
        const res = await window.apiFetch('auth/users/?role=guru');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const resM = await window.apiFetch('auth/users/?role=musyrif');
        const dM = typeof resM?.json === 'function' ? await resM.json() : resM;
        const users = [...(d.data || []), ...(dM.data || [])];
        users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = u.name;
            selectMusyrif.appendChild(opt);
        });
    } catch (e) { /* tetap buka modal meski gagal load musyrif */ }

    if (kelompokId) {
        const k = kelompokState.list.find(x => x.id === kelompokId);
        if (k) {
            inputNama.value = k.nama;
            if (k.pengasuh) selectMusyrif.value = k.pengasuh;
        }
    }

    modal.style.display = 'flex';
}

async function legacySaveKelompok() {
    const nama = document.getElementById('input-kelompok-nama')?.value?.trim();
    const pengasuhId = document.getElementById('input-kelompok-musyrif')?.value;
    if (!nama) { alert('Nama kelompok wajib diisi.'); return; }
    if (!pengasuhId) { alert('Pengasuh wajib dipilih.'); return; }

    const isEdit = !!kelompokState.editingId;
    const url = isEdit
        ? `kesantrian/kelompok-pengasuhan/${kelompokState.editingId}/`
        : 'kesantrian/kelompok-pengasuhan/';
    const method = isEdit ? 'PATCH' : 'POST';

    try {
        await window.apiFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, pengasuh_id: pengasuhId || null, kelas: '' })
        });
        document.getElementById('modal-kelompok').style.display = 'none';
        await loadKelompokTab();
    } catch (e) {
        alert('Gagal menyimpan kelompok.');
    }
}

async function legacyHapusKelompok(kelompokId) {
    if (!confirm('Hapus kelompok ini? Semua data anggota akan ikut terhapus.')) return;
    try {
        await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kelompokId}/`, {
            method: 'DELETE'
        });
        await loadKelompokTab();
    } catch (e) {
        alert('Gagal menghapus kelompok.');
    }
}

function legacySetupKelompokSearch() {
    const input = document.getElementById('kelompok-santri-search');
    const result = document.getElementById('kelompok-santri-search-result');
    if (!input || !result) return;

    input.oninput = () => {
        const q = input.value.toLowerCase().trim();
        if (!q) { result.style.display = 'none'; return; }

        const found = [];
        kelompokState.list.forEach(k => {
            (k.anggota_list || []).forEach(a => {
                if (a.nama.toLowerCase().includes(q) || a.nisn.includes(q)) {
                    found.push({ santri: a, kelompok: k });
                }
            });
        });

        const assignedNisns = new Set();
        kelompokState.list.forEach(k => {
            (k.anggota_list || []).forEach(a => assignedNisns.add(a.nisn));
        });
        kelompokState.allStudents
            .filter(s => !assignedNisns.has(s.nisn) &&
                (s.nama.toLowerCase().includes(q) || s.nisn.includes(q)))
            .forEach(s => found.push({ santri: s, kelompok: null }));

        if (found.length === 0) {
            result.style.display = 'block';
            result.innerHTML = '<span style="color:#9ca3af;">Santri tidak ditemukan.</span>';
            return;
        }

        result.style.display = 'block';
        result.innerHTML = found.slice(0, 8).map(f => `
            <div style="padding:6px 0;border-bottom:1px solid #f3f4f6;
                        display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:13px;font-weight:500;color:#111827;">
                        ${f.santri.nama}
                    </span>
                    <span style="font-size:11px;color:#9ca3af;margin-left:6px;">
                        ${f.santri.kelas} · ${f.santri.nisn}
                    </span>
                </div>
                <div style="font-size:12px;">
                    ${f.kelompok
                        ? `<span style="color:#1d9e75;font-weight:500;">
                               ${f.kelompok.nama}
                           </span>
                           <span style="color:#9ca3af;font-size:11px;">
                               (${f.kelompok.pengasuh_name || '—'})
                           </span>`
                        : '<span style="color:#f59e0b;">Belum ada kelompok</span>'
                    }
                </div>
            </div>
        `).join('');
    };
}

async function parseApiData(res) {
    if (typeof res?.json !== 'function') return res;
    try {
        return await res.json();
    } catch (e) {
        return null;
    }
}

function extractList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data?.students)) return data.students;
    if (Array.isArray(data?.users)) return data.users;
    return [];
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ============================================
// TAB KELOMPOK HAFALAN
// ============================================

function getKelompokHafalanAnggota(kelompok) {
    const raw = kelompok?.anggota_list || kelompok?.anggota || kelompok?.members || [];
    return Array.isArray(raw) ? raw : [];
}

function getKelompokHafalanUstadzName(kelompok) {
    return kelompok?.ustadz_name || kelompok?.ustadz_nama || kelompok?.guru_name ||
        kelompok?.pengasuh_name || kelompok?.ustadz?.name || kelompok?.ustadz?.username || '-';
}

function getKelompokHafalanUstadzId(kelompok) {
    return kelompok?.ustadz || kelompok?.ustadz_id || kelompok?.guru || kelompok?.pengasuh || '';
}

function getAnggotaHafalanNisn(anggota) {
    return anggota?.nisn || anggota?.santri_nisn || anggota?.santri || anggota?.siswa_nisn || '';
}

function getAnggotaHafalanNama(anggota) {
    return anggota?.nama || anggota?.santri_nama || anggota?.siswa_nama || anggota?.santri?.nama || '-';
}

function getAnggotaHafalanNomor(anggota, index) {
    return anggota?.nomor_urut_absen || anggota?.nomor_urut || anggota?.urutan || anggota?.no_absen || (index + 1);
}

function populateKelompokHafalanKelasSelect(select, includeEmptyLabel = 'Semua Kelas') {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${includeEmptyLabel}</option>`;
    kelompokHafalanState.kelasList.forEach(kelas => {
        const opt = document.createElement('option');
        opt.value = kelas;
        opt.textContent = kelas;
        select.appendChild(opt);
    });
    select.value = current;
}

async function loadKelompokHafalanTab() {
    const container = document.getElementById('kelompok-hafalan-list-container');
    if (!container) return;

    container.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:32px 0;">Memuat data kelompok hafalan...</p>';

    try {
        const kelasFilter = document.getElementById('kh-filter-kelas')?.value || '';
        const endpoint = kelasFilter
            ? `kesantrian/hafalan/kelompok/?kelas=${encodeURIComponent(kelasFilter)}`
            : 'kesantrian/hafalan/kelompok/';

        const [kelompokRes, guruRes, kelasRes, siswaRes] = await Promise.all([
            window.apiFetch(endpoint),
            window.apiFetch('users/?role=guru&page_size=200'),
            window.apiFetch('students/classes/'),
            window.apiFetch('students/?page_size=1000')
        ]);

        kelompokHafalanState.list = extractList(await parseApiData(kelompokRes));
        kelompokHafalanState.guruList = extractList(await parseApiData(guruRes));
        const kelasData = await parseApiData(kelasRes);
        kelompokHafalanState.kelasList = Array.isArray(kelasData) ? kelasData : (kelasData?.classes || []);
        kelompokHafalanState.allStudents = extractList(await parseApiData(siswaRes));

        populateKelompokHafalanKelasSelect(document.getElementById('kh-filter-kelas'));
        populateKelompokHafalanKelasSelect(document.getElementById('kh-generate-kelas'), 'Pilih Kelas...');
        renderKelompokHafalanList();
    } catch (e) {
        console.error('[hafalan] gagal memuat kelompok hafalan:', e);
        container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:32px;">Gagal memuat kelompok hafalan.</p>';
    }
}

function renderKelompokHafalanList() {
    const container = document.getElementById('kelompok-hafalan-list-container');
    if (!container) return;

    if (!kelompokHafalanState.list.length) {
        container.innerHTML = `
            <div class="kh-empty-state">
                <div style="font-size:2rem;">📖</div>
                <p>Belum ada kelompok hafalan.</p>
            </div>`;
        return;
    }

    container.innerHTML = kelompokHafalanState.list.map(k => {
        const anggota = getKelompokHafalanAnggota(k);
        const isExpanded = kelompokHafalanState.expandedId === k.id;
        const ketua = anggota.find(a => a.is_ketua);

        return `
            <div class="kh-card" id="kh-card-${k.id}">
                <div class="kh-card-header">
                    <div class="kh-card-info">
                        <span class="kh-card-title">${escapeAttr(k.nama || 'Kelompok Hafalan')}</span>
                        <span class="kh-card-meta">
                            Kelas ${escapeAttr(k.kelas || '-')} · Ustadz ${escapeAttr(getKelompokHafalanUstadzName(k))} ·
                            ${anggota.length} anggota
                            ${ketua ? ` · Ketua: ${escapeAttr(getAnggotaHafalanNama(ketua))}` : ''}
                        </span>
                    </div>
                    <div class="kh-card-actions">
                        <button class="kh-btn-edit" data-id="${k.id}">Edit</button>
                        <button class="kh-btn-delete" data-id="${k.id}">Hapus</button>
                        <button class="kh-btn-expand" data-id="${k.id}">
                            ${isExpanded ? '▲ Tutup' : '▼ Anggota'}
                        </button>
                    </div>
                </div>
                ${isExpanded ? renderKelompokHafalanAnggotaPanel(k) : ''}
            </div>`;
    }).join('');

    container.querySelectorAll('.kh-btn-expand').forEach(btn => {
        btn.onclick = function() {
            const id = parseInt(this.dataset.id);
            kelompokHafalanState.expandedId = kelompokHafalanState.expandedId === id ? null : id;
            renderKelompokHafalanList();
        };
    });
    container.querySelectorAll('.kh-btn-edit').forEach(btn => {
        btn.onclick = function() { bukaModalKelompokHafalan(parseInt(this.dataset.id)); };
    });
    container.querySelectorAll('.kh-btn-delete').forEach(btn => {
        btn.onclick = function() { hapusKelompokHafalan(parseInt(this.dataset.id)); };
    });
    attachKelompokHafalanAnggotaHandlers();
}

function renderKelompokHafalanAnggotaPanel(kelompok) {
    const anggota = getKelompokHafalanAnggota(kelompok);
    const rows = anggota.map((a, index) => {
        const nisn = getAnggotaHafalanNisn(a);
        const nama = getAnggotaHafalanNama(a);
        return `
            <tr>
                <td>${escapeAttr(getAnggotaHafalanNomor(a, index))}</td>
                <td>
                    ${a.is_ketua ? '<span class="kh-badge-ketua">Ketua</span>' : ''}
                    ${escapeAttr(nama)}
                </td>
                <td>${escapeAttr(nisn)}</td>
                <td>
                    <button class="kh-btn-ketua"
                            data-id="${kelompok.id}"
                            data-nisn="${escapeAttr(nisn)}"
                            data-is-ketua="${a.is_ketua ? 'true' : 'false'}">
                        ${a.is_ketua ? 'Lepas Ketua' : 'Set Ketua'}
                    </button>
                    <button class="kh-btn-anggota-delete"
                            data-id="${kelompok.id}"
                            data-nisn="${escapeAttr(nisn)}">
                        Hapus
                    </button>
                </td>
            </tr>`;
    }).join('');

    return `
        <div class="kh-anggota-panel">
            <table class="kh-anggota-table">
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Nama</th>
                        <th>NISN</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;">Belum ada anggota</td></tr>'}
                </tbody>
            </table>
            <div class="kh-tambah-anggota">
                <button class="kh-btn-add-focus" data-id="${kelompok.id}">+ Tambah Anggota</button>
                <input type="text"
                       id="kh-search-anggota-${kelompok.id}"
                       class="kh-search-anggota-input"
                       placeholder="Cari santri nama/NISN...">
                <div id="kh-search-anggota-result-${kelompok.id}" class="kh-search-result" style="display:none;"></div>
            </div>
        </div>`;
}

function attachKelompokHafalanAnggotaHandlers() {
    const container = document.getElementById('kelompok-hafalan-list-container');
    if (!container) return;

    container.querySelectorAll('.kh-btn-ketua').forEach(btn => {
        btn.onclick = async function() {
            const isKetua = this.dataset.isKetua === 'true';
            await setKetuaHafalan(parseInt(this.dataset.id), this.dataset.nisn, !isKetua);
        };
    });
    container.querySelectorAll('.kh-btn-anggota-delete').forEach(btn => {
        btn.onclick = async function() {
            await hapusAnggotaHafalan(parseInt(this.dataset.id), this.dataset.nisn);
        };
    });
    container.querySelectorAll('.kh-btn-add-focus').forEach(btn => {
        btn.onclick = function() {
            document.getElementById(`kh-search-anggota-${this.dataset.id}`)?.focus();
        };
    });

    kelompokHafalanState.list.forEach(k => {
        const input = document.getElementById(`kh-search-anggota-${k.id}`);
        const result = document.getElementById(`kh-search-anggota-result-${k.id}`);
        if (!input || !result) return;

        input.oninput = function() {
            const q = this.value.toLowerCase().trim();
            result.style.display = 'none';
            result.innerHTML = '';
            if (!q) return;

            const existing = new Set(getKelompokHafalanAnggota(k).map(getAnggotaHafalanNisn));
            const matches = kelompokHafalanState.allStudents
                .filter(s => !existing.has(s.nisn) &&
                    ((s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').includes(q)))
                .slice(0, 8);

            result.style.display = 'block';
            if (!matches.length) {
                result.innerHTML = '<div class="kh-search-empty">Santri tidak ditemukan</div>';
                return;
            }

            result.innerHTML = matches.map(s => `
                <div class="kh-search-item" data-id="${k.id}" data-nisn="${escapeAttr(s.nisn)}">
                    <strong>${escapeAttr(s.nama)}</strong>
                    <span>${escapeAttr(s.kelas || '-')} · ${escapeAttr(s.nisn)}</span>
                </div>`).join('');

            result.querySelectorAll('.kh-search-item').forEach(item => {
                item.onclick = async function() {
                    await tambahAnggotaHafalan(parseInt(this.dataset.id), this.dataset.nisn);
                    input.value = '';
                    result.style.display = 'none';
                };
            });
        };
    });
}

function bukaModalKelompokHafalan(id = null) {
    const modal = document.getElementById('modal-kelompok-hafalan');
    const title = document.getElementById('modal-kelompok-hafalan-title');
    const idInput = document.getElementById('kh-modal-id');
    const namaInput = document.getElementById('kh-modal-nama');
    const kelasInput = document.getElementById('kh-modal-kelas');
    const ustadzSelect = document.getElementById('kh-modal-ustadz');
    const tahunAjaranInput = document.getElementById('kh-modal-tahun-ajaran');
    if (!modal || !title || !idInput || !namaInput || !kelasInput || !ustadzSelect) return;

    kelompokHafalanState.editingId = id;
    ustadzSelect.innerHTML = '<option value="">-- Pilih Ustadz --</option>';
    kelompokHafalanState.guruList.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name || g.username;
        ustadzSelect.appendChild(opt);
    });

    if (id) {
        const k = kelompokHafalanState.list.find(item => item.id === id);
        if (!k) return;
        title.textContent = 'Edit Kelompok Hafalan';
        idInput.value = id;
        namaInput.value = k.nama || '';
        kelasInput.value = k.kelas || '';
        ustadzSelect.value = getKelompokHafalanUstadzId(k) || '';
        if (tahunAjaranInput) tahunAjaranInput.value = k.tahun_ajaran || '';
    } else {
        title.textContent = 'Buat Kelompok Hafalan';
        idInput.value = '';
        namaInput.value = '';
        kelasInput.value = document.getElementById('kh-filter-kelas')?.value || '';
        ustadzSelect.value = '';
        if (tahunAjaranInput) tahunAjaranInput.value = '';
    }

    modal.style.display = 'flex';
    document.getElementById('btn-kh-modal-cancel').onclick = function() {
        modal.style.display = 'none';
    };
    document.getElementById('btn-kh-modal-save').onclick = function() {
        saveKelompokHafalan(idInput.value || null);
    };
}

function bukaModalGenerateKelompokHafalan() {
    const modal = document.getElementById('modal-generate-kelompok-hafalan');
    const kelasSelect = document.getElementById('kh-generate-kelas');
    if (!modal || !kelasSelect) return;
    populateKelompokHafalanKelasSelect(kelasSelect, 'Pilih Kelas...');
    kelasSelect.value = document.getElementById('kh-filter-kelas')?.value || '';
    modal.style.display = 'flex';

    document.getElementById('btn-kh-generate-cancel').onclick = function() {
        modal.style.display = 'none';
    };
    document.getElementById('btn-kh-generate-confirm').onclick = async function() {
        await generateKelompokHafalan(kelasSelect.value);
    };
}

async function saveKelompokHafalan(id = null) {
    const modal = document.getElementById('modal-kelompok-hafalan');
    const nama = document.getElementById('kh-modal-nama')?.value?.trim();
    const kelas = document.getElementById('kh-modal-kelas')?.value?.trim();
    const ustadz = document.getElementById('kh-modal-ustadz')?.value;
    const tahunAjaran = document.getElementById('kh-modal-tahun-ajaran')?.value;
    if (!nama || !kelas) {
        alert('Nama kelompok dan kelas wajib diisi.');
        return;
    }

    const body = { nama, kelas, ustadz: ustadz || null };
    if (tahunAjaran) body.tahun_ajaran = tahunAjaran;
    const url = id ? `kesantrian/hafalan/kelompok/${id}/` : 'kesantrian/hafalan/kelompok/';
    const method = id ? 'PATCH' : 'POST';
    const res = await parseApiData(await window.apiFetch(url, {
        method,
        body: JSON.stringify(body)
    }));

    if (res?.success) {
        if (modal) modal.style.display = 'none';
        await loadKelompokHafalanTab();
    } else {
        alert(res?.message || 'Gagal menyimpan kelompok hafalan.');
    }
}

async function generateKelompokHafalan(kelas) {
    const modal = document.getElementById('modal-generate-kelompok-hafalan');
    if (!kelas) {
        alert('Pilih kelas terlebih dahulu.');
        return;
    }
    if (!confirm(`Generate kelompok hafalan otomatis untuk kelas ${kelas}?`)) return;

    const res = await parseApiData(await window.apiFetch(
        'kesantrian/hafalan/kelompok/generate/',
        { method: 'POST', body: JSON.stringify({ kelas }) }
    ));

    if (res?.success) {
        if (modal) modal.style.display = 'none';
        await loadKelompokHafalanTab();
    } else {
        const message = res?.message || res?.detail || 'Gagal generate kelompok hafalan.';
        alert(message.toLowerCase().includes('sudah ada')
            ? `Kelompok untuk kelas ini sudah ada. ${message}`
            : message);
    }
}

async function hapusKelompokHafalan(id) {
    if (!confirm('Hapus kelompok hafalan ini beserta anggotanya?')) return;
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/hafalan/kelompok/${id}/`,
        { method: 'DELETE' }
    ));
    if (res?.success || res === null) {
        if (kelompokHafalanState.expandedId === id) kelompokHafalanState.expandedId = null;
        await loadKelompokHafalanTab();
    } else {
        alert(res?.message || 'Gagal menghapus kelompok hafalan.');
    }
}

async function tambahAnggotaHafalan(kelompokId, nisn) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/hafalan/kelompok/${kelompokId}/anggota/`,
        { method: 'POST', body: JSON.stringify({ nisn, is_ketua: false }) }
    ));
    if (res?.success) {
        await refreshKelompokHafalanData(kelompokId);
    } else {
        alert(res?.message || 'Gagal menambah anggota.');
    }
}

async function hapusAnggotaHafalan(kelompokId, nisn) {
    if (!confirm('Hapus santri ini dari kelompok hafalan?')) return;
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/hafalan/kelompok/${kelompokId}/anggota/${nisn}/`,
        { method: 'DELETE' }
    ));
    if (res?.success || res === null) {
        await refreshKelompokHafalanData(kelompokId);
    } else {
        alert(res?.message || 'Gagal menghapus anggota.');
    }
}

async function setKetuaHafalan(kelompokId, nisn, isKetua = true) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/hafalan/kelompok/${kelompokId}/anggota/${nisn}/set-ketua/`,
        { method: 'PATCH', body: JSON.stringify({ is_ketua: isKetua }) }
    ));
    if (res?.success) {
        await refreshKelompokHafalanData(kelompokId);
    } else {
        alert(res?.message || 'Gagal mengupdate ketua.');
    }
}

async function refreshKelompokHafalanData(kelompokId) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/hafalan/kelompok/${kelompokId}/`
    ));
    if (res?.success && res.data) {
        const idx = kelompokHafalanState.list.findIndex(k => k.id === kelompokId);
        if (idx !== -1) kelompokHafalanState.list[idx] = res.data;
    } else {
        await loadKelompokHafalanTab();
        return;
    }
    renderKelompokHafalanList();
}

async function loadKelompokTab() {
    const container = document.getElementById('kelompok-list-container');

    try {
        const [kelompokRes, guruRes, siswaRes] = await Promise.all([
            window.apiFetch('kesantrian/kelompok-pengasuhan/'),
            window.apiFetch('users/?role=guru&page_size=200'),
            window.apiFetch('students/?page_size=500')
        ]);

        kelompokState.list = extractList(await parseApiData(kelompokRes));
        kelompokState.guruList = extractList(await parseApiData(guruRes));
        kelompokState.allStudents = extractList(await parseApiData(siswaRes));
    } catch (e) {
        console.error('[hafalan] gagal memuat tab kelompok:', e);
        if (container) {
            container.innerHTML =
                '<p style="color:#ef4444;text-align:center;padding:32px;">Gagal memuat kelompok.</p>';
        }
        return;
    }

    renderKelompokList();
    setupKelompokSearch();
}

function renderKelompokList() {
    const container = document.getElementById('kelompok-list-container');
    if (!container) return;

    if (!kelompokState.list.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#9ca3af;">
                <div style="font-size:2rem;">👥</div>
                <p>Belum ada kelompok. Buat kelompok baru.</p>
            </div>`;
        return;
    }

    container.innerHTML = kelompokState.list.map(k => {
        const anggota = k.anggota_list || [];
        const ketua = anggota.find(a => a.is_ketua);
        const isExpanded = kelompokState.expandedId === k.id;

        return `
        <div class="kelompok-card" id="kelompok-card-${k.id}">
            <div class="kelompok-card-header" id="kelompok-header-${k.id}">
                <div class="kelompok-info">
                    <span class="kelompok-nama">${k.nama}</span>
                    <span class="kelompok-meta">
                        👤 ${k.pengasuh_name || '-'} &nbsp;&middot;&nbsp;
                        🎓 ${anggota.length} anggota
                        ${ketua ? `&nbsp;&middot;&nbsp; ⭐ Ketua: ${ketua.nama}` : ''}
                    </span>
                </div>
                <div class="kelompok-actions">
                    <button class="kelompok-btn-edit" data-id="${k.id}">Edit</button>
                    <button class="kelompok-btn-hapus" data-id="${k.id}">Hapus</button>
                    <button class="kelompok-btn-expand" data-id="${k.id}">
                        ${isExpanded ? '▲ Tutup' : '▼ Anggota'}
                    </button>
                </div>
            </div>
            ${isExpanded ? renderAnggotaPanel(k) : ''}
        </div>`;
    }).join('');

    container.querySelectorAll('.kelompok-btn-expand').forEach(btn => {
        btn.onclick = async function() {
            const id = parseInt(this.dataset.id);
            const willOpen = kelompokState.expandedId !== id;
            kelompokState.expandedId = willOpen ? id : null;
            if (!willOpen) {
                kelompokState.expandedPertemuanId = null;
            }
            if (willOpen && !kelompokState.pertemuanByKelompok[id]) {
                await loadKelompokPertemuanList(id);
            }
            renderKelompokList();
        };
    });
    container.querySelectorAll('.kelompok-btn-edit').forEach(btn => {
        btn.onclick = function() { bukaModalKelompok(parseInt(this.dataset.id)); };
    });
    container.querySelectorAll('.kelompok-btn-hapus').forEach(btn => {
        btn.onclick = function() { hapusKelompok(parseInt(this.dataset.id)); };
    });
    attachAnggotaHandlers();
}

function renderAnggotaPanel(k) {
    const anggota = k.anggota_list || [];

    const anggotaRows = anggota.map(a => `
        <tr id="anggota-row-${k.id}-${a.nisn}">
            <td>
                ${a.is_ketua ? '<span class="badge-ketua">⭐ Ketua</span>' : ''}
                ${a.nama}
            </td>
            <td>${a.kelas}</td>
            <td>${a.nisn}</td>
            <td>
                <button class="anggota-btn-ketua"
                    data-kid="${k.id}"
                    data-nisn="${a.nisn}"
                    data-is-ketua="${a.is_ketua}">
                    ${a.is_ketua ? 'Lepas Ketua' : 'Jadikan Ketua'}
                </button>
                <button class="anggota-btn-hapus"
                    data-kid="${k.id}"
                    data-nisn="${a.nisn}">
                    Hapus
                </button>
            </td>
        </tr>`).join('');

    return `
    <div class="kelompok-anggota-panel">
        <table class="anggota-table">
            <thead>
                <tr>
                    <th>Nama</th><th>Kelas</th>
                    <th>NISN</th><th>Aksi</th>
                </tr>
            </thead>
            <tbody>${anggotaRows || '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">Belum ada anggota</td></tr>'}</tbody>
        </table>
        <div class="tambah-anggota-wrapper">
            <input type="text"
                id="search-anggota-${k.id}"
                placeholder="🔍 Cari santri untuk ditambahkan..."
                class="tambah-anggota-input">
            <div id="search-anggota-result-${k.id}"
                class="tambah-anggota-result"
                style="display:none;"></div>
        </div>
        ${renderKelompokPertemuanSection(k)}
    </div>`;
}

function renderKelompokPertemuanSection(k) {
    const pertemuanList = kelompokState.pertemuanByKelompok[k.id] || [];

    const itemsHtml = pertemuanList.length
        ? pertemuanList.map(p => {
            const isOpen = kelompokState.expandedPertemuanId === p.id;
            const total = (k.anggota_list || []).length;
            const hadir = p.jumlah_hadir ?? hitungHadirPertemuan(p.id);
            return `
            <div class="kelompok-pertemuan-item" id="kelompok-pertemuan-${p.id}">
                <div class="kelompok-pertemuan-header" data-pertemuan-id="${p.id}" data-kid="${k.id}">
                    <div>
                        <div class="kelompok-pertemuan-title">${p.judul || 'Pertemuan'}</div>
                        <div class="kelompok-pertemuan-meta">
                            ${p.tanggal || '-'} &middot; ${p.lokasi || '-'}
                        </div>
                    </div>
                    <div class="kelompok-pertemuan-summary">
                        <span>${hadir}/${total} hadir</span>
                        <button class="kelompok-btn-presensi"
                            data-pertemuan-id="${p.id}"
                            data-kid="${k.id}">
                            ${isOpen ? 'Tutup Presensi' : 'Input Presensi'}
                        </button>
                    </div>
                </div>
                ${isOpen ? renderKelompokPresensiPanel(p.id, k) : ''}
            </div>`;
        }).join('')
        : '<div class="kelompok-pertemuan-empty">Belum ada pertemuan untuk kelompok ini.</div>';

    return `
    <div class="kelompok-pertemuan-section">
        <div class="kelompok-section-header">
            <h4>Pertemuan</h4>
            <button class="kelompok-btn-tambah-pertemuan" data-kid="${k.id}">
                + Tambah Pertemuan
            </button>
        </div>
        <div class="kelompok-pertemuan-list" id="kelompok-pertemuan-list-${k.id}">
            ${itemsHtml}
        </div>
    </div>`;
}

function renderKelompokPresensiPanel(pertemuanId, k) {
    const anggota = k.anggota_list || [];
    const presensiMap = buildPresensiMap(pertemuanId);

    if (!anggota.length) {
        return '<div class="kelompok-presensi-panel"><p style="color:#9ca3af;">Belum ada anggota kelompok.</p></div>';
    }

    const rows = anggota.map(a => {
        const existing = presensiMap[a.nisn] || {};
        const statusVal = existing.status || 'tidak_hadir';
        const catatanVal = escapeAttr(existing.catatan || '');
        return `
        <tr>
            <td>${a.nama}</td>
            <td>${a.nisn}</td>
            <td>
                <select class="kelompok-presensi-status" data-nisn="${a.nisn}">
                    <option value="hadir" ${statusVal === 'hadir' ? 'selected' : ''}>Hadir</option>
                    <option value="izin" ${statusVal === 'izin' ? 'selected' : ''}>Izin</option>
                    <option value="sakit" ${statusVal === 'sakit' ? 'selected' : ''}>Sakit</option>
                    <option value="tidak_hadir" ${statusVal === 'tidak_hadir' ? 'selected' : ''}>Tidak Hadir</option>
                </select>
            </td>
            <td>
                <input type="text"
                    class="kelompok-presensi-catatan"
                    data-nisn="${a.nisn}"
                    value="${catatanVal}"
                    placeholder="Catatan opsional">
            </td>
        </tr>`;
    }).join('');

    return `
    <div class="kelompok-presensi-panel" id="kelompok-presensi-panel-${pertemuanId}">
        <table class="kelompok-presensi-table">
            <thead>
                <tr>
                    <th>Nama Santri</th>
                    <th>NISN</th>
                    <th>Status</th>
                    <th>Catatan</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <button class="kelompok-btn-simpan-presensi"
            data-pertemuan-id="${pertemuanId}"
            data-kid="${k.id}">
            Simpan Presensi
        </button>
    </div>`;
}

function attachAnggotaHandlers() {
    const container = document.getElementById('kelompok-list-container');
    if (!container) return;

    container.querySelectorAll('.anggota-btn-ketua').forEach(btn => {
        btn.onclick = async function() {
            const kid = parseInt(this.dataset.kid);
            const nisn = this.dataset.nisn;
            const isKetua = this.dataset.isKetua === 'true';
            await setKetuaKelompok(kid, nisn, !isKetua);
        };
    });

    container.querySelectorAll('.anggota-btn-hapus').forEach(btn => {
        btn.onclick = async function() {
            const kid = parseInt(this.dataset.kid);
            const nisn = this.dataset.nisn;
            await hapusAnggotaKelompok(kid, nisn);
        };
    });

    kelompokState.list.forEach(k => {
        const input = document.getElementById(`search-anggota-${k.id}`);
        const result = document.getElementById(`search-anggota-result-${k.id}`);
        if (!input || !result) return;

        input.oninput = function() {
            const q = this.value.toLowerCase().trim();
            result.style.display = 'none';
            result.innerHTML = '';
            if (!q) return;

            const existingNisns = new Set((k.anggota_list || []).map(a => a.nisn));
            const matches = kelompokState.allStudents
                .filter(s => !existingNisns.has(s.nisn) &&
                    ((s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').includes(q)))
                .slice(0, 6);

            if (!matches.length) {
                result.style.display = 'block';
                result.innerHTML = '<div class="search-item-empty">Tidak ditemukan</div>';
                return;
            }

            result.style.display = 'block';
            result.innerHTML = matches.map(s => `
                <div class="search-item"
                     data-nisn="${s.nisn}"
                     data-kid="${k.id}">
                    <strong>${s.nama}</strong>
                    <span>${s.kelas} &middot; ${s.nisn}</span>
                </div>`).join('');

            result.querySelectorAll('.search-item').forEach(item => {
                item.onclick = async function() {
                    await tambahAnggotaKelompok(
                        parseInt(this.dataset.kid),
                        this.dataset.nisn
                    );
                    input.value = '';
                    result.style.display = 'none';
                };
            });
        };
    });

    attachKelompokPertemuanHandlers();
}

function attachKelompokPertemuanHandlers() {
    const container = document.getElementById('kelompok-list-container');
    if (!container) return;

    container.querySelectorAll('.kelompok-btn-tambah-pertemuan').forEach(btn => {
        btn.onclick = function() {
            openModalTambahPertemuan(parseInt(this.dataset.kid));
        };
    });

    container.querySelectorAll('.kelompok-pertemuan-header').forEach(item => {
        item.onclick = async function(e) {
            if (e.target.closest('.kelompok-btn-presensi')) return;
            await toggleKelompokPresensiPanel(
                parseInt(this.dataset.pertemuanId),
                parseInt(this.dataset.kid)
            );
        };
    });

    container.querySelectorAll('.kelompok-btn-presensi').forEach(btn => {
        btn.onclick = async function() {
            await toggleKelompokPresensiPanel(
                parseInt(this.dataset.pertemuanId),
                parseInt(this.dataset.kid)
            );
        };
    });

    container.querySelectorAll('.kelompok-btn-simpan-presensi').forEach(btn => {
        btn.onclick = async function() {
            await simpanPresensi(
                parseInt(this.dataset.pertemuanId),
                parseInt(this.dataset.kid)
            );
        };
    });
}

async function loadKelompokPertemuanList(kelompokId) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/pertemuan-pengasuhan/?kelompok=${kelompokId}`
    ));
    kelompokState.pertemuanByKelompok[kelompokId] = extractList(res);
}

async function openModalTambahPertemuan(kelompokId) {
    kelompokState.pertemuanModalKelompokId = kelompokId;

    const modal = document.getElementById('modal-kelompok-pertemuan');
    const judulInput = document.getElementById('input-kelompok-pertemuan-judul');
    const tanggalInput = document.getElementById('input-kelompok-pertemuan-tanggal');
    const lokasiInput = document.getElementById('input-kelompok-pertemuan-lokasi');
    if (!modal || !judulInput || !tanggalInput || !lokasiInput) return;

    judulInput.value = '';
    tanggalInput.value = new Date().toISOString().split('T')[0];
    lokasiInput.value = '';
    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('btn-modal-kelompok-pertemuan-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }

    const saveBtn = document.getElementById('btn-modal-kelompok-pertemuan-save');
    if (saveBtn) {
        saveBtn.onclick = simpanKelompokPertemuan;
    }
}

async function simpanKelompokPertemuan() {
    const kelompokId = kelompokState.pertemuanModalKelompokId;
    const modal = document.getElementById('modal-kelompok-pertemuan');
    const judul = document.getElementById('input-kelompok-pertemuan-judul')?.value?.trim();
    const tanggal = document.getElementById('input-kelompok-pertemuan-tanggal')?.value;
    const lokasi = document.getElementById('input-kelompok-pertemuan-lokasi')?.value?.trim();

    if (!kelompokId) return;
    if (!judul || !tanggal) {
        alert('Judul dan tanggal wajib diisi.');
        return;
    }

    const res = await parseApiData(await window.apiFetch(
        'kesantrian/pertemuan-pengasuhan/',
        {
            method: 'POST',
            body: JSON.stringify({ kelompok: kelompokId, judul, tanggal, lokasi })
        }
    ));

    if (res?.success) {
        if (modal) modal.style.display = 'none';
        await loadKelompokPertemuanList(kelompokId);
        renderKelompokList();
    } else {
        alert(res?.message || 'Gagal menyimpan pertemuan.');
    }
}

async function toggleKelompokPresensiPanel(pertemuanId, kelompokId) {
    const willOpen = kelompokState.expandedPertemuanId !== pertemuanId;
    kelompokState.expandedPertemuanId = willOpen ? pertemuanId : null;

    if (willOpen) {
        await loadKelompokPresensi(pertemuanId);
    }
    renderKelompokList();
}

async function loadKelompokPresensi(pertemuanId) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/pertemuan-pengasuhan/${pertemuanId}/presensi/`
    ));
    kelompokState.presensiByPertemuan[pertemuanId] = extractList(res);
}

function buildPresensiMap(pertemuanId) {
    const map = {};
    (kelompokState.presensiByPertemuan[pertemuanId] || []).forEach(p => {
        const nisn = p.santri_nisn || p.nisn || p.santri;
        if (nisn) map[nisn] = p;
    });
    return map;
}

function hitungHadirPertemuan(pertemuanId) {
    return (kelompokState.presensiByPertemuan[pertemuanId] || [])
        .filter(p => p.status === 'hadir')
        .length;
}

async function simpanPresensiKelompok(pertemuanId, kelompokId) {
    const panel = document.getElementById(`kelompok-presensi-panel-${pertemuanId}`);
    if (!panel) return;

    const records = Array.from(panel.querySelectorAll('.kelompok-presensi-status')).map(sel => {
        const nisn = sel.dataset.nisn;
        const catatan = panel.querySelector(`.kelompok-presensi-catatan[data-nisn="${nisn}"]`)?.value || '';
        return { nisn, status: sel.value, catatan };
    });

    const res = await parseApiData(await window.apiFetch(
        `kesantrian/pertemuan-pengasuhan/${pertemuanId}/presensi/`,
        {
            method: 'POST',
            body: JSON.stringify({ records })
        }
    ));

    if (res?.success) {
        await loadKelompokPresensi(pertemuanId);
        await loadKelompokPertemuanList(kelompokId);
        renderKelompokList();
    } else {
        alert(res?.message || 'Gagal menyimpan presensi.');
    }
}

async function tambahAnggotaKelompok(kelompokId, nisn) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/`,
        { method: 'POST', body: JSON.stringify({ nisn, is_ketua: false }) }
    ));
    if (res?.success) {
        await refreshKelompokData(kelompokId);
    } else {
        alert(res?.message || 'Gagal menambah anggota.');
    }
}

async function hapusAnggotaKelompok(kelompokId, nisn) {
    if (!confirm('Hapus anggota ini dari kelompok?')) return;
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/${nisn}/`,
        { method: 'DELETE' }
    ));
    if (res?.success) {
        await refreshKelompokData(kelompokId);
    } else {
        alert('Gagal menghapus anggota.');
    }
}

async function setKetuaKelompok(kelompokId, nisn, isKetua) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/kelompok-pengasuhan/${kelompokId}/anggota/${nisn}/set-ketua/`,
        { method: 'PATCH', body: JSON.stringify({ is_ketua: isKetua }) }
    ));
    if (res?.success) {
        await refreshKelompokData(kelompokId);
    } else {
        alert('Gagal mengupdate ketua.');
    }
}

async function hapusKelompok(kelompokId) {
    if (!confirm('Hapus kelompok ini beserta semua anggotanya?')) return;
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/kelompok-pengasuhan/${kelompokId}/`,
        { method: 'DELETE' }
    ));
    if (res?.success || res === null) {
        kelompokState.list = kelompokState.list.filter(k => k.id !== kelompokId);
        if (kelompokState.expandedId === kelompokId) kelompokState.expandedId = null;
        renderKelompokList();
    } else {
        alert('Gagal menghapus kelompok.');
    }
}

async function refreshKelompokData(kelompokId) {
    const res = await parseApiData(await window.apiFetch(
        `kesantrian/kelompok-pengasuhan/${kelompokId}/`
    ));
    if (res?.success && res.data) {
        const idx = kelompokState.list.findIndex(k => k.id === kelompokId);
        if (idx !== -1) kelompokState.list[idx] = res.data;
    } else {
        const all = await parseApiData(await window.apiFetch('kesantrian/kelompok-pengasuhan/'));
        if (all?.data) kelompokState.list = all.data;
    }
    renderKelompokList();
}

function bukaModalKelompok(id = null) {
    const modal = document.getElementById('modal-kelompok');
    const title = document.getElementById('modal-kelompok-title');
    const namaInput = document.getElementById('input-kelompok-nama');
    const pengasuhSelect = document.getElementById('input-kelompok-musyrif');
    if (!modal || !title || !namaInput || !pengasuhSelect) return;

    kelompokState.editingId = id;
    pengasuhSelect.innerHTML = '<option value="">-- Pilih Pengasuh --</option>';
    kelompokState.guruList.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name || g.username;
        pengasuhSelect.appendChild(opt);
    });

    if (id) {
        const k = kelompokState.list.find(x => x.id === id);
        if (!k) return;
        title.textContent = 'Edit Kelompok';
        namaInput.value = k.nama;
        pengasuhSelect.value = k.pengasuh || '';
    } else {
        title.textContent = 'Buat Kelompok';
        namaInput.value = '';
        pengasuhSelect.value = '';
    }

    modal.style.display = 'flex';

    const cancelBtn = document.getElementById('btn-modal-kelompok-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }

    const saveBtn = document.getElementById('btn-modal-kelompok-save');
    if (saveBtn) {
        saveBtn.onclick = saveKelompok;
    }
}

async function saveKelompok() {
    const modal = document.getElementById('modal-kelompok');
    const nama = document.getElementById('input-kelompok-nama')?.value?.trim();
    const pengasuhId = document.getElementById('input-kelompok-musyrif')?.value;
    if (!nama) { alert('Nama kelompok wajib diisi.'); return; }

    const kelompokId = kelompokState.editingId;
    const url = kelompokId
        ? `kesantrian/kelompok-pengasuhan/${kelompokId}/`
        : 'kesantrian/kelompok-pengasuhan/';
    const method = kelompokId ? 'PATCH' : 'POST';
    const res = await parseApiData(await window.apiFetch(url, {
        method,
        body: JSON.stringify({
            nama,
            pengasuh_id: pengasuhId || null,
            kelas: ''
        })
    }));

    if (res?.success) {
        if (modal) modal.style.display = 'none';
        await loadKelompokTab();
    } else {
        alert(res?.message || 'Gagal menyimpan kelompok.');
    }
}

function setupKelompokSearch() {
    const input = document.getElementById('kelompok-santri-search');
    const result = document.getElementById('kelompok-santri-search-result');
    if (!input || !result) return;

    input.oninput = () => {
        const q = input.value.toLowerCase().trim();
        if (!q) { result.style.display = 'none'; return; }

        const found = [];
        kelompokState.list.forEach(k => {
            (k.anggota_list || []).forEach(a => {
                if ((a.nama || '').toLowerCase().includes(q) || String(a.nisn || '').includes(q)) {
                    found.push({ santri: a, kelompok: k });
                }
            });
        });

        const assignedNisns = new Set();
        kelompokState.list.forEach(k => {
            (k.anggota_list || []).forEach(a => assignedNisns.add(a.nisn));
        });
        kelompokState.allStudents
            .filter(s => !assignedNisns.has(s.nisn) &&
                ((s.nama || '').toLowerCase().includes(q) || String(s.nisn || '').includes(q)))
            .forEach(s => found.push({ santri: s, kelompok: null }));

        if (found.length === 0) {
            result.style.display = 'block';
            result.innerHTML = '<span style="color:#9ca3af;">Santri tidak ditemukan.</span>';
            return;
        }

        result.style.display = 'block';
        result.innerHTML = found.slice(0, 8).map(f => `
            <div style="padding:6px 0;border-bottom:1px solid #f3f4f6;
                        display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:13px;font-weight:500;color:#111827;">
                        ${f.santri.nama}
                    </span>
                    <span style="font-size:11px;color:#9ca3af;margin-left:6px;">
                        ${f.santri.kelas} &middot; ${f.santri.nisn}
                    </span>
                </div>
                <div style="font-size:12px;">
                    ${f.kelompok
                        ? `<span style="color:#1d9e75;font-weight:500;">
                               ${f.kelompok.nama}
                           </span>
                           <span style="color:#9ca3af;font-size:11px;">
                               (${f.kelompok.pengasuh_name || '-'})
                           </span>`
                        : '<span style="color:#f59e0b;">Belum ada kelompok</span>'
                    }
                </div>
            </div>
        `).join('');
    };
}

async function fetchKehadiranKajian(nisn, bulan = '') {
    if (!nisn) return;
    try {
        const query = bulan ? `?bulan=${bulan}` : '';
        const res = await window.apiFetch(`kesantrian/hafalan/siswa/${nisn}/kehadiran-kajian/${query}`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        if (!d.success) return;

        hafalanData.kehadiran = {
            hadir: d.summary.hadir,
            izin: d.summary.izin,
            sakit: d.summary.sakit,
            alfa: d.summary.alfa,
            total_hari: d.summary.hadir + d.summary.izin + d.summary.sakit + d.summary.alfa,
        };
        renderKehadiranSection();
        renderKajianRiwayat(d.history || []);
    } catch (e) {
        console.warn('[hafalan] gagal fetch kehadiran kajian:', e);
    }
}

const STATUS_LABEL = {
    hadir: { text: 'Hadir', color: '#1d9e75' },
    izin: { text: 'Izin', color: '#f59e0b' },
    sakit: { text: 'Sakit', color: '#3b82f6' },
    tidak_hadir: { text: 'Alpa', color: '#ef4444' },
};

function renderKajianRiwayat(history) {
    const section = document.getElementById('kajian-riwayat-section');
    const listEl = document.getElementById('kajian-riwayat-list');
    if (!section || !listEl) return;

    if (history.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    listEl.innerHTML = history.map(h => {
        const s = STATUS_LABEL[h.status] || { text: h.status, color: '#6b7280' };
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:9px 0;border-bottom:1px solid #f3f4f6;">
            <div>
                <div style="font-weight:500;color:#111827;">${h.judul}</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">
                    ${h.tanggal} &nbsp;·&nbsp; ${h.kelompok_nama}
                    ${h.lokasi ? '&nbsp;·&nbsp; ' + h.lokasi : ''}
                </div>
            </div>
            <span style="font-size:12px;font-weight:600;color:${s.color};
                         background:${s.color}18;padding:3px 10px;
                         border-radius:20px;white-space:nowrap;">
                ${s.text}
            </span>
        </div>`;
    }).join('');
}

async function loadKajianTab() {
    const container = document.getElementById('kajian-pertemuan-list');
    const infoEl = document.getElementById('kajian-kelompok-info');

    try {
        const res = await window.apiFetch('kesantrian/kelompok-pengasuhan/');
        const d = typeof res?.json === 'function' ? await res.json() : res;
        const list = d.data || [];
        kajianState.kelompok = list.length > 0 ? list[0] : null;
    } catch (e) {
        if (container) container.innerHTML =
            '<p style="color:#ef4444;text-align:center;padding:32px;">Gagal memuat kelompok.</p>';
        return;
    }

    if (!kajianState.kelompok) {
        if (infoEl) infoEl.style.display = 'none';
        if (container) container.innerHTML =
            '<p style="color:#9ca3af;text-align:center;padding:32px 0;">Kamu belum memiliki kelompok kajian.</p>';
        return;
    }

    if (infoEl) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `<strong>Kelompok:</strong> ${kajianState.kelompok.nama}
            &nbsp;·&nbsp; <strong>Anggota:</strong> ${kajianState.kelompok.jumlah_santri} santri`;
    }

    try {
        const res2 = await window.apiFetch(`kesantrian/kelompok-pengasuhan/${kajianState.kelompok.id}/anggota/`);
        const d2 = typeof res2?.json === 'function' ? await res2.json() : res2;
        kajianState.anggotaList = d2.data || [];
    } catch (e) {
        kajianState.anggotaList = [];
    }

    try {
        const res3 = await window.apiFetch('kesantrian/pertemuan-pengasuhan/');
        const d3 = typeof res3?.json === 'function' ? await res3.json() : res3;
        kajianState.pertemuanList = d3.data || [];
    } catch (e) {
        if (container) container.innerHTML =
            '<p style="color:#ef4444;text-align:center;padding:32px;">Gagal memuat pertemuan.</p>';
        return;
    }

    renderPertemuanList();
    wireKajianModal();
}

function renderPertemuanList() {
    const container = document.getElementById('kajian-pertemuan-list');
    if (!container) return;
    const list = kajianState.pertemuanList;

    if (list.length === 0) {
        container.innerHTML =
            '<p style="color:#9ca3af;text-align:center;padding:32px 0;">Belum ada pertemuan. Klik "+ Tambah Pertemuan" untuk mulai.</p>';
        return;
    }

    container.innerHTML = list.map(p => `
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;
                    margin-bottom:12px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:16px 20px;cursor:pointer;"
                 data-pertemuan-id="${p.id}">
                <div>
                    <div style="font-size:14px;font-weight:600;color:#111827;">${p.judul}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                        ${p.tanggal} &nbsp;·&nbsp; ${p.lokasi}
                        &nbsp;·&nbsp;
                        <span style="color:#1d9e75;font-weight:500;">
                            ${p.jumlah_hadir} hadir
                        </span>
                        dari ${kajianState.anggotaList.length} santri
                    </div>
                </div>
                <span style="font-size:11px;color:#9ca3af;">▼ Presensi</span>
            </div>
            <div id="presensi-panel-${p.id}"
                 style="display:none;border-top:1px solid #f3f4f6;
                        padding:16px 20px;background:#fafafa;">
                <div id="presensi-form-${p.id}">
                    <p style="color:#9ca3af;font-size:12px;">Memuat presensi...</p>
                </div>
                <div style="margin-top:14px;text-align:right;">
                    <button class="btn-simpan-presensi" data-id="${p.id}"
                            style="background:#1d9e75;color:#fff;border:none;
                                   border-radius:8px;padding:8px 18px;font-size:13px;
                                   font-weight:500;cursor:pointer;">
                        Simpan Presensi
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('[data-pertemuan-id]').forEach(el => {
        el.onclick = () => togglePresensiPanel(el.dataset.pertemuanId);
    });

    container.querySelectorAll('.btn-simpan-presensi').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            simpanPresensi(btn.dataset.id);
        };
    });
}

async function togglePresensiPanel(pertemuanId) {
    const panel = document.getElementById(`presensi-panel-${pertemuanId}`);
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        await loadPresensiForm(pertemuanId);
    }
}

async function loadPresensiForm(pertemuanId) {
    const formEl = document.getElementById(`presensi-form-${pertemuanId}`);
    if (!formEl) return;

    const existing = {};
    try {
        const res = await window.apiFetch(`kesantrian/pertemuan-pengasuhan/${pertemuanId}/presensi/`);
        const d = typeof res?.json === 'function' ? await res.json() : res;
        (d.data || []).forEach(p => { existing[p.santri_nisn] = p.status; });
    } catch (e) { /* pakai default */ }

    const STATUS_OPTIONS = [
        { value: 'hadir', label: 'Hadir', color: '#1d9e75' },
        { value: 'izin', label: 'Izin', color: '#f59e0b' },
        { value: 'sakit', label: 'Sakit', color: '#3b82f6' },
        { value: 'tidak_hadir', label: 'Alpa', color: '#ef4444' },
    ];

    if (kajianState.anggotaList.length === 0) {
        formEl.innerHTML =
            '<p style="color:#9ca3af;font-size:12px;">Belum ada anggota di kelompok ini.</p>';
        return;
    }

    formEl.innerHTML = kajianState.anggotaList.map(a => {
        const currentStatus = existing[a.nisn] || 'hadir';
        const opts = STATUS_OPTIONS.map(s =>
            `<option value="${s.value}" ${currentStatus === s.value ? 'selected' : ''}>
                ${s.label}
             </option>`
        ).join('');
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;
                        padding:8px 0;border-bottom:1px solid #f3f4f6;">
                <div>
                    <span style="font-size:13px;color:#111827;font-weight:500;">
                        ${a.nama}
                    </span>
                    <span style="font-size:11px;color:#9ca3af;margin-left:8px;">
                        ${a.kelas}
                    </span>
                </div>
                <select data-nisn="${a.nisn}"
                        style="padding:5px 10px;border:1px solid #d1d5db;
                               border-radius:6px;font-size:12px;outline:none;
                               background:#fff;cursor:pointer;">
                    ${opts}
                </select>
            </div>`;
    }).join('');
}

async function simpanPresensi(pertemuanId, kelompokId = null) {
    if (kelompokId) {
        await simpanPresensiKelompok(pertemuanId, kelompokId);
        return;
    }

    const formEl = document.getElementById(`presensi-form-${pertemuanId}`);
    if (!formEl) return;

    const selects = formEl.querySelectorAll('select[data-nisn]');
    const presensi = Array.from(selects).map(sel => ({
        nisn: sel.dataset.nisn,
        status: sel.value,
        catatan: ''
    }));

    try {
        await window.apiFetch(`kesantrian/pertemuan-pengasuhan/${pertemuanId}/presensi/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presensi })
        });
        const hadir = presensi.filter(p => p.status === 'hadir').length;
        const p = kajianState.pertemuanList.find(x => x.id == pertemuanId);
        if (p) p.jumlah_hadir = hadir;
        const panel = document.getElementById(`presensi-panel-${pertemuanId}`);
        if (panel) {
            const card = panel.closest('[style*="border-radius:12px"]');
            if (card) {
                const hadirSpan = card.querySelector('span[style*="1d9e75"]');
                if (hadirSpan) hadirSpan.textContent = `${hadir} hadir`;
            }
        }
        alert('Presensi berhasil disimpan.');
    } catch (e) {
        alert('Gagal menyimpan presensi.');
    }
}

function wireKajianModal() {
    const btnTambah = document.getElementById('btn-tambah-pertemuan');
    const modal = document.getElementById('modal-pertemuan');
    const btnSave = document.getElementById('btn-modal-pertemuan-save');
    const btnCancel = document.getElementById('btn-modal-pertemuan-cancel');

    if (btnTambah) {
        btnTambah.onclick = () => {
            document.getElementById('input-pertemuan-judul').value = '';
            document.getElementById('input-pertemuan-tanggal').value = '';
            document.getElementById('input-pertemuan-lokasi').value = '';
            if (modal) modal.style.display = 'flex';
        };
    }
    if (btnCancel && modal) {
        btnCancel.onclick = () => { modal.style.display = 'none'; };
    }
    if (btnSave) {
        btnSave.onclick = async () => {
            const judul = document.getElementById('input-pertemuan-judul')?.value?.trim();
            const tanggal = document.getElementById('input-pertemuan-tanggal')?.value;
            const lokasi = document.getElementById('input-pertemuan-lokasi')?.value?.trim();
            if (!judul || !tanggal) { alert('Judul dan tanggal wajib diisi.'); return; }
            if (!kajianState.kelompok) return;
            try {
                await window.apiFetch('kesantrian/pertemuan-pengasuhan/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        kelompok_id: kajianState.kelompok.id,
                        judul, tanggal, lokasi: lokasi || ''
                    })
                });
                if (modal) modal.style.display = 'none';
                await loadKajianTab();
            } catch (e) {
                alert('Gagal menyimpan pertemuan.');
            }
        };
    }
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

document.addEventListener('DOMContentLoaded', async function() {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Hafalan] Admin page detected, skipping init');
        return;
    }
    await initHafalan();
});
