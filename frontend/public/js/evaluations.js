/**
 * ============================================
 * EVALUATIONS.JS - Behavioral Analytics
 * Portal Ponpes Baron
 * Baron Light Emerald Theme
 * ============================================
 */

// State Management
let currentEvaluations = [];
let currentPage = 1;
let totalPages = 1;
let totalCount = 0;
let searchTimeout = null;
let editingEvaluation = null;
let currentUser = null;
let categoryChart = null;
let comparisonChart = null;
let trendChart = null;
let allStudents = [];
let currentWizardStep = 1;

// Category Icons
const KATEGORI_ICONS = {
    'adab': '🤲',
    'kedisiplinan': '⏰',
    'akademik': '📚',
    'kebersihan': '🧹',
    'hafalan': '📖',
    'sosial': '🤝'
};

// Baron Light Emerald Theme Colors
const BARON_CHART_COLORS = {
    emerald: '#1fa87a',
    emeraldLight: '#34c99a',
    gold: '#c8961c',
    goldLight: '#f0bf4c',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    rose: '#f43f5e',
    cyan: '#22d3ee',
    bgCard: '#ffffff',
    textMain: '#0a2e20',
    textSub: '#3d6b57',
    textMuted: '#7aaa94',
    borderLight: 'rgba(15, 99, 71, 0.12)'
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    loadFilters();
    setupEventListeners();
    setupEventDelegation();
    setupWizardEvents();
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadEvaluations(1), 500);
        });
    }

    ['filter-type', 'filter-class', 'filter-kategori'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => loadEvaluations(1));
    });

    const evaluationForm = document.getElementById('evaluation-form');
    if (evaluationForm) {
        evaluationForm.addEventListener('submit', handleFormSubmit);
    }

    const photoInput = document.getElementById('evaluation-photo');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoPreview);
    }

    // Listen for child switch events (multi-child walisantri)
    window.addEventListener('childSwitched', function(e) {
        const { nisn } = e.detail;
        if (nisn && currentUser?.role === 'walisantri') {
            console.log('[Evaluations] Child switched to:', nisn);
            // Reload BLP and evaluations for the new child
            loadWalisantriView();
        }
    });
}

function setupEventDelegation() {
    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const action = button.getAttribute('data-action');
        if (action === 'open-add-modal') {
            openAddModal();
        }
    });
}

function setupWizardEvents() {
    const wizardKelas = document.getElementById('wizard-kelas');
    if (wizardKelas) {
        wizardKelas.addEventListener('change', async function() {
            const kelas = this.value;
            const wizardSiswa = document.getElementById('wizard-siswa');
            const btnNext = document.getElementById('btn-step1-next');

            if (!kelas) {
                wizardSiswa.innerHTML = '<option value="">Pilih Kelas Dulu</option>';
                wizardSiswa.disabled = true;
                btnNext.disabled = true;
                return;
            }

            wizardSiswa.innerHTML = '<option value="">Loading...</option>';
            wizardSiswa.disabled = true;

            const students = allStudents.filter(s => s.kelas === kelas);
            wizardSiswa.innerHTML = '<option value="">Pilih Siswa</option>';
            students.forEach(s => {
                wizardSiswa.innerHTML += `<option value="${escapeAttr(s.nisn)}">${escapeHtml(s.nama)} (${escapeHtml(s.nisn)})</option>`;
            });
            wizardSiswa.disabled = false;
        });
    }

    const wizardSiswa = document.getElementById('wizard-siswa');
    if (wizardSiswa) {
        wizardSiswa.addEventListener('change', function() {
            document.getElementById('btn-step1-next').disabled = !this.value;
        });
    }

    document.querySelectorAll('input[name="wizard-jenis"]').forEach(radio => {
        radio.addEventListener('change', validateStep2);
    });
    document.querySelectorAll('input[name="wizard-kategori"]').forEach(radio => {
        radio.addEventListener('change', validateStep2);
    });
}

function validateStep2() {
    const jenis = document.querySelector('input[name="wizard-jenis"]:checked');
    const kategori = document.querySelector('input[name="wizard-kategori"]:checked');
    document.getElementById('btn-step2-next').disabled = !(jenis && kategori);
}

// ============================================
// USER & VIEW MANAGEMENT
// ============================================

async function loadCurrentUser() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        const response = await fetch(`/api/users/me/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load user');

        currentUser = await response.json();
        console.log('[Evaluations] Current user:', currentUser);

        // Update user display - prefer name for walisantri
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay) {
            userNameDisplay.textContent = currentUser.name || currentUser.username || 'User';
        }

        // Store user in localStorage for sidebar consistency
        localStorage.setItem('user', JSON.stringify(currentUser));

        initializeViews();
    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Gagal memuat data pengguna', 'error');
    }
}

function initializeViews() {
    const role = currentUser.role;
    if (role === 'walisantri') {
        switchView('walisantri');
    } else {
        switchView('admin');
    }
}

function switchView(view) {
    const adminView = document.getElementById('admin-view');
    const walisantriView = document.getElementById('walisantri-view');

    if (view === 'walisantri') {
        if (adminView) adminView.style.display = 'none';
        if (walisantriView) walisantriView.style.display = 'block';
        loadWalisantriView();
    } else {
        if (adminView) adminView.style.display = 'block';
        if (walisantriView) walisantriView.style.display = 'none';
        loadEvaluations(1);
        loadStatistics();
    }
}

// ============================================
// FILTERS
// ============================================

async function loadFilters() {
    try {
        const token = localStorage.getItem('access_token');

        const classResponse = await fetch(`/api/students/classes/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (classResponse.ok) {
            const data = await classResponse.json();
            if (data.success && data.classes) {
                const classSelect = document.getElementById('filter-class');
                const wizardKelas = document.getElementById('wizard-kelas');

                if (classSelect) {
                    classSelect.innerHTML = '<option value="">Semua Kelas</option>';
                    data.classes.forEach(cls => {
                        classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
                    });
                }

                if (wizardKelas) {
                    wizardKelas.innerHTML = '<option value="">Pilih Kelas</option>';
                    data.classes.forEach(cls => {
                        wizardKelas.innerHTML += `<option value="${cls}">${cls}</option>`;
                    });
                }
            }
        }

        const studentsResponse = await fetch(`/api/students/?page_size=1000`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (studentsResponse.ok) {
            const data = await studentsResponse.json();
            allStudents = data.results || [];
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

function resetFilters() {
    ['search-input', 'filter-type', 'filter-class', 'filter-kategori'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    loadEvaluations(1);
}

function updateActiveFiltersDisplay(search, jenis, kelas, kategori) {
    const container = document.getElementById('active-filters');
    if (!container) return;

    const filters = [];
    if (search) filters.push(`Pencarian: "${search}"`);
    if (kelas) filters.push(`Kelas: ${kelas}`);
    if (jenis) filters.push(`Jenis: ${jenis === 'prestasi' ? 'Prestasi' : 'Pelanggaran'}`);
    if (kategori) filters.push(`Kategori: ${kategori.charAt(0).toUpperCase() + kategori.slice(1)}`);

    if (filters.length === 0) {
        container.style.display = 'none';
    } else {
        container.style.display = 'flex';
        container.innerHTML = `
            <span class="filter-label">Filter Aktif:</span>
            ${filters.map(f => `<span class="filter-tag">${escapeHtml(f)}</span>`).join('')}
            <button onclick="window.resetFilters()" class="filter-clear-btn">Hapus Semua</button>
        `;
    }
}

// ============================================
// STATISTICS & CHARTS
// ============================================

async function loadStatistics() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/evaluations/statistics/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load statistics');

        const data = await response.json();

        if (data.success) {
            const stats = data.statistics;
            animateValue('total-evaluations', stats.total_evaluations);
            animateValue('total-prestasi', stats.total_prestasi);
            animateValue('total-pelanggaran', stats.total_pelanggaran);
            animateValue('evaluations-this-month', stats.evaluations_this_month);

            // Update top kategori
            const topKategori = findTopCategory(stats.by_category || {});
            const topKategoriEl = document.getElementById('top-kategori');
            if (topKategoriEl) {
                topKategoriEl.textContent = topKategori ? `${KATEGORI_ICONS[topKategori] || ''} ${topKategori}` : '-';
            }

            // Render charts
            renderCategoryChart(stats.by_category || {});
            renderComparisonChart(stats.prestasi_by_category || {}, stats.pelanggaran_by_category || {});
            renderTrendChart(stats.monthly_trend || []);
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

function findTopCategory(categoryStats) {
    let maxCount = 0;
    let topCategory = null;

    for (const [category, count] of Object.entries(categoryStats)) {
        if (count > maxCount) {
            maxCount = count;
            topCategory = category;
        }
    }

    return topCategory;
}

function renderCategoryChart(categoryStats) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (categoryChart) categoryChart.destroy();

    const labels = ['Adab', 'Kedisiplinan', 'Akademik', 'Kebersihan', 'Hafalan', 'Sosial'];
    const data = [
        categoryStats.adab || 0,
        categoryStats.kedisiplinan || 0,
        categoryStats.akademik || 0,
        categoryStats.kebersihan || 0,
        categoryStats.hafalan || 0,
        categoryStats.sosial || 0
    ];

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    BARON_CHART_COLORS.emerald,
                    BARON_CHART_COLORS.gold,
                    BARON_CHART_COLORS.blue,
                    BARON_CHART_COLORS.purple,
                    BARON_CHART_COLORS.rose,
                    BARON_CHART_COLORS.cyan
                ],
                borderColor: BARON_CHART_COLORS.bgCard,
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: BARON_CHART_COLORS.textSub,
                        padding: 12,
                        font: { size: 12, weight: '600', family: "'Plus Jakarta Sans', sans-serif" },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    titleFont: { size: 14, weight: '700' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });
}

function renderComparisonChart(prestasiData, pelanggaranData) {
    const ctx = document.getElementById('comparisonChart');
    if (!ctx) return;

    if (comparisonChart) comparisonChart.destroy();

    const labels = ['Adab', 'Kedisiplinan', 'Akademik', 'Kebersihan', 'Hafalan', 'Sosial'];

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Prestasi',
                    data: [
                        prestasiData.adab || 0,
                        prestasiData.kedisiplinan || 0,
                        prestasiData.akademik || 0,
                        prestasiData.kebersihan || 0,
                        prestasiData.hafalan || 0,
                        prestasiData.sosial || 0
                    ],
                    backgroundColor: BARON_CHART_COLORS.emerald,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Pelanggaran',
                    data: [
                        pelanggaranData.adab || 0,
                        pelanggaranData.kedisiplinan || 0,
                        pelanggaranData.akademik || 0,
                        pelanggaranData.kebersihan || 0,
                        pelanggaranData.hafalan || 0,
                        pelanggaranData.sosial || 0
                    ],
                    backgroundColor: BARON_CHART_COLORS.rose,
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: BARON_CHART_COLORS.textSub,
                        font: { size: 12, weight: '600', family: "'Plus Jakarta Sans', sans-serif" },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    ticks: { color: BARON_CHART_COLORS.textMuted, font: { size: 11 } },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: BARON_CHART_COLORS.textMuted, font: { family: "'DM Mono', monospace" } },
                    grid: { color: BARON_CHART_COLORS.borderLight },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderTrendChart(monthlyData) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChart) trendChart.destroy();

    // Default data if API doesn't provide monthly trend
    const defaultMonths = ['Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb'];
    const defaultPrestasi = [12, 15, 18, 14, 20, 22];
    const defaultPelanggaran = [8, 6, 5, 7, 4, 3];

    const labels = monthlyData.length > 0 ? monthlyData.map(m => m.month) : defaultMonths;
    const prestasiValues = monthlyData.length > 0 ? monthlyData.map(m => m.prestasi || 0) : defaultPrestasi;
    const pelanggaranValues = monthlyData.length > 0 ? monthlyData.map(m => m.pelanggaran || 0) : defaultPelanggaran;

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Prestasi',
                    data: prestasiValues,
                    borderColor: BARON_CHART_COLORS.emerald,
                    backgroundColor: 'rgba(31, 168, 122, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: BARON_CHART_COLORS.emerald,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                },
                {
                    label: 'Pelanggaran',
                    data: pelanggaranValues,
                    borderColor: BARON_CHART_COLORS.rose,
                    backgroundColor: 'rgba(244, 63, 94, 0.08)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: BARON_CHART_COLORS.rose,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
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
                        color: BARON_CHART_COLORS.textSub,
                        padding: 15,
                        usePointStyle: true,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 46, 32, 0.95)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.parsed.y} catatan`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: BARON_CHART_COLORS.borderLight },
                    ticks: { color: BARON_CHART_COLORS.textMuted }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: BARON_CHART_COLORS.borderLight },
                    ticks: { color: BARON_CHART_COLORS.textMuted, font: { family: "'DM Mono', monospace" } }
                }
            }
        }
    });
}

// ============================================
// EVALUATIONS DATA
// ============================================

async function loadEvaluations(page = 1) {
    currentPage = page;

    const search = document.getElementById('search-input')?.value.trim() || '';
    const jenis = document.getElementById('filter-type')?.value || '';
    const kelas = document.getElementById('filter-class')?.value || '';
    const kategori = document.getElementById('filter-kategori')?.value || '';

    let url = `/api/evaluations/?page=${page}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (jenis) url += `&jenis=${encodeURIComponent(jenis)}`;
    if (kelas) url += `&kelas=${encodeURIComponent(kelas)}`;
    if (kategori) url += `&kategori=${encodeURIComponent(kategori)}`;

    updateActiveFiltersDisplay(search, jenis, kelas, kategori);

    try {
        const tbody = document.getElementById('evaluations-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center"><div class="loading-spinner"></div></td></tr>`;
        }

        const token = localStorage.getItem('access_token');
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load evaluations');

        const data = await response.json();

        if (data.results) {
            currentEvaluations = data.results;
            totalCount = data.count;
            totalPages = Math.ceil(data.count / 25);
            renderEvaluationsTable();
            updatePagination();
        } else {
            currentEvaluations = [];
            renderEvaluationsTable();
        }
    } catch (error) {
        console.error('Error loading evaluations:', error);
        const tbody = document.getElementById('evaluations-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center">Error loading data</td></tr>`;
        }
        showToast('Gagal memuat evaluasi', 'error');
    }
}

function renderEvaluationsTable() {
    const tbody = document.getElementById('evaluations-table-body');
    if (!tbody) return;

    // Update filtered count
    const filteredCountEl = document.getElementById('filtered-count');
    const totalCountEl = document.getElementById('total-count');
    if (filteredCountEl) filteredCountEl.textContent = currentEvaluations.length;
    if (totalCountEl) totalCountEl.textContent = totalCount;

    if (!currentEvaluations || currentEvaluations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center"><div class="loading">Tidak ada data evaluasi</div></td></tr>`;
        return;
    }

    tbody.innerHTML = currentEvaluations.map((eval, index) => {
        // Updated badge classes: badge-pass for prestasi, badge-fail for pelanggaran
        const jenisBadge = eval.jenis === 'prestasi'
            ? '<span class="badge badge-pass">Prestasi</span>'
            : '<span class="badge badge-fail">Pelanggaran</span>';

        const kategoriIcon = KATEGORI_ICONS[eval.kategori] || '';
        const kategoriBadge = `<span class="badge badge-kategori">${kategoriIcon} ${escapeHtml(eval.kategori || '-')}</span>`;

        const date = eval.tanggal ? new Date(eval.tanggal).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) : '-';

        const safeId = escapeAttr(eval.id);

        // New column order: No, Tanggal, Kategori, Nama Siswa, Kelas, Deskripsi, Jenis, Aksi
        return `
            <tr data-id="${safeId}">
                <td>${(currentPage - 1) * 25 + index + 1}</td>
                <td><span style="font-family: var(--font-mono);">${escapeHtml(date)}</span></td>
                <td>${kategoriBadge}</td>
                <td><strong>${escapeHtml(eval.nisn_nama || '-')}</strong></td>
                <td>${escapeHtml(eval.nisn_kelas || '-')}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(eval.name || '')}">${escapeHtml(eval.name) || '-'}</td>
                <td>${jenisBadge}</td>
                <td>
                    <button onclick="window.viewEvaluation('${safeId}')" class="action-btn action-view" title="Lihat">👁️</button>
                    <button onclick="window.editEvaluation('${safeId}')" class="action-btn action-edit" title="Edit">✏️</button>
                    <button onclick="window.deleteEvaluation('${safeId}')" class="action-btn action-delete" title="Hapus">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination() {
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
}

function loadPreviousPage() {
    if (currentPage > 1) loadEvaluations(currentPage - 1);
}

function loadNextPage() {
    if (currentPage < totalPages) loadEvaluations(currentPage + 1);
}

// ============================================
// WIZARD MODAL FUNCTIONS
// ============================================

async function openAddModal() {
    editingEvaluation = null;
    document.getElementById('modal-title').textContent = 'Tambah Evaluasi';

    currentWizardStep = 1;
    goToWizardStep(1);

    const form = document.getElementById('evaluation-form');
    if (form) form.reset();

    document.getElementById('wizard-kelas').value = '';
    document.getElementById('wizard-siswa').innerHTML = '<option value="">Pilih Kelas Dulu</option>';
    document.getElementById('wizard-siswa').disabled = true;
    document.querySelectorAll('input[name="wizard-jenis"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="wizard-kategori"]').forEach(r => r.checked = false);
    document.getElementById('btn-step1-next').disabled = true;
    document.getElementById('btn-step2-next').disabled = true;

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('evaluation-date');
    if (dateInput) dateInput.value = today;

    const previewDiv = document.getElementById('photo-preview');
    if (previewDiv) previewDiv.style.display = 'none';

    document.getElementById('evaluation-modal').classList.add('active');
}

function goToWizardStep(step) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`wizard-step-dot-${i}`);
        const panel = document.getElementById(`wizard-step-${i}`);

        if (dot) {
            dot.classList.remove('active', 'completed');
            if (i < step) dot.classList.add('completed');
            if (i === step) dot.classList.add('active');
        }

        if (panel) {
            panel.style.display = i === step ? 'block' : 'none';
            panel.classList.toggle('active', i === step);
        }
    }

    currentWizardStep = step;

    if (step === 3) {
        const siswaSelect = document.getElementById('wizard-siswa');
        const siswaText = siswaSelect.options[siswaSelect.selectedIndex]?.text || '-';
        const jenis = document.querySelector('input[name="wizard-jenis"]:checked')?.value || '-';
        const kategori = document.querySelector('input[name="wizard-kategori"]:checked')?.value || '-';

        document.getElementById('step-siswa-info').textContent = siswaText;
        document.getElementById('step-jenis-info').textContent = jenis === 'prestasi' ? '🏆 Prestasi' : '⚠️ Pelanggaran';
        document.getElementById('step-kategori-info').textContent = `${KATEGORI_ICONS[kategori] || ''} ${kategori}`;

        document.getElementById('evaluation-nisn').value = siswaSelect.value;
        document.getElementById('evaluation-jenis').value = jenis;
        document.getElementById('evaluation-kategori').value = kategori;
    }
}

async function editEvaluation(id) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/evaluations/${id}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load evaluation');

        editingEvaluation = await response.json();

        document.getElementById('modal-title').textContent = 'Edit Evaluasi';

        currentWizardStep = 3;
        goToWizardStep(3);

        document.getElementById('step-siswa-info').textContent = editingEvaluation.nisn_nama || editingEvaluation.nisn;
        document.getElementById('step-jenis-info').textContent = editingEvaluation.jenis === 'prestasi' ? '🏆 Prestasi' : '⚠️ Pelanggaran';
        document.getElementById('step-kategori-info').textContent = `${KATEGORI_ICONS[editingEvaluation.kategori] || ''} ${editingEvaluation.kategori || '-'}`;

        document.getElementById('evaluation-id').value = editingEvaluation.id;
        document.getElementById('evaluation-nisn').value = editingEvaluation.nisn;
        document.getElementById('evaluation-jenis').value = editingEvaluation.jenis;
        document.getElementById('evaluation-kategori').value = editingEvaluation.kategori || 'adab';
        document.getElementById('evaluation-name').value = editingEvaluation.name || '';
        document.getElementById('evaluation-date').value = editingEvaluation.tanggal || '';
        document.getElementById('evaluation-summary').value = editingEvaluation.summary || '';
        document.getElementById('evaluation-note').value = editingEvaluation.catatan || '';

        const previewDiv = document.getElementById('photo-preview');
        const previewImg = document.getElementById('preview-img');
        if (editingEvaluation.photo) {
            previewImg.src = editingEvaluation.photo;
            previewDiv.style.display = 'flex';
        } else {
            previewDiv.style.display = 'none';
        }

        document.getElementById('evaluation-modal').classList.add('active');
    } catch (error) {
        console.error('Error loading evaluation:', error);
        showToast('Gagal memuat data evaluasi', 'error');
    }
}

function closeModal() {
    document.getElementById('evaluation-modal').classList.remove('active');
    editingEvaluation = null;
}

function handlePhotoPreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('preview-img').src = event.target.result;
            document.getElementById('photo-preview').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

function removePhoto() {
    document.getElementById('evaluation-photo').value = '';
    document.getElementById('preview-img').src = '';
    document.getElementById('photo-preview').style.display = 'none';
}

// Flag to prevent double submission
let isSubmitting = false;

async function handleFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();

    // ==========================================
    // DEBOUNCE: Prevent double submission
    // ==========================================
    if (isSubmitting) {
        console.warn('[Evaluasi] Submission already in progress, ignoring...');
        return;
    }

    // Get submit button and disable it immediately
    const submitBtn = document.querySelector('#evaluation-form button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    // Lock submission
    isSubmitting = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-small"></span> Menyimpan...';
    }

    // Collect form values
    const nisn = document.getElementById('evaluation-nisn')?.value?.trim() || '';
    const jenis = document.getElementById('evaluation-jenis')?.value?.trim() || '';
    const kategori = document.getElementById('evaluation-kategori')?.value?.trim() || '';
    const name = document.getElementById('evaluation-name')?.value?.trim() || '';
    const tanggal = document.getElementById('evaluation-date')?.value?.trim() || '';
    const summary = document.getElementById('evaluation-summary')?.value?.trim() || '';
    const catatan = document.getElementById('evaluation-note')?.value?.trim() || '';

    // Debug: Log payload before sending
    console.log('[Evaluasi] Payload:', { nisn, jenis, kategori, name, tanggal, summary, catatan });

    // Frontend validation with specific messages
    const validationErrors = [];
    if (!nisn) validationErrors.push('NISN siswa belum dipilih');
    if (!jenis) validationErrors.push('Jenis evaluasi belum dipilih');
    if (!kategori) validationErrors.push('Kategori belum dipilih');
    if (!name) validationErrors.push('Nama evaluasi wajib diisi');
    if (!tanggal) validationErrors.push('Tanggal wajib diisi');
    if (!summary) validationErrors.push('Ringkasan wajib diisi');

    // Validate date format (YYYY-MM-DD)
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        validationErrors.push('Format tanggal tidak valid (harus YYYY-MM-DD)');
    }

    if (validationErrors.length > 0) {
        console.error('[Evaluasi] Validation errors:', validationErrors);
        showToast('Error: ' + validationErrors[0], 'error');
        // Re-enable button on validation error
        isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
        return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append('nisn', nisn);
    formData.append('jenis', jenis);
    formData.append('kategori', kategori);
    formData.append('name', name);
    formData.append('tanggal', tanggal);
    formData.append('summary', summary);
    formData.append('catatan', catatan);

    const photoInput = document.getElementById('evaluation-photo');
    if (photoInput && photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }

    try {
        const token = localStorage.getItem('access_token');
        let response;

        if (editingEvaluation) {
            response = await fetch(`/api/evaluations/${editingEvaluation.id}/`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
        } else {
            response = await fetch(`/api/evaluations/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
        }

        const responseData = await response.json().catch(() => ({}));
        console.log('[Evaluasi] Response:', response.status, responseData);

        if (!response.ok) {
            // Parse specific field errors from backend
            let errorMessage = 'Gagal menyimpan evaluasi';
            if (responseData.errors) {
                const fieldErrors = Object.entries(responseData.errors)
                    .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                    .join('; ');
                errorMessage = fieldErrors;
            } else if (responseData.message) {
                errorMessage = responseData.message;
            } else if (responseData.detail) {
                errorMessage = responseData.detail;
            }
            throw new Error(errorMessage);
        }

        // ==========================================
        // SUCCESS: Reset form, close modal, refresh data
        // ==========================================
        showToast(editingEvaluation ? 'Evaluasi berhasil diperbarui' : 'Evaluasi berhasil ditambahkan');

        // Reset form completely
        const form = document.getElementById('evaluation-form');
        if (form) form.reset();

        // Reset wizard state
        resetWizardState();

        // Close modal
        closeModal();

        // Refresh data
        loadEvaluations(currentPage);
        loadStatistics();

        // Reset editing state
        editingEvaluation = null;

    } catch (error) {
        console.error('[Evaluasi] Error:', error);
        showToast(error.message, 'error');
    } finally {
        // ==========================================
        // ALWAYS: Re-enable button after completion
        // ==========================================
        isSubmitting = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

/**
 * Reset wizard to initial state
 */
function resetWizardState() {
    currentWizardStep = 1;

    // Reset Step 1
    const wizardKelas = document.getElementById('wizard-kelas');
    const wizardSiswa = document.getElementById('wizard-siswa');
    if (wizardKelas) wizardKelas.value = '';
    if (wizardSiswa) {
        wizardSiswa.innerHTML = '<option value="">Pilih Kelas Dulu</option>';
        wizardSiswa.disabled = true;
    }

    // Reset Step 2
    document.querySelectorAll('input[name="wizard-jenis"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="wizard-kategori"]').forEach(r => r.checked = false);

    // Reset buttons
    const btnStep1Next = document.getElementById('btn-step1-next');
    const btnStep2Next = document.getElementById('btn-step2-next');
    if (btnStep1Next) btnStep1Next.disabled = true;
    if (btnStep2Next) btnStep2Next.disabled = true;

    // Reset hidden fields
    const evalNisn = document.getElementById('evaluation-nisn');
    const evalJenis = document.getElementById('evaluation-jenis');
    const evalKategori = document.getElementById('evaluation-kategori');
    if (evalNisn) evalNisn.value = '';
    if (evalJenis) evalJenis.value = '';
    if (evalKategori) evalKategori.value = '';

    // Reset photo preview
    const previewDiv = document.getElementById('photo-preview');
    const photoInput = document.getElementById('evaluation-photo');
    if (previewDiv) previewDiv.style.display = 'none';
    if (photoInput) photoInput.value = '';
}

// ============================================
// VIEW & DELETE EVALUATION
// ============================================

async function viewEvaluation(id) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/evaluations/${id}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load evaluation');

        const evaluation = await response.json();

        const jenisBadge = evaluation.jenis === 'prestasi'
            ? '<span class="badge badge-pass">Prestasi</span>'
            : '<span class="badge badge-fail">Pelanggaran</span>';

        const kategoriIcon = KATEGORI_ICONS[evaluation.kategori] || '';

        const date = evaluation.tanggal ? new Date(evaluation.tanggal).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }) : '-';

        document.getElementById('view-modal-body').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Jenis</div>
                    <div class="detail-value">${jenisBadge}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Kategori</div>
                    <div class="detail-value">${kategoriIcon} ${escapeHtml(evaluation.kategori || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Tanggal</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${date}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">NISN</div>
                    <div class="detail-value" style="font-family: var(--font-mono);">${escapeHtml(evaluation.nisn_nisn || evaluation.nisn || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Nama Siswa</div>
                    <div class="detail-value">${escapeHtml(evaluation.nisn_nama || '-')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Kelas</div>
                    <div class="detail-value">${escapeHtml(evaluation.nisn_kelas || '-')}</div>
                </div>
            </div>
            <div class="detail-card" style="margin-top: 20px;">
                <div class="detail-label">Nama Evaluasi</div>
                <div class="detail-value" style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">${escapeHtml(evaluation.name || '-')}</div>
                <div class="detail-label">Ringkasan</div>
                <div class="detail-value" style="line-height: 1.7; margin-bottom: 16px;">${escapeHtml(evaluation.summary || '-')}</div>
                ${evaluation.catatan ? `
                    <div class="detail-label">Catatan</div>
                    <div class="detail-value" style="font-style: italic; color: var(--text-muted);">${escapeHtml(evaluation.catatan)}</div>
                ` : ''}
            </div>
            ${evaluation.evaluator ? `
                <div style="margin-top: 16px; padding: 12px 16px; background: var(--emerald-50); border-radius: var(--radius-sm);">
                    <div class="detail-label">Evaluator</div>
                    <div class="detail-value">${escapeHtml(evaluation.evaluator)}</div>
                </div>
            ` : ''}
            ${evaluation.photo ? `
                <div style="margin-top: 16px;">
                    <div class="detail-label">Bukti Foto</div>
                    <img src="${evaluation.photo}" alt="Bukti" style="max-width: 100%; max-height: 300px; border-radius: var(--radius-md); margin-top: 8px;">
                </div>
            ` : ''}
        `;

        document.getElementById('view-modal').classList.add('active');
    } catch (error) {
        console.error('Error viewing evaluation:', error);
        showToast('Gagal memuat detail evaluasi', 'error');
    }
}

function closeViewModal() {
    document.getElementById('view-modal').classList.remove('active');
}

async function deleteEvaluation(id) {
    const evalData = currentEvaluations.find(e => e.id == id);
    const nama = evalData ? evalData.nisn_nama || evalData.name || id : id;

    if (!confirm(`Apakah Anda yakin ingin menghapus evaluasi ini?\n\n"${nama}"`)) {
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/evaluations/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete evaluation');

        showToast('Evaluasi berhasil dihapus');
        loadEvaluations(currentPage);
        loadStatistics();
    } catch (error) {
        console.error('Error deleting evaluation:', error);
        showToast('Gagal menghapus evaluasi', 'error');
    }
}

// ============================================
// WALISANTRI VIEW
// ============================================

let blpRadarChart = null;

// BLP Core Indicators Mapping (25 indicators across 6 domains)
// Maps to actual database indicator_values keys from full 59-indicator system
const BLP_CORE_INDICATORS = {
    akhlak: {
        label: 'Akhlak & Adab',
        max: 25,
        indicators: [
            { code: 'sopan_santun', label: 'Sopan Santun' },
            { code: 'kejujuran', label: 'Kejujuran' },
            { code: 'rendah_hati', label: 'Rendah Hati (Tawadhu)' },
            { code: 'adab_makan', label: 'Adab Makan & Minum' },
            { code: 'adab_berbicara', label: 'Adab Berbicara' }
        ]
    },
    kedisiplinan: {
        label: 'Kedisiplinan',
        max: 20,
        indicators: [
            { code: 'tepat_waktu_sholat', label: 'Tepat Waktu Sholat' },
            { code: 'tepat_waktu_kelas', label: 'Tepat Waktu Kelas' },
            { code: 'kebersihan_diri', label: 'Kebersihan Diri' },
            { code: 'jam_malam', label: 'Kepatuhan Jam Malam' }
        ]
    },
    ibadah: {
        label: 'Ibadah & Spiritual',
        max: 30,
        indicators: [
            // Using actual database keys from full system
            { code: 'sholat_subuh', label: 'Sholat Subuh Berjamaah' },
            { code: 'sholat_dhuha', label: 'Sholat Dhuha' },
            { code: 'sholat_tahajud', label: 'Sholat Tahajud' },
            { code: 'tilawah_harian', label: 'Tilawah Al-Quran' },
            { code: 'dzikir_pagi', label: 'Dzikir Pagi' },
            { code: 'khusyuk_sholat', label: 'Kekhusyukan Sholat' }
        ]
    },
    akademik: {
        label: 'Akademik Keagamaan',
        max: 20,
        indicators: [
            { code: 'hafalan_quran', label: 'Progress Hafalan' },
            { code: 'murojaah', label: 'Konsistensi Murojaah' },
            { code: 'tajwid', label: 'Penguasaan Tajwid' },
            { code: 'kehadiran_diniyah', label: 'Kehadiran Diniyah' }
        ]
    },
    sosial: {
        label: 'Interaksi Sosial',
        max: 15,
        indicators: [
            { code: 'kerjasama', label: 'Kerjasama Tim' },
            { code: 'tolong_menolong', label: 'Tolong Menolong' },
            { code: 'tidak_bullying', label: 'Anti Bullying' }
        ]
    },
    pengembangan_diri: {
        label: 'Pengembangan Diri',
        max: 15,
        indicators: [
            { code: 'kemandirian', label: 'Kemandirian' },
            { code: 'inisiatif', label: 'Inisiatif' },
            { code: 'public_speaking', label: 'Public Speaking' }
        ]
    }
};

async function loadWalisantriView() {
    // Get NISN from localStorage (set by dashboard) or from user data
    const nisn = localStorage.getItem('selected_child_nisn') || currentUser?.linked_student_nisn;

    if (!nisn) {
        console.warn('[Evaluations] No linked student NISN found');
        // Set stats to 0
        const wsPrestasiEl = document.getElementById('ws-prestasi');
        const wsPelanggaranEl = document.getElementById('ws-pelanggaran');
        if (wsPrestasiEl) wsPrestasiEl.textContent = '0';
        if (wsPelanggaranEl) wsPelanggaranEl.textContent = '0';
        return;
    }

    // Load BLP data and evaluation stats in parallel
    await Promise.all([
        loadBLPCoreData(nisn),
        loadWalisantriEvaluations(nisn)
    ]);
}

async function loadBLPCoreData(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`/api/kesantrian/blp/student/${nisn}/?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            setBLPPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderBLPCore(data.data[0]);
        } else {
            setBLPPlaceholder();
        }
    } catch (error) {
        console.error('Error loading BLP data:', error);
        setBLPPlaceholder();
    }
}

function renderBLPCore(blpEntry) {
    console.log('[BLP] Rendering BLP Core data:', blpEntry);

    // BLP Core max scores (25 indicators)
    const CORE_MAX = {
        akhlak: 25,
        kedisiplinan: 20,
        ibadah: 30,
        akademik: 20,
        sosial: 15,
        pengembangan_diri: 15
    };

    const domains = blpEntry.domain_scores || {};
    const indicatorValues = blpEntry.indicator_values || {};

    console.log('[BLP] Domain scores:', domains);
    console.log('[BLP] Indicator values:', indicatorValues);

    // Helper to scale domain scores to core max
    const getDomainScore = (domainKey) => {
        const domain = domains[domainKey];
        if (!domain) return 0;
        const rawScore = typeof domain === 'object' ? (domain.score || 0) : domain;
        const originalMax = domain?.max_score || ({
            'akhlak': 60, 'ibadah': 75, 'akademik': 40,
            'kedisiplinan': 50, 'sosial': 40, 'pengembangan_diri': 30
        }[domainKey] || 50);
        const coreMax = CORE_MAX[domainKey] || 20;
        return Math.round((rawScore / originalMax) * coreMax);
    };

    // Calculate scores
    const scores = {
        akhlak: getDomainScore('akhlak'),
        kedisiplinan: getDomainScore('kedisiplinan'),
        ibadah: getDomainScore('ibadah'),
        akademik: getDomainScore('akademik'),
        sosial: getDomainScore('sosial'),
        pengembangan: getDomainScore('pengembangan_diri')
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const totalMax = 125;
    const percentage = (totalScore / totalMax) * 100;

    // Determine predikat
    let predikat = 'Perlu Pembinaan';
    let predikatClass = 'perlu-pembinaan';
    if (percentage >= 90) { predikat = 'Mumtaz'; predikatClass = 'mumtaz'; }
    else if (percentage >= 75) { predikat = 'Jayyid Jiddan'; predikatClass = 'jayyid-jiddan'; }
    else if (percentage >= 60) { predikat = 'Jayyid'; predikatClass = 'jayyid'; }
    else if (percentage >= 40) { predikat = 'Maqbul'; predikatClass = 'maqbul'; }

    // Update predikat badge
    const predikatBadge = document.getElementById('blp-predikat-badge');
    if (predikatBadge) {
        predikatBadge.textContent = predikat;
        predikatBadge.className = `blp-predikat-badge ${predikatClass}`;
    }

    // Update domain chips
    document.getElementById('dc-akhlak').textContent = `${scores.akhlak}/${CORE_MAX.akhlak}`;
    document.getElementById('dc-kedisiplinan').textContent = `${scores.kedisiplinan}/${CORE_MAX.kedisiplinan}`;
    document.getElementById('dc-ibadah').textContent = `${scores.ibadah}/${CORE_MAX.ibadah}`;
    document.getElementById('dc-akademik').textContent = `${scores.akademik}/${CORE_MAX.akademik}`;
    document.getElementById('dc-sosial').textContent = `${scores.sosial}/${CORE_MAX.sosial}`;
    document.getElementById('dc-pengembangan').textContent = `${scores.pengembangan}/${CORE_MAX.pengembangan_diri}`;

    // Update individual indicator scores from indicator_values
    updateIndicatorScores(indicatorValues);

    // Create Radar Chart
    createBLPRadarChart(scores, CORE_MAX);
}

/**
 * Update individual indicator scores in the UI
 * Maps indicator_values from API to HTML elements
 */
function updateIndicatorScores(indicatorValues) {
    // Domain to HTML element ID mapping
    const domainElementMap = {
        akhlak: 'ind-akhlak',
        kedisiplinan: 'ind-kedisiplinan',
        ibadah: 'ind-ibadah',
        akademik: 'ind-akademik',
        sosial: 'ind-sosial',
        pengembangan_diri: 'ind-pengembangan'
    };

    console.log('[BLP] Updating indicator scores:', indicatorValues);

    // Iterate through each domain
    Object.keys(BLP_CORE_INDICATORS).forEach(domainKey => {
        const domainConfig = BLP_CORE_INDICATORS[domainKey];
        const domainValues = indicatorValues[domainKey] || {};
        const elementId = domainElementMap[domainKey];
        const container = document.getElementById(elementId);

        if (!container) {
            console.warn(`[BLP] Container not found: ${elementId}`);
            return;
        }

        // Build HTML for indicator items with actual values
        const indicatorItems = domainConfig.indicators.map(indicator => {
            const value = domainValues[indicator.code];
            // Show 0/5 instead of -/5 for missing/null values
            const numericValue = (value !== undefined && value !== null) ? value : 0;
            const displayScore = `${numericValue}/5`;
            const scoreClass = getScoreClass(numericValue);

            return `
                <div class="indicator-item">
                    <span>${escapeHtml(indicator.label)}</span>
                    <span class="ind-score ${scoreClass}">${displayScore}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = indicatorItems;
    });
}

/**
 * Get CSS class based on score value for color coding
 */
function getScoreClass(score) {
    if (score === undefined || score === null) return '';
    if (score >= 5) return 'score-excellent';
    if (score >= 4) return 'score-good';
    if (score >= 3) return 'score-average';
    if (score >= 2) return 'score-below';
    return 'score-poor';
}

function createBLPRadarChart(scores, maxScores) {
    const canvas = document.getElementById('blpRadarChart');
    if (!canvas) return;

    if (blpRadarChart) {
        blpRadarChart.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Convert to percentages for radar chart
    const percentages = {
        akhlak: (scores.akhlak / maxScores.akhlak) * 100,
        kedisiplinan: (scores.kedisiplinan / maxScores.kedisiplinan) * 100,
        ibadah: (scores.ibadah / maxScores.ibadah) * 100,
        akademik: (scores.akademik / maxScores.akademik) * 100,
        sosial: (scores.sosial / maxScores.sosial) * 100,
        pengembangan: (scores.pengembangan / maxScores.pengembangan_diri) * 100
    };

    blpRadarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Akhlak', 'Kedisiplinan', 'Ibadah', 'Akademik', 'Sosial', 'Pengembangan'],
            datasets: [{
                label: 'Skor BLP (%)',
                data: [
                    percentages.akhlak,
                    percentages.kedisiplinan,
                    percentages.ibadah,
                    percentages.akademik,
                    percentages.sosial,
                    percentages.pengembangan
                ],
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderColor: BARON_CHART_COLORS.emerald,
                borderWidth: 2,
                pointBackgroundColor: BARON_CHART_COLORS.emerald,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: BARON_CHART_COLORS.emerald
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: { size: 10 },
                        color: BARON_CHART_COLORS.textMuted
                    },
                    pointLabels: {
                        font: { size: 11, weight: '600' },
                        color: BARON_CHART_COLORS.textMain
                    },
                    grid: {
                        color: BARON_CHART_COLORS.borderLight
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function setBLPPlaceholder() {
    const predikatBadge = document.getElementById('blp-predikat-badge');
    if (predikatBadge) {
        predikatBadge.textContent = 'Belum Ada Data';
        predikatBadge.className = 'blp-predikat-badge';
    }

    // Reset domain scores to 0
    const domainMaxScores = {
        'dc-akhlak': 25, 'dc-kedisiplinan': 20, 'dc-ibadah': 30,
        'dc-akademik': 20, 'dc-sosial': 15, 'dc-pengembangan': 15
    };
    Object.keys(domainMaxScores).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `0/${domainMaxScores[id]}`;
    });

    // Reset all indicator scores to zero
    resetIndicatorScores();

    // Reset radar chart with zeros
    createBLPRadarChart(
        { akhlak: 0, kedisiplinan: 0, ibadah: 0, akademik: 0, sosial: 0, pengembangan: 0 },
        { akhlak: 25, kedisiplinan: 20, ibadah: 30, akademik: 20, sosial: 15, pengembangan_diri: 15 }
    );
}

/**
 * Reset all indicator scores to zero values
 */
function resetIndicatorScores() {
    const domainElementMap = {
        akhlak: 'ind-akhlak',
        kedisiplinan: 'ind-kedisiplinan',
        ibadah: 'ind-ibadah',
        akademik: 'ind-akademik',
        sosial: 'ind-sosial',
        pengembangan_diri: 'ind-pengembangan'
    };

    Object.keys(BLP_CORE_INDICATORS).forEach(domainKey => {
        const domainConfig = BLP_CORE_INDICATORS[domainKey];
        const elementId = domainElementMap[domainKey];
        const container = document.getElementById(elementId);

        if (!container) return;

        const indicatorItems = domainConfig.indicators.map(indicator => {
            return `
                <div class="indicator-item">
                    <span>${escapeHtml(indicator.label)}</span>
                    <span class="ind-score score-poor">0/5</span>
                </div>
            `;
        }).join('');

        container.innerHTML = indicatorItems;
    });
}

/**
 * Load walisantri evaluation stats (prestasi/pelanggaran counts)
 * Note: Full evaluation history has been relocated to "Catatan & Bimbingan" tab
 */
async function loadWalisantriEvaluations(nisn) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/evaluations/student/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn('[Evaluations] Failed to load stats for nisn:', nisn);
            return;
        }

        const data = await response.json();
        const evaluations = data.evaluations || [];

        // Update walisantri stats (prestasi/pelanggaran counts)
        const prestasiCount = evaluations.filter(e => e.jenis === 'prestasi').length;
        const pelanggaranCount = evaluations.filter(e => e.jenis === 'pelanggaran').length;

        const wsPrestasiEl = document.getElementById('ws-prestasi');
        const wsPelanggaranEl = document.getElementById('ws-pelanggaran');
        if (wsPrestasiEl) wsPrestasiEl.textContent = prestasiCount;
        if (wsPelanggaranEl) wsPelanggaranEl.textContent = pelanggaranCount;

        // Note: Riwayat Evaluasi rendering removed - see "Catatan & Bimbingan" tab
    } catch (error) {
        console.error('[Evaluations] Error loading walisantri stats:', error);
        // Stats will remain at default values (0)
    }
}

function getInitials(name) {
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// ============================================
// UTILITIES
// ============================================

function exportEvaluations() {
    showToast('Fitur export akan segera tersedia', 'warning');
}

function animateValue(id, end) {
    const element = document.getElementById(id);
    if (!element) return;

    const start = parseInt(element.textContent) || 0;
    const duration = 500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        element.textContent = Math.floor(start + (end - start) * progress);
        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.className = 'toast active ' + (type === 'error' ? 'error' : (type === 'warning' ? 'warning' : ''));

        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
}

// ============================================
// GLOBAL EXPORTS
// ============================================

window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.viewEvaluation = viewEvaluation;
window.closeViewModal = closeViewModal;
window.editEvaluation = editEvaluation;
window.deleteEvaluation = deleteEvaluation;
window.loadEvaluations = loadEvaluations;
window.loadStatistics = loadStatistics;
window.loadPreviousPage = loadPreviousPage;
window.loadNextPage = loadNextPage;
window.resetFilters = resetFilters;
window.loadWalisantriView = loadWalisantriView;
window.switchView = switchView;
window.goToWizardStep = goToWizardStep;
window.handlePhotoPreview = handlePhotoPreview;
window.removePhoto = removePhoto;
window.exportEvaluations = exportEvaluations;
window.resetWizardState = resetWizardState;
