/**
 * Attendance Page JavaScript
 * Baron Light Emerald Theme - Based on Example Template
 */

// State
let currentPage = 1;
let totalPages = 1;
let attendanceData = [];
let currentViewType = 'teacher';  // 'teacher' or 'parent'
let inputData = {
    kelas: '',
    mapel: '',
    tanggal: '',
    jam_ke: [],
    students: [],
    records: {},
    // Step 1 data - Tipe Pengajar
    tipe_pengajar: '', // No default - user must select
    // Step 4 data - Dokumentasi
    materi: '',
    tujuan_pembelajaran: '',
    catatan: '',
    ketuntasan_materi: 0,
    ada_penilaian: false
};
let modalStep = 1;
const TOTAL_STEPS = 4;
let weeklyChart = null;

// Session & JP Selection State
let selectedSession = null;
let selectedJP = [];

// Assignment data cache (for GURU PENGAMPU mode)
let guruAssignmentData = null;

// JP mapping by session (9 JP per hari)
// Pagi: JP 1 (Tahfidz)
// Siang: JP 2-7 (Umum)
// Sore: JP 8-9 (Sore)
const JP_BY_SESSION = {
    pagi: [1],           // Tahfidz
    siang: [2, 3, 4, 5, 6, 7],  // Umum
    sore: [8, 9]         // Sore
};

// JP Labels for display
const JP_LABELS = {
    1: 'Tahfidz',
    2: 'Umum', 3: 'Umum', 4: 'Umum', 5: 'Umum', 6: 'Umum', 7: 'Umum',
    8: 'Sore', 9: 'Sore'
};

// Session Labels
const SESSION_LABELS = {
    pagi: '🌅 Pagi (Tahfidz)',
    siang: '☀️ Siang (Umum)',
    sore: '🌇 Sore'
};

// Baron Light Emerald Colors
const EMERALD_COLORS = {
    emerald400: '#34c99a',
    emerald500: '#1fa87a',
    emerald600: '#178560',
    emerald700: '#0f6347',
    amber: '#d97706',
    blue: '#3b82f6',
    red: '#ef4444',
    textMain: '#0a2e20',
    textSub: '#3d6b57',
    textMuted: '#7aaa94',
    bgCard: '#ffffff',
    borderLight: 'rgba(15, 99, 71, 0.07)'
};

// Utility: Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadClassOptions();
    loadSubjectOptions();
    setDefaultDate();
    loadAttendanceData();
    loadWeeklyChartData();
    updateAttendanceCards(); // Load today's stats by default
    initSessionSelector();
    initFilterListeners();
    initPengajarSelector(); // NEW: Step 3 init
    initKetuntasanSlider(); // NEW: Step 3 slider (v2.3.11)
    adjustUIForRole();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

/**
 * Initialize ketuntasan materi slider event listener (v2.3.11)
 * Updates the percentage display in real-time
 */
function initKetuntasanSlider() {
    const slider = document.getElementById('input-ketuntasan');
    const valueDisplay = document.getElementById('ketuntasan-display'); // FIX: correct element ID

    if (slider && valueDisplay) {
        slider.addEventListener('input', function() {
            const value = parseInt(this.value, 10);
            valueDisplay.textContent = value + '%';
            inputData.ketuntasan_materi = value;

            // Update color based on percentage
            if (value >= 80) {
                valueDisplay.className = 'ketuntasan-value high';
            } else if (value >= 50) {
                valueDisplay.className = 'ketuntasan-value medium';
            } else {
                valueDisplay.className = 'ketuntasan-value low';
            }
        });
    }
}

/**
 * Initialize filter change listeners for reactive updates
 */
function initFilterListeners() {
    const filterKelas = document.getElementById('filter-kelas');
    const filterStart = document.getElementById('filter-start');
    const filterEnd = document.getElementById('filter-end');
    // Note: filter-guru listener is added in loadGuruListForFilter()

    // When filters change, update both table and flashcards
    [filterKelas, filterStart, filterEnd].forEach(el => {
        if (el) {
            el.addEventListener('change', function() {
                currentPage = 1; // Reset to first page on filter change
                loadAttendanceData();
                updateAttendanceCards();
            });
        }
    });
}

/**
 * Update attendance flashcard stats based on current filters
 * Default: Show today's data, reactive to filter changes
 */
async function updateAttendanceCards() {
    try {
        const filterKelas = document.getElementById('filter-kelas');
        const filterGuru = document.getElementById('filter-guru');
        const filterStart = document.getElementById('filter-start');
        const filterEnd = document.getElementById('filter-end');

        // Build params - use today as default if no dates selected
        const today = new Date().toISOString().split('T')[0];
        const params = new URLSearchParams({
            page_size: 500 // Get enough data to calculate accurate stats
        });

        // If filters are set, use them; otherwise use today
        const startDate = filterStart?.value || today;
        const endDate = filterEnd?.value || today;

        params.append('start_date', startDate);
        params.append('end_date', endDate);

        if (filterKelas?.value) {
            params.append('kelas', filterKelas.value);
        }

        if (filterGuru?.value) {
            params.append('guru', filterGuru.value);
        }

        const response = await window.apiFetch(`/attendance/history/?${params.toString()}`);

        if (!response.ok) throw new Error('Failed to load stats');

        const data = await response.json();

        if (data.success) {
            let totalRecords = data.count || 0;
            let totalHadir = 0;
            let totalSakit = 0;
            let totalAlpha = 0;

            (data.results || []).forEach(item => {
                totalHadir += item.hadir || 0;
                totalSakit += item.sakit || 0;
                totalAlpha += item.alpha || 0;
            });

            // Update flashcard values with animation
            animateCardValue('total-records', totalRecords);
            animateCardValue('total-hadir', totalHadir);
            animateCardValue('total-sakit', totalSakit);
            animateCardValue('total-alpha', totalAlpha);

            // Update card subtitle to show date range
            updateCardSubtitle(startDate, endDate);
        }
    } catch (error) {
        console.error('Error updating attendance cards:', error);
    }
}

/**
 * Animate card value change
 */
function animateCardValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const currentValue = parseInt(el.textContent) || 0;

    if (currentValue === newValue) return;

    // Add pulse animation
    el.closest('.stat-card')?.classList.add('updating');

    // Animate number
    const duration = 400;
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(currentValue + (newValue - currentValue) * easeOut);

        el.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            el.closest('.stat-card')?.classList.remove('updating');
        }
    }

    requestAnimationFrame(animate);
}

/**
 * Update card subtitle to show current date range
 */
function updateCardSubtitle(startDate, endDate) {
    const recordsCard = document.querySelector('.stat-card.sc-green .stat-label');
    if (recordsCard) {
        if (startDate === endDate) {
            const date = new Date(startDate);
            const isToday = startDate === new Date().toISOString().split('T')[0];
            recordsCard.textContent = isToday ? 'Total Hari Ini' : formatDateShort(startDate);
        } else {
            recordsCard.textContent = 'Total Record';
        }
    }
}

/**
 * Format date to short format
 */
function formatDateShort(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Load weekly attendance chart data
 */
async function loadWeeklyChartData() {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);

        const params = new URLSearchParams({
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            page_size: 100
        });

        const response = await window.apiFetch(`/attendance/history/?${params.toString()}`);

        if (!response.ok) throw new Error('Failed to load chart data');

        const data = await response.json();

        if (data.success) {
            renderWeeklyChart(data.results || [], startDate, endDate);
        }
    } catch (error) {
        console.error('Error loading weekly chart data:', error);
        renderWeeklyChart([], new Date(), new Date());
    }
}

/**
 * Render weekly attendance line chart (matching example template)
 */
function renderWeeklyChart(results, startDate, endDate) {
    const ctx = document.getElementById('weeklyAttendanceChart');
    if (!ctx) return;

    if (weeklyChart) {
        weeklyChart.destroy();
    }

    const labels = [];
    const hadirData = [];
    const sakitData = [];
    const izinData = [];
    const alphaData = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
        const dayNum = date.getDate();
        labels.push(`${dayName}. ${dayNum}`);

        const dayData = results.filter(r => r.tanggal === dateStr);
        let hadir = 0, sakit = 0, izin = 0, alpha = 0;
        dayData.forEach(d => {
            hadir += d.hadir || 0;
            sakit += d.sakit || 0;
            izin += d.izin || 0;
            alpha += d.alpha || 0;
        });

        hadirData.push(hadir);
        sakitData.push(sakit);
        izinData.push(izin);
        alphaData.push(alpha);
    }

    // Line chart matching example template
    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hadir',
                    data: hadirData,
                    borderColor: EMERALD_COLORS.emerald500,
                    backgroundColor: 'rgba(31, 168, 122, 0.08)',
                    borderWidth: 2.5,
                    pointBackgroundColor: EMERALD_COLORS.emerald500,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.4,
                    fill: true,
                },
                {
                    label: 'Sakit',
                    data: sakitData,
                    borderColor: EMERALD_COLORS.amber,
                    backgroundColor: 'rgba(217, 119, 6, 0.05)',
                    borderWidth: 2,
                    pointBackgroundColor: EMERALD_COLORS.amber,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.4,
                },
                {
                    label: 'Izin',
                    data: izinData,
                    borderColor: EMERALD_COLORS.blue,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointBackgroundColor: EMERALD_COLORS.blue,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.4,
                },
                {
                    label: 'Alpha',
                    data: alphaData,
                    borderColor: EMERALD_COLORS.red,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointBackgroundColor: EMERALD_COLORS.red,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.4,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: EMERALD_COLORS.textSub,
                        font: { family: "'Plus Jakarta Sans'", size: 11.5, weight: '600' },
                        boxWidth: 10,
                        borderRadius: 3,
                        padding: 14,
                        usePointStyle: true,
                    }
                },
                tooltip: {
                    backgroundColor: EMERALD_COLORS.textMain,
                    titleColor: '#aeebd8',
                    bodyColor: 'rgba(255,255,255,0.8)',
                    padding: 12,
                    borderRadius: 10,
                    borderColor: 'rgba(52,201,154,0.2)',
                    borderWidth: 1,
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: EMERALD_COLORS.textMuted, font: { family: "'Plus Jakarta Sans'", size: 11.5 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: EMERALD_COLORS.borderLight },
                    ticks: { color: EMERALD_COLORS.textMuted, font: { family: "'Plus Jakarta Sans'", size: 11 } }
                }
            }
        }
    });
}

/**
 * Adjust UI based on user role
 */
function adjustUIForRole() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const role = user.role || '';

        // Admin roles that can see all guru's jurnal
        const adminRoles = ['superadmin', 'pimpinan'];
        const isAdmin = adminRoles.includes(role);

        // Guru/musyrif roles that see personal jurnal only
        const personalRoles = ['guru', 'musyrif'];
        const isPersonalView = personalRoles.includes(role);

        if (role === 'walisantri') {
            // Walisantri: show parent view
            const pageActions = document.querySelector('.page-actions');
            if (pageActions) pageActions.style.display = 'none';

            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = 'Riwayat Kehadiran Ananda';

            const adminSection = document.getElementById('admin-section');
            const parentSection = document.getElementById('parent-section');
            if (adminSection) adminSection.style.display = 'none';
            if (parentSection) parentSection.style.display = 'block';
        } else if (isPersonalView) {
            // Guru/Musyrif: show personal view label
            const personalLabel = document.getElementById('personal-view-label');
            if (personalLabel) {
                personalLabel.style.display = 'inline-flex';
                // Re-init Lucide icons
                if (typeof lucide !== 'undefined') {
                    setTimeout(() => lucide.createIcons(), 50);
                }
            }
        } else if (isAdmin) {
            // Admin: show guru filter dropdown
            const guruFilterGroup = document.getElementById('filter-guru-group');
            if (guruFilterGroup) {
                guruFilterGroup.style.display = 'block';
                loadGuruListForFilter();
            }
        }
    } catch (e) {
        console.error('Error parsing user info:', e);
    }
}

/**
 * Load list of guru for filter dropdown (admin only)
 */
async function loadGuruListForFilter() {
    const filterGuru = document.getElementById('filter-guru');
    if (!filterGuru) return;

    try {
        // Fetch users with role guru
        const response = await window.apiFetch('/admin/users/?role=guru&page_size=200');
        if (!response.ok) throw new Error('Failed to load guru list');

        const data = await response.json();
        const users = data.results || data.users || data.data || [];

        filterGuru.innerHTML = '<option value="">Semua Guru</option>';
        users.forEach(user => {
            const displayName = user.name || user.username;
            filterGuru.innerHTML += `<option value="${user.username}">${displayName}</option>`;
        });

        // Add change listener
        filterGuru.addEventListener('change', function() {
            loadAttendanceData();
            updateAttendanceCards();
        });
    } catch (error) {
        console.error('Error loading guru list:', error);
        // Fallback - hide the filter if we can't load data
        const guruFilterGroup = document.getElementById('filter-guru-group');
        if (guruFilterGroup) guruFilterGroup.style.display = 'none';
    }
}

/**
 * Initialize session selector event listeners
 */
function initSessionSelector() {
    const sessionRadios = document.querySelectorAll('input[name="sesi"]');
    sessionRadios.forEach(radio => {
        radio.addEventListener('change', async function() {
            selectedSession = this.value;
            selectedJP = [];
            renderJPChips(selectedSession);
            updateJPHint();

            // If GURU PIKET mode, load mapel based on sesi
            if (inputData.tipe_pengajar === 'guru_piket') {
                await loadMapelBySesi(this.value);
            }
        });
    });
}

/**
 * Render JP chips based on selected session (matching example template)
 */
function renderJPChips(session) {
    const container = document.getElementById('jp-chips-container');

    if (!session || !JP_BY_SESSION[session]) {
        container.innerHTML = `<div class="jp-chips-placeholder"><span>👆</span> Pilih sesi terlebih dahulu</div>`;
        return;
    }

    const jpList = JP_BY_SESSION[session];
    container.innerHTML = jpList.map(jp =>
        `<button type="button" class="jp-chip-select" data-jp="${jp}" onclick="toggleJPChip(${jp})">${jp}</button>`
    ).join('');
}

/**
 * Toggle JP chip selection
 */
function toggleJPChip(jp) {
    const chipEl = document.querySelector(`.jp-chip-select[data-jp="${jp}"]`);

    if (selectedJP.includes(jp)) {
        selectedJP = selectedJP.filter(j => j !== jp);
        chipEl.classList.remove('selected');
    } else {
        selectedJP.push(jp);
        selectedJP.sort((a, b) => a - b);
        chipEl.classList.add('selected');
    }

    updateJPHint();
}

/**
 * Update JP hint text
 */
function updateJPHint() {
    const hintEl = document.getElementById('jp-hint');
    if (!hintEl) return;

    if (!selectedSession) {
        hintEl.textContent = 'Pilih sesi, lalu pilih jam pelajaran';
        hintEl.style.color = EMERALD_COLORS.textMuted;
    } else if (selectedJP.length === 0) {
        hintEl.textContent = 'Klik angka untuk memilih jam pelajaran';
        hintEl.style.color = EMERALD_COLORS.textMuted;
    } else {
        const jpLabels = selectedJP.map(j => `JP ${j}`).join(', ');
        hintEl.textContent = `Terpilih: ${jpLabels}`;
        hintEl.style.color = EMERALD_COLORS.emerald600;
    }
}

/**
 * Initialize pengajar selector (Step 1) - v2.3.12
 * Now in Step 1 - controls which kelas/mapel options are shown
 */
function initPengajarSelector() {
    const pengajarRadios = document.querySelectorAll('input[name="tipe_pengajar"]');

    pengajarRadios.forEach(radio => {
        radio.addEventListener('change', async function() {
            inputData.tipe_pengajar = this.value;

            // Reset dropdowns when tipe changes
            resetKelasMapelDropdowns();

            // Reset sesi and JP selection
            selectedSession = null;
            selectedJP = [];
            document.querySelectorAll('input[name="sesi"]').forEach(r => r.checked = false);
            renderJPChips(null);

            const noAssignmentAlert = document.getElementById('no-assignment-alert');
            const mapelHint = document.getElementById('mapel-hint');

            if (this.value === 'guru_pengampu') {
                // GURU PENGAMPU: Load from assignment
                if (mapelHint) mapelHint.style.display = 'none';
                await loadAssignmentBasedOptions();
            } else if (this.value === 'guru_piket') {
                // GURU PIKET: Load all classes, mapel based on sesi
                if (noAssignmentAlert) noAssignmentAlert.style.display = 'none';
                if (mapelHint) mapelHint.style.display = 'block';
                await loadAllClassesForPiket();
                // Clear mapel - will be loaded when sesi is selected
                const mapelSelect = document.getElementById('input-mapel');
                if (mapelSelect) {
                    mapelSelect.innerHTML = '<option value="">-- Pilih sesi dulu --</option>';
                    mapelSelect.disabled = true;
                }
            }

            // Re-init Lucide icons
            if (typeof lucide !== 'undefined') {
                setTimeout(() => lucide.createIcons(), 50);
            }
        });
    });

    // Add listener to kelas dropdown for GURU PENGAMPU mode
    const kelasSelect = document.getElementById('input-kelas');
    if (kelasSelect) {
        kelasSelect.addEventListener('change', function() {
            if (inputData.tipe_pengajar === 'guru_pengampu' && guruAssignmentData) {
                // Filter mapel based on selected kelas from assignment
                updateMapelFromAssignment(this.value);
            }
        });
    }
}

/**
 * Reset kelas and mapel dropdowns
 */
function resetKelasMapelDropdowns() {
    const kelasSelect = document.getElementById('input-kelas');
    const mapelSelect = document.getElementById('input-mapel');

    if (kelasSelect) {
        kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        kelasSelect.value = '';
        kelasSelect.disabled = false;
    }
    if (mapelSelect) {
        mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        mapelSelect.value = '';
        mapelSelect.disabled = false;
    }
}

/**
 * Load kelas and mapel options based on guru's assignment (GURU PENGAMPU mode)
 */
async function loadAssignmentBasedOptions() {
    const kelasSelect = document.getElementById('input-kelas');
    const mapelSelect = document.getElementById('input-mapel');
    const noAssignmentAlert = document.getElementById('no-assignment-alert');

    try {
        const response = await window.apiFetch('/attendance/guru/assignment-info/');
        if (!response.ok) throw new Error('Failed to load assignment info');

        const data = await response.json();

        if (data.success) {
            guruAssignmentData = data;

            // Check if guru has assignments
            if (!data.kelas_list || data.kelas_list.length === 0) {
                // No assignments
                if (noAssignmentAlert) noAssignmentAlert.style.display = 'flex';
                if (kelasSelect) kelasSelect.disabled = true;
                if (mapelSelect) mapelSelect.disabled = true;
                return;
            }

            // Hide alert
            if (noAssignmentAlert) noAssignmentAlert.style.display = 'none';

            // Populate kelas dropdown
            if (kelasSelect) {
                kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
                data.kelas_list.forEach(kelas => {
                    kelasSelect.innerHTML += `<option value="${kelas}">${kelas}</option>`;
                });
                kelasSelect.disabled = false;
            }

            // Mapel will be populated when kelas is selected
            if (mapelSelect) {
                mapelSelect.innerHTML = '<option value="">-- Pilih kelas dulu --</option>';
                mapelSelect.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading assignment info:', error);
        // Fallback to loading all classes
        await loadAllClassesForPiket();
    }
}

/**
 * Update mapel dropdown based on selected kelas from assignment data
 */
function updateMapelFromAssignment(selectedKelas) {
    const mapelSelect = document.getElementById('input-mapel');
    if (!mapelSelect || !guruAssignmentData) return;

    if (!selectedKelas) {
        mapelSelect.innerHTML = '<option value="">-- Pilih kelas dulu --</option>';
        mapelSelect.disabled = true;
        return;
    }

    // Find mapel for selected kelas from assignment_detail
    const mapelForKelas = guruAssignmentData.assignment_detail
        .filter(a => a.kelas === selectedKelas && a.mapel)
        .map(a => a.mapel);

    // Remove duplicates
    const uniqueMapel = [...new Set(mapelForKelas)];

    if (uniqueMapel.length === 0) {
        // No specific mapel for this kelas, show all mapel from assignment
        mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        guruAssignmentData.mapel_list.forEach(mapel => {
            mapelSelect.innerHTML += `<option value="${mapel}">${mapel}</option>`;
        });
    } else {
        mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
        uniqueMapel.forEach(mapel => {
            mapelSelect.innerHTML += `<option value="${mapel}">${mapel}</option>`;
        });
    }
    mapelSelect.disabled = false;
}

/**
 * Load all classes for GURU PIKET mode
 */
async function loadAllClassesForPiket() {
    try {
        const response = await window.apiFetch('/students/classes/');
        if (!response.ok) throw new Error('Failed to load classes');

        const data = await response.json();
        if (data.success && data.classes) {
            const kelasSelect = document.getElementById('input-kelas');
            if (kelasSelect) {
                kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
                data.classes.forEach(cls => {
                    kelasSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
                });
                kelasSelect.disabled = false;
            }
        }
    } catch (error) {
        console.error('Error loading classes for piket:', error);
    }
}

/**
 * Load mapel based on sesi for GURU PIKET mode
 * Called when sesi radio is changed
 */
async function loadMapelBySesi(sesi) {
    if (inputData.tipe_pengajar !== 'guru_piket') return;

    const mapelSelect = document.getElementById('input-mapel');
    const mapelHint = document.getElementById('mapel-hint');

    if (!mapelSelect) return;

    // Mapping sesi to API param
    const sesiMap = {
        'pagi': 'pagi',     // → tahfidz
        'siang': 'siang',   // → kbm
        'sore': 'sore'      // → diniyah
    };

    const sesiParam = sesiMap[sesi];
    if (!sesiParam) return;

    try {
        mapelSelect.innerHTML = '<option value="">Memuat mapel...</option>';
        mapelSelect.disabled = true;

        const response = await window.apiFetch(`/core/master-mapel/by-sesi/?sesi=${sesiParam}`);
        if (!response.ok) throw new Error('Failed to load mapel by sesi');

        const data = await response.json();

        if (data.success && data.mapel_list) {
            mapelSelect.innerHTML = '<option value="">-- Pilih Mata Pelajaran --</option>';
            data.mapel_list.forEach(mapel => {
                mapelSelect.innerHTML += `<option value="${mapel}">${mapel}</option>`;
            });
            mapelSelect.disabled = false;

            // Hide hint
            if (mapelHint) mapelHint.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading mapel by sesi:', error);
        mapelSelect.innerHTML = '<option value="">Gagal memuat mapel</option>';
    }
}

/**
 * Display current logged-in user as guru pengganti (DEPRECATED - now shown in Step 3 badge)
 * Kept for backward compatibility
 */
function displayCurrentUserAsGuruPengganti() {
    // This function is no longer needed - info is shown in step3-pengajar-info badge
    console.log('[attendance.js] displayCurrentUserAsGuruPengganti called - deprecated');
}

/**
 * Fetch titipan tugas for current class and date
 */
async function fetchTitipanTugas() {
    const container = document.getElementById('titipan-tugas-container');
    const emptyState = document.getElementById('titipan-empty');

    if (!container) return;

    // Show loading
    container.innerHTML = `
        <div class="titipan-loading">
            <div class="loading-spinner"></div>
            <span>Memuat titipan tugas...</span>
        </div>
    `;
    if (emptyState) emptyState.style.display = 'none';

    try {
        // Get current date and class
        const tanggal = inputData.tanggal || new Date().toISOString().split('T')[0];
        const kelas = inputData.kelas;

        if (!kelas) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.innerHTML = `
                    <i data-lucide="alert-circle"></i>
                    <span>Pilih kelas terlebih dahulu</span>
                `;
                emptyState.style.display = 'flex';
            }
            return;
        }

        // Fetch titipan tugas
        const response = await window.apiFetch(`/attendance/titipan-tugas/?tanggal=${tanggal}`);

        if (!response || !response.ok) {
            throw new Error('Gagal memuat titipan tugas');
        }

        const result = await response.json();
        const allTitipan = result.data || result.results || result || [];

        // Filter by current class and status='menunggu' (belum dikerjakan)
        const titipanForClass = allTitipan.filter(t =>
            t.kelas === kelas && t.status === 'menunggu'
        );

        if (titipanForClass.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.innerHTML = `
                    <i data-lucide="inbox"></i>
                    <span>Tidak ada titipan tugas untuk kelas ${kelas} hari ini</span>
                `;
                emptyState.style.display = 'flex';
            }
        } else {
            container.innerHTML = titipanForClass.map(renderTitipanCard).join('');
            if (emptyState) emptyState.style.display = 'none';
        }

        // Re-init Lucide icons
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 50);
        }

    } catch (error) {
        console.error('[Attendance] Error fetching titipan tugas:', error);
        container.innerHTML = `
            <div class="titipan-error">
                <i data-lucide="alert-triangle"></i>
                <span>Gagal memuat titipan tugas</span>
            </div>
        `;
    }
}

/**
 * Render single titipan tugas card
 */
function renderTitipanCard(titipan) {
    const mapel = titipan.mata_pelajaran || '-';
    const guruNama = titipan.guru_nama || titipan.guru?.name || 'Guru';
    const deskripsi = titipan.deskripsi_tugas || titipan.catatan || '-';
    const status = titipan.status || 'pending';

    // Only show JP if jam_ke exists
    const jpDisplay = titipan.jam_ke ? `<span class="titipan-jam">JP ${titipan.jam_ke}</span>` : '';

    const statusBadge = status === 'selesai'
        ? '<span class="titipan-status-badge selesai">Selesai</span>'
        : '<span class="titipan-status-badge pending">Menunggu</span>';

    return `
        <div class="titipan-card">
            <div class="titipan-card-header">
                <div class="titipan-card-icon">
                    <i data-lucide="clipboard-list"></i>
                </div>
                <div class="titipan-card-title">
                    <span class="titipan-mapel">${escapeHtml(mapel)}</span>
                    ${jpDisplay}
                </div>
                ${statusBadge}
            </div>
            <div class="titipan-card-body">
                <div class="titipan-from">
                    <i data-lucide="user"></i>
                    <span>Dari: <strong>${escapeHtml(guruNama)}</strong></span>
                </div>
                <div class="titipan-desc">
                    "${escapeHtml(deskripsi)}"
                </div>
            </div>
        </div>
    `;
}

/**
 * Get display name for role
 */
function getRoleDisplayName(role) {
    const roleMap = {
        'superadmin': 'Super Admin',
        'pimpinan': 'Pimpinan',
        'guru': 'Guru',
        'musyrif': 'Musyrif',
        'wali_kelas': 'Wali Kelas',
        'bk': 'Guru BK',
        'bendahara': 'Bendahara',
        'walisantri': 'Wali Santri'
    };
    return roleMap[role] || role;
}

/**
 * Set default date - defaults to today for real-time relevance
 */
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const inputTanggal = document.getElementById('input-tanggal');
    if (inputTanggal) inputTanggal.value = today;

    // Default to today for both start and end - shows today's attendance
    const filterStart = document.getElementById('filter-start');
    const filterEnd = document.getElementById('filter-end');
    if (filterStart) filterStart.value = today;
    if (filterEnd) filterEnd.value = today;
}

/**
 * Load class options for FILTERS and EXPORT only
 * Input modal has its own logic based on tipe_pengajar
 */
async function loadClassOptions() {
    try {
        const response = await window.apiFetch('/students/classes/');
        if (!response.ok) throw new Error('Failed to load classes');

        const data = await response.json();
        if (data.success && data.classes) {
            // Only for filter and export, NOT input-kelas (handled by pengajar selector)
            const selects = ['filter-kelas', 'export-kelas'];
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">Semua Kelas</option>';
                    data.classes.forEach(cls => {
                        select.innerHTML += `<option value="${cls}">${cls}</option>`;
                    });
                    select.value = currentValue;
                }
            });
        }
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

/**
 * Load subject options - NO LONGER USED for input modal
 * Input modal mapel is now controlled by pengajar type:
 * - GURU PENGAMPU: from assignment_detail
 * - GURU PIKET: from master-mapel by sesi
 */
async function loadSubjectOptions() {
    // This function is now deprecated for input modal
    // Kept for backward compatibility but does nothing
    console.log('[attendance.js] loadSubjectOptions called - now handled by pengajar selector');
}

/**
 * Load attendance data
 */
async function loadAttendanceData() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            page_size: 10
        });

        const filterKelas = document.getElementById('filter-kelas');
        const filterGuru = document.getElementById('filter-guru');
        const startDate = document.getElementById('filter-start')?.value;
        const endDate = document.getElementById('filter-end')?.value;

        if (filterKelas && filterKelas.value) params.append('kelas', filterKelas.value);
        if (filterGuru && filterGuru.value) params.append('guru', filterGuru.value);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await window.apiFetch(`/attendance/history/?${params.toString()}`);

        if (!response.ok) throw new Error('Failed to load data');

        const data = await response.json();

        if (data.success) {
            attendanceData = data.results || [];
            totalPages = Math.ceil((data.count || 0) / 10);
            currentViewType = data.view_type || 'teacher';

            if (currentViewType === 'parent') {
                renderParentView();
                updateParentPagination(data.count || 0);
            } else {
                renderTeacherView();
                updateStats(data);
                updatePagination(data.count || 0);
            }

            toggleViewContainers(currentViewType);
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        const tbody = document.getElementById('attendance-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Gagal memuat data</td></tr>';
        }
    }
}

/**
 * Toggle view containers
 */
function toggleViewContainers(viewType) {
    const adminSection = document.getElementById('admin-section');
    const parentSection = document.getElementById('parent-section');

    if (viewType === 'parent') {
        if (adminSection) adminSection.style.display = 'none';
        if (parentSection) parentSection.style.display = 'block';
    } else {
        if (adminSection) adminSection.style.display = 'block';
        if (parentSection) parentSection.style.display = 'none';
    }
}

/**
 * Render parent view (timeline accordion)
 */
function renderParentView() {
    const timeline = document.getElementById('attendance-timeline');
    if (!timeline) return;

    if (attendanceData.length === 0) {
        timeline.innerHTML = `
            <div class="timeline-empty">
                <div class="timeline-empty-icon">📋</div>
                <div class="timeline-empty-text">Belum ada data kehadiran</div>
            </div>
        `;
        return;
    }

    const groupedData = groupAttendanceByDate(attendanceData);

    timeline.innerHTML = Object.entries(groupedData).map(([dateStr, records]) => {
        const date = new Date(dateStr);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleDateString('id-ID', { month: 'short' });
        const year = date.getFullYear();
        const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' });

        const dailyStatus = getDailyStatus(records);
        const statusBadge = getDailyStatusBadge(dailyStatus);

        const jpDetails = records.map(item => {
            const statusIcon = getStatusIcon(item.status);
            const statusClass = item.status.toLowerCase();
            return `
                <div class="daily-detail-row">
                    <span class="detail-jp">JP ${item.jam_ke}</span>
                    <span class="detail-mapel">${item.mata_pelajaran || '-'}</span>
                    <span class="detail-status status-${statusClass}">
                        ${statusIcon} ${item.status}
                    </span>
                </div>
            `;
        }).join('');

        return `
            <div class="daily-accordion" data-date="${dateStr}">
                <div class="daily-summary" onclick="toggleDailyAccordion('${dateStr}')">
                    <div class="daily-date">
                        <div class="daily-day">${day}</div>
                        <div class="daily-month">${month} ${year}</div>
                        <div class="daily-dayname">${dayName}</div>
                    </div>
                    <div class="daily-info">
                        <div class="daily-jp-count">${records.length} Jam Pelajaran</div>
                        ${statusBadge}
                    </div>
                    <div class="daily-chevron">
                        <span class="chevron-icon">▼</span>
                    </div>
                </div>
                <div class="daily-details">
                    ${jpDetails}
                </div>
            </div>
        `;
    }).join('');
}

function groupAttendanceByDate(data) {
    const grouped = {};
    data.forEach(item => {
        const dateKey = item.tanggal;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(item);
    });
    Object.keys(grouped).forEach(date => {
        grouped[date].sort((a, b) => (a.jam_ke || 0) - (b.jam_ke || 0));
    });
    return grouped;
}

function getDailyStatus(records) {
    const statuses = records.map(r => r.status);
    if (statuses.includes('Alpha')) return 'alpha';
    if (statuses.includes('Sakit')) return 'sakit';
    if (statuses.includes('Izin')) return 'izin';
    if (statuses.every(s => s === 'Hadir')) return 'hadir_penuh';
    return 'mixed';
}

function getDailyStatusBadge(status) {
    switch (status) {
        case 'hadir_penuh': return '<span class="daily-badge badge-hadir">✓ Hadir Penuh</span>';
        case 'sakit': return '<span class="daily-badge badge-sakit">🤒 Sakit</span>';
        case 'izin': return '<span class="daily-badge badge-izin">📝 Izin</span>';
        case 'alpha': return '<span class="daily-badge badge-alpha">✗ Alpha</span>';
        default: return '<span class="daily-badge badge-mixed">⚠ Campuran</span>';
    }
}

function toggleDailyAccordion(dateStr) {
    const accordion = document.querySelector(`.daily-accordion[data-date="${dateStr}"]`);
    if (accordion) accordion.classList.toggle('expanded');
}

function getStatusIcon(status) {
    switch (status) {
        case 'Hadir': return '✓';
        case 'Sakit': return '🤒';
        case 'Izin': return '📝';
        case 'Alpha': return '✗';
        default: return '';
    }
}

function updateParentPagination(total) {
    const els = {
        showing: document.getElementById('parent-showing-count'),
        total: document.getElementById('parent-total-count'),
        page: document.getElementById('parent-current-page'),
        prev: document.getElementById('btn-prev-parent'),
        next: document.getElementById('btn-next-parent')
    };

    if (els.showing) els.showing.textContent = attendanceData.length;
    if (els.total) els.total.textContent = total;
    if (els.page) els.page.textContent = currentPage;
    if (els.prev) els.prev.disabled = currentPage <= 1;
    if (els.next) els.next.disabled = currentPage >= totalPages;
}

/**
 * Render teacher view (table)
 */
function renderTeacherView() {
    renderTable();
}

/**
 * Render attendance table (matching example template style)
 */
function renderTable() {
    const tbody = document.getElementById('attendance-table-body');
    const countBadge = document.getElementById('record-count-badge');

    if (countBadge) countBadge.textContent = `${attendanceData.length} Record`;

    if (attendanceData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center" style="padding: 40px;">
                    <div style="font-size: 40px; margin-bottom: 12px;">📋</div>
                    <div style="color: var(--text-muted);">Tidak ada data absensi</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = attendanceData.map(item => {
        const total = item.total_students || 0;
        const date = new Date(item.tanggal);
        const dateFormatted = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const dayName = date.toLocaleDateString('id-ID', { weekday: 'long' });

        let jamKeArray = Array.isArray(item.jam_ke) ? item.jam_ke : [item.jam_ke || 1];
        const jpChips = jamKeArray.map(jp => `<span class="jp-chip">${jp}</span>`).join('');
        const jamKeParam = JSON.stringify(jamKeArray);

        return `
            <tr>
                <td>
                    <span class="date-cell">
                        ${dateFormatted}
                        <span class="date-day">${dayName}</span>
                    </span>
                </td>
                <td><strong>${item.kelas || '-'}</strong></td>
                <td>${jpChips}</td>
                <td>${item.mata_pelajaran || '-'}</td>
                <td class="num-cell num-total">${total}</td>
                <td class="num-cell num-hadir">${item.hadir || 0}</td>
                <td class="num-cell num-sakit">${item.sakit || 0}</td>
                <td class="num-cell num-izin">${item.izin || 0}</td>
                <td class="num-cell num-alpha">${item.alpha || 0}</td>
                <td>
                    <button class="btn-lihat" onclick='viewDetail("${item.kelas}", "${item.tanggal}", ${jamKeParam})'>
                        👁 Lihat
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStats(data) {
    let totalHadir = 0, totalSakit = 0, totalAlpha = 0;

    (data.results || []).forEach(item => {
        totalHadir += item.hadir || 0;
        totalSakit += item.sakit || 0;
        totalAlpha += item.alpha || 0;
    });

    const el = (id) => document.getElementById(id);
    if (el('total-records')) el('total-records').textContent = data.count || 0;
    if (el('total-hadir')) el('total-hadir').textContent = totalHadir;
    if (el('total-sakit')) el('total-sakit').textContent = totalSakit;
    if (el('total-alpha')) el('total-alpha').textContent = totalAlpha;
}

function updatePagination(total) {
    const el = (id) => document.getElementById(id);
    if (el('showing-count')) el('showing-count').textContent = attendanceData.length;
    if (el('total-count')) el('total-count').textContent = total;
    if (el('current-page')) el('current-page').textContent = currentPage;
    if (el('btn-prev')) el('btn-prev').disabled = currentPage <= 1;
    if (el('btn-next')) el('btn-next').disabled = currentPage >= totalPages;
}

function goToPage(direction) {
    if (direction === 'prev' && currentPage > 1) currentPage--;
    else if (direction === 'next' && currentPage < totalPages) currentPage++;
    loadAttendanceData();
}

function resetFilters() {
    const filterKelas = document.getElementById('filter-kelas');
    const filterGuru = document.getElementById('filter-guru');
    if (filterKelas) filterKelas.value = '';
    if (filterGuru) filterGuru.value = '';
    setDefaultDate();
    currentPage = 1;
    loadAttendanceData();
    updateAttendanceCards();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ==================== MODAL FUNCTIONS ====================

/**
 * Open add modal (using .open class)
 */
async function openAddModal() {
    resetModalStep();

    // Reset inputData
    inputData = {
        kelas: '',
        mapel: '',
        tanggal: '',
        jam_ke: [],
        students: [],
        records: {},
        // Step 1 - Tipe Pengajar (no default)
        tipe_pengajar: '',
        // Step 4 - Dokumentasi
        materi: '',
        tujuan_pembelajaran: '',
        catatan: '',
        ketuntasan_materi: 0,
        ada_penilaian: false
    };

    // Reset pengajar selection - NO DEFAULT (user must select)
    const pengajarRadios = document.querySelectorAll('input[name="tipe_pengajar"]');
    pengajarRadios.forEach(radio => {
        radio.checked = false;
    });

    // Reset dropdowns
    resetKelasMapelDropdowns();

    // Set tanggal to today
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];

    // Reset sesi and JP
    selectedSession = null;
    selectedJP = [];
    document.querySelectorAll('input[name="sesi"]').forEach(radio => radio.checked = false);

    const jpContainer = document.getElementById('jp-chips-container');
    if (jpContainer) {
        jpContainer.innerHTML = `<div class="jp-chips-placeholder"><span>👆</span> Pilih sesi terlebih dahulu</div>`;
    }

    const hintEl = document.getElementById('jp-hint');
    if (hintEl) {
        hintEl.textContent = 'Pilih sesi, lalu pilih jam pelajaran';
        hintEl.style.color = EMERALD_COLORS.textMuted;
    }

    // Hide hints and alerts
    const mapelHint = document.getElementById('mapel-hint');
    const noAssignmentAlert = document.getElementById('no-assignment-alert');
    if (mapelHint) mapelHint.style.display = 'none';
    if (noAssignmentAlert) noAssignmentAlert.style.display = 'none';

    // Show modal
    document.getElementById('add-modal').classList.add('open');

    // Re-init Lucide icons
    if (typeof lucide !== 'undefined') {
        setTimeout(() => lucide.createIcons(), 50);
    }

    // Don't load options yet - wait for user to select tipe_pengajar in Step 1
}

function closeAddModal() {
    document.getElementById('add-modal').classList.remove('open');
    resetModalStep();
}

function resetModalStep() {
    modalStep = 1;

    // Reset all step contents (4 steps)
    const step1 = document.getElementById('modal-step-1');
    const step2 = document.getElementById('modal-step-2');
    const step3 = document.getElementById('modal-step-3');
    const step4 = document.getElementById('modal-step-4');
    if (step1) step1.classList.add('active');
    if (step2) step2.classList.remove('active');
    if (step3) step3.classList.remove('active');
    if (step4) step4.classList.remove('active');

    // Reset step indicator dots (4 dots, 3 lines)
    const dot1 = document.getElementById('dot-1');
    const dot2 = document.getElementById('dot-2');
    const dot3 = document.getElementById('dot-3');
    const dot4 = document.getElementById('dot-4');
    const line1 = document.getElementById('line-1');
    const line2 = document.getElementById('line-2');
    const line3 = document.getElementById('line-3');
    if (dot1) { dot1.className = 'step-dot active'; }
    if (dot2) { dot2.className = 'step-dot'; }
    if (dot3) { dot3.className = 'step-dot'; }
    if (dot4) { dot4.className = 'step-dot'; }
    if (line1) { line1.classList.remove('done'); }
    if (line2) { line2.classList.remove('done'); }
    if (line3) { line3.classList.remove('done'); }

    // Reset buttons
    const btnBack = document.getElementById('btn-modal-back');
    const btnNext = document.getElementById('btn-modal-next');
    const btnSave = document.getElementById('btn-modal-save');
    if (btnBack) btnBack.style.display = 'none';
    if (btnNext) btnNext.style.display = '';
    if (btnSave) btnSave.style.display = 'none';

    // Reset Step 1 - Tipe Pengajar (NO DEFAULT)
    const pengajarRadios = document.querySelectorAll('input[name="tipe_pengajar"]');
    pengajarRadios.forEach(radio => {
        radio.checked = false;
    });

    // Hide alerts and hints in Step 2
    const noAssignmentAlert = document.getElementById('no-assignment-alert');
    const mapelHint = document.getElementById('mapel-hint');
    if (noAssignmentAlert) noAssignmentAlert.style.display = 'none';
    if (mapelHint) mapelHint.style.display = 'none';

    // Reset titipan tugas section (Step 4)
    const titipanSection = document.getElementById('titipan-tugas-section');
    if (titipanSection) titipanSection.style.display = 'none';

    // Reset Step 4 pengajar info display
    const step4PengajarInfo = document.getElementById('step4-pengajar-info');
    if (step4PengajarInfo) step4PengajarInfo.style.display = 'none';

    // Reset Step 4 dokumentasi fields
    const materiInput = document.getElementById('input-materi');
    const tujuanInput = document.getElementById('input-tujuan');
    const catatanInput = document.getElementById('input-catatan-guru');
    if (materiInput) materiInput.value = '';
    if (tujuanInput) tujuanInput.value = '';
    if (catatanInput) catatanInput.value = '';

    // Reset inputData values
    inputData.tipe_pengajar = ''; // No default
    inputData.materi = '';
    inputData.capaian_pembelajaran = '';
    inputData.catatan = '';
    inputData.ketuntasan_materi = 0;
    inputData.ada_penilaian = false;

    // Reset ketuntasan slider
    const ketuntasanSlider = document.getElementById('input-ketuntasan');
    const ketuntasanDisplay = document.getElementById('ketuntasan-display');
    const adaPenilaianInput = document.getElementById('input-ada-penilaian');

    if (ketuntasanSlider) ketuntasanSlider.value = 0;
    if (ketuntasanDisplay) {
        ketuntasanDisplay.textContent = '0%';
        ketuntasanDisplay.className = 'ketuntasan-value low';
    }
    if (adaPenilaianInput) adaPenilaianInput.checked = false;

    // Clear assignment data cache
    guruAssignmentData = null;
}

async function modalNext() {
    if (modalStep === 1) {
        // === STEP 1 → STEP 2: Validate Tipe Pengajar ===
        const tipePengajarRadio = document.querySelector('input[name="tipe_pengajar"]:checked');
        if (!tipePengajarRadio) {
            showToast('Pilih tipe pengajar terlebih dahulu', 'warning');
            return;
        }

        inputData.tipe_pengajar = tipePengajarRadio.value;

        // Load dropdown options based on selected tipe
        if (inputData.tipe_pengajar === 'guru_pengampu') {
            await loadAssignmentBasedOptions();
        } else {
            await loadAllClassesForPiket();
            // Reset mapel - will be loaded when sesi is selected
            const mapelSelect = document.getElementById('input-mapel');
            const mapelHint = document.getElementById('mapel-hint');
            if (mapelSelect) {
                mapelSelect.innerHTML = '<option value="">-- Pilih sesi dulu --</option>';
                mapelSelect.disabled = true;
            }
            if (mapelHint) mapelHint.style.display = 'block';
        }

        // Update step indicator
        modalStep = 2;
        document.getElementById('modal-step-1').classList.remove('active');
        document.getElementById('modal-step-2').classList.add('active');

        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        const line1 = document.getElementById('line-1');
        if (dot1) { dot1.classList.remove('active'); dot1.classList.add('done'); }
        if (dot2) { dot2.classList.add('active'); }
        if (line1) { line1.classList.add('done'); }

        // Show back button
        document.getElementById('btn-modal-back').style.display = '';
        document.getElementById('btn-modal-next').style.display = '';
        document.getElementById('btn-modal-save').style.display = 'none';

        // Re-init Lucide icons
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 50);
        }

    } else if (modalStep === 2) {
        // === STEP 2 → STEP 3: Validate Info Kelas ===
        const kelas = document.getElementById('input-kelas').value;
        const mapel = document.getElementById('input-mapel').value;
        const tanggal = document.getElementById('input-tanggal').value;

        if (!kelas || !mapel || !tanggal) {
            showToast('Mohon lengkapi semua field', 'warning');
            return;
        }

        if (!selectedSession) {
            showToast('Pilih sesi terlebih dahulu (Pagi/Siang/Sore)', 'warning');
            return;
        }

        if (selectedJP.length === 0) {
            showToast('Pilih minimal satu jam pelajaran', 'warning');
            return;
        }

        inputData.kelas = kelas;
        inputData.mapel = mapel;
        inputData.tanggal = tanggal;
        inputData.jam_ke = [...selectedJP];

        await loadStudentsForInput(kelas, tanggal, selectedJP);

        // Update step 3 info display
        document.getElementById('step-kelas-info').textContent = kelas;
        document.getElementById('step-mapel-info').textContent = mapel;
        document.getElementById('step-tanggal-info').textContent = formatDate(tanggal);

        const sessionLabel = selectedSession.charAt(0).toUpperCase() + selectedSession.slice(1);
        const jpLabels = selectedJP.map(j => `JP ${j}`).join(', ');
        document.getElementById('step-jp-info').textContent = `${sessionLabel} - ${jpLabels}`;

        // Update step indicator
        modalStep = 3;
        document.getElementById('modal-step-2').classList.remove('active');
        document.getElementById('modal-step-3').classList.add('active');

        const dot2 = document.getElementById('dot-2');
        const dot3 = document.getElementById('dot-3');
        const line2 = document.getElementById('line-2');
        if (dot2) { dot2.classList.remove('active'); dot2.classList.add('done'); }
        if (dot3) { dot3.classList.add('active'); }
        if (line2) { line2.classList.add('done'); }

        // Show back & next, hide save
        document.getElementById('btn-modal-back').style.display = '';
        document.getElementById('btn-modal-next').style.display = '';
        document.getElementById('btn-modal-save').style.display = 'none';

    } else if (modalStep === 3) {
        // === STEP 3 → STEP 4: Validate Kehadiran ===
        const unfilled = inputData.students.filter(s => !inputData.records[s.nisn]?.status);
        if (unfilled.length > 0) {
            showToast(`${unfilled.length} siswa belum diisi statusnya`, 'warning');
            return;
        }

        // Update step 4 info display
        document.getElementById('step4-kelas-info').textContent = inputData.kelas;
        document.getElementById('step4-mapel-info').textContent = inputData.mapel;
        document.getElementById('step4-tanggal-info').textContent = formatDate(inputData.tanggal);

        // Show pengajar info badge if guru piket
        const step4PengajarInfo = document.getElementById('step4-pengajar-info');
        const step4PiketName = document.getElementById('step4-piket-name');
        const titipanSection = document.getElementById('titipan-tugas-section');

        if (inputData.tipe_pengajar === 'guru_piket') {
            // Show guru piket badge with user name
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const displayName = userData.name || userData.username || 'User';

            if (step4PengajarInfo) step4PengajarInfo.style.display = 'block';
            if (step4PiketName) step4PiketName.textContent = displayName;

            // Show titipan tugas section and fetch data
            if (titipanSection) {
                titipanSection.style.display = 'block';
                fetchTitipanTugas();
            }
        } else {
            if (step4PengajarInfo) step4PengajarInfo.style.display = 'none';
            if (titipanSection) titipanSection.style.display = 'none';
        }

        // Update step indicator
        modalStep = 4;
        document.getElementById('modal-step-3').classList.remove('active');
        document.getElementById('modal-step-4').classList.add('active');

        const dot3 = document.getElementById('dot-3');
        const dot4 = document.getElementById('dot-4');
        const line3 = document.getElementById('line-3');
        if (dot3) { dot3.classList.remove('active'); dot3.classList.add('done'); }
        if (dot4) { dot4.classList.add('active'); }
        if (line3) { line3.classList.add('done'); }

        // Show back & save, hide next
        document.getElementById('btn-modal-back').style.display = '';
        document.getElementById('btn-modal-next').style.display = 'none';
        document.getElementById('btn-modal-save').style.display = '';

        // Re-init Lucide icons for step 4
        if (typeof lucide !== 'undefined') {
            setTimeout(() => lucide.createIcons(), 50);
        }
    }
}

function modalBack() {
    if (modalStep === 2) {
        // === STEP 2 → STEP 1 ===
        modalStep = 1;
        document.getElementById('modal-step-1').classList.add('active');
        document.getElementById('modal-step-2').classList.remove('active');

        const dot1 = document.getElementById('dot-1');
        const dot2 = document.getElementById('dot-2');
        const line1 = document.getElementById('line-1');
        if (dot1) { dot1.classList.add('active'); dot1.classList.remove('done'); }
        if (dot2) { dot2.classList.remove('active'); }
        if (line1) { line1.classList.remove('done'); }

        // Hide back button on step 1
        document.getElementById('btn-modal-back').style.display = 'none';
        document.getElementById('btn-modal-next').style.display = '';
        document.getElementById('btn-modal-save').style.display = 'none';

    } else if (modalStep === 3) {
        // === STEP 3 → STEP 2 ===
        modalStep = 2;
        document.getElementById('modal-step-3').classList.remove('active');
        document.getElementById('modal-step-2').classList.add('active');

        const dot2 = document.getElementById('dot-2');
        const dot3 = document.getElementById('dot-3');
        const line2 = document.getElementById('line-2');
        if (dot2) { dot2.classList.add('active'); dot2.classList.remove('done'); }
        if (dot3) { dot3.classList.remove('active'); }
        if (line2) { line2.classList.remove('done'); }

        // Show back & next, hide save
        document.getElementById('btn-modal-back').style.display = '';
        document.getElementById('btn-modal-next').style.display = '';
        document.getElementById('btn-modal-save').style.display = 'none';

    } else if (modalStep === 4) {
        // === STEP 4 → STEP 3 ===
        modalStep = 3;
        document.getElementById('modal-step-4').classList.remove('active');
        document.getElementById('modal-step-3').classList.add('active');

        const dot3 = document.getElementById('dot-3');
        const dot4 = document.getElementById('dot-4');
        const line3 = document.getElementById('line-3');
        if (dot3) { dot3.classList.add('active'); dot3.classList.remove('done'); }
        if (dot4) { dot4.classList.remove('active'); }
        if (line3) { line3.classList.remove('done'); }

        // Show back & next, hide save
        document.getElementById('btn-modal-back').style.display = '';
        document.getElementById('btn-modal-next').style.display = '';
        document.getElementById('btn-modal-save').style.display = 'none';
    }
}

async function loadStudentsForInput(kelas, tanggal, jamKeArray) {
    const container = document.getElementById('students-list');
    container.innerHTML = '<div class="loading-inline">Memuat siswa...</div>';

    try {
        const response = await window.apiFetch('/attendance/initialize/', {
            method: 'POST',
            body: JSON.stringify({
                kelas: kelas,
                tanggal: tanggal,
                mata_pelajaran: inputData.mapel,
                jam_ke: jamKeArray
            })
        });

        let students = [];

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) students = data.data;
        } else {
            const studentsResponse = await window.apiFetch(`/students/?kelas=${encodeURIComponent(kelas)}`);
            if (studentsResponse.ok) {
                const studentsData = await studentsResponse.json();
                if (studentsData.success && studentsData.students) {
                    students = studentsData.students.map(s => ({
                        nisn: s.nisn,
                        nama: s.nama,
                        status: null
                    }));
                }
            }
        }

        inputData.students = students;
        students.forEach(s => {
            if (!inputData.records[s.nisn]) {
                inputData.records[s.nisn] = { status: s.status || null, keterangan: '' };
            }
        });

        renderStudentsList();
    } catch (error) {
        console.error('Error loading students:', error);
        container.innerHTML = '<div class="loading-inline">Gagal memuat siswa</div>';
    }
}

/**
 * Render students list with radio pill buttons (matching example template)
 */
function renderStudentsList() {
    const container = document.getElementById('students-list');

    if (inputData.students.length === 0) {
        container.innerHTML = '<div class="loading-inline">Tidak ada siswa di kelas ini</div>';
        return;
    }

    container.innerHTML = inputData.students.map((student, idx) => {
        const record = inputData.records[student.nisn] || {};
        const makeChecked = (status) => record.status === status ? 'checked' : '';

        return `
            <div class="student-row" data-nisn="${student.nisn}">
                <span class="student-no">${idx + 1}</span>
                <div class="student-info">
                    <div class="student-name">${student.nama}</div>
                    <div class="student-nisn">${student.nisn}</div>
                </div>
                <div class="status-radios">
                    <label class="status-radio">
                        <input type="radio" name="status-${student.nisn}" value="Hadir" ${makeChecked('Hadir')} onchange="setStatus('${student.nisn}', 'Hadir')">
                        <span class="status-pill s-hadir">H</span>
                    </label>
                    <label class="status-radio">
                        <input type="radio" name="status-${student.nisn}" value="Sakit" ${makeChecked('Sakit')} onchange="setStatus('${student.nisn}', 'Sakit')">
                        <span class="status-pill s-sakit">S</span>
                    </label>
                    <label class="status-radio">
                        <input type="radio" name="status-${student.nisn}" value="Izin" ${makeChecked('Izin')} onchange="setStatus('${student.nisn}', 'Izin')">
                        <span class="status-pill s-izin">I</span>
                    </label>
                    <label class="status-radio">
                        <input type="radio" name="status-${student.nisn}" value="Alpha" ${makeChecked('Alpha')} onchange="setStatus('${student.nisn}', 'Alpha')">
                        <span class="status-pill s-alpha">A</span>
                    </label>
                </div>
            </div>
        `;
    }).join('');

    updateCounts();
}

function setStatus(nisn, status) {
    inputData.records[nisn] = { status: status, keterangan: '' };
    updateCounts();
}

function markAllPresent() {
    inputData.students.forEach(student => {
        inputData.records[student.nisn] = { status: 'Hadir', keterangan: '' };
    });
    renderStudentsList();
}

function updateCounts() {
    let hadir = 0, sakit = 0, izin = 0, alpha = 0;

    Object.values(inputData.records).forEach(record => {
        if (record.status === 'Hadir') hadir++;
        else if (record.status === 'Sakit') sakit++;
        else if (record.status === 'Izin') izin++;
        else if (record.status === 'Alpha') alpha++;
    });

    const el = (id) => document.getElementById(id);
    if (el('count-hadir')) el('count-hadir').textContent = hadir;
    if (el('count-sakit')) el('count-sakit').textContent = sakit;
    if (el('count-izin')) el('count-izin').textContent = izin;
    if (el('count-alpha')) el('count-alpha').textContent = alpha;
}

async function saveAttendance() {
    const unfilled = inputData.students.filter(s => !inputData.records[s.nisn]?.status);
    if (unfilled.length > 0) {
        showToast(`${unfilled.length} siswa belum diisi statusnya`, 'warning');
        return;
    }

    if (!inputData.jam_ke || inputData.jam_ke.length === 0) {
        showToast('Tidak ada jam pelajaran yang dipilih', 'warning');
        return;
    }

    // === Collect Step 4 values ===
    const tipePengajar = inputData.tipe_pengajar || 'guru_pengampu';
    // NOTE: guru_piket tidak dikirim - backend otomatis pakai request.user

    const materiInput = document.getElementById('input-materi');
    const tujuanInput = document.getElementById('input-tujuan');
    const catatanInput = document.getElementById('input-catatan-guru');
    const ketuntasanInput = document.getElementById('input-ketuntasan');
    const adaPenilaianInput = document.getElementById('input-ada-penilaian');

    const materi = materiInput ? materiInput.value.trim() : '';
    const tujuanPembelajaran = tujuanInput ? tujuanInput.value.trim() : '';
    const catatan = catatanInput ? catatanInput.value.trim() : '';
    const ketuntasanMateri = ketuntasanInput ? parseInt(ketuntasanInput.value, 10) : 0;
    const adaPenilaian = adaPenilaianInput ? adaPenilaianInput.checked : false;

    try {
        const attendanceList = inputData.students.map(s => ({
            nisn: s.nisn,
            status: inputData.records[s.nisn].status,
            keterangan: inputData.records[s.nisn].keterangan || ''
        }));

        const requestBody = {
            kelas: inputData.kelas,
            tanggal: inputData.tanggal,
            mata_pelajaran: inputData.mapel,
            jam_ke: inputData.jam_ke,
            attendance_data: attendanceList,
            // Step 3 fields (v2.3.9) - guru_piket otomatis dari request.user
            tipe_pengajar: tipePengajar,
            materi: materi,
            tujuan_pembelajaran: tujuanPembelajaran,
            catatan: catatan,
            // Step 3 fields (v2.3.11)
            ketuntasan_materi: ketuntasanMateri,
            ada_penilaian: adaPenilaian
        };

        const response = await window.apiFetch('/attendance/batch/', {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error('Failed to save');

        const data = await response.json();

        if (data.success) {
            const jpCount = inputData.jam_ke.length;
            const studentCount = inputData.students.length;
            const pengajarInfo = tipePengajar === 'guru_piket' ? ' (Guru Piket)' : '';
            showToast(`Jurnal berhasil disimpan (${studentCount} siswa × ${jpCount} JP)${pengajarInfo}`, 'success');
            closeAddModal();
            // Await all refresh functions to ensure data is updated
            await Promise.all([
                loadAttendanceData(),
                loadWeeklyChartData(),
                updateAttendanceCards()
            ]);
        } else {
            throw new Error(data.message || 'Failed to save');
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showToast('Gagal menyimpan absensi', 'error');
    }
}

// ==================== DETAIL MODAL ====================

async function viewDetail(kelas, tanggal, jamKe) {
    const jamKeArray = Array.isArray(jamKe) ? jamKe : [jamKe];
    const jpDisplay = jamKeArray.map(j => `JP ${j}`).join(', ');

    document.getElementById('detail-kelas').textContent = kelas;
    document.getElementById('detail-jp').textContent = jpDisplay;
    document.getElementById('detail-mapel').textContent = '-';
    document.getElementById('detail-tanggal').textContent = formatDate(tanggal);

    const tbody = document.getElementById('detail-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading-spinner" style="margin: 20px auto;"></div></td></tr>';

    document.getElementById('detail-modal').classList.add('open');

    try {
        const url = `/attendance/class/${encodeURIComponent(kelas)}/${tanggal}/`;
        const response = await window.apiFetch(url);

        if (!response.ok) throw new Error('Failed to load detail');

        const data = await response.json();

        if (data.success) {
            const students = data.attendance_data || [];

            if (data.mata_pelajaran) {
                document.getElementById('detail-mapel').textContent = data.mata_pelajaran;
            }

            let hadir = 0, sakit = 0, izin = 0, alpha = 0;
            students.forEach(s => {
                const att = s.attendances?.find(a => jamKeArray.includes(a.jam_ke)) || s.attendances?.[0];
                if (att) {
                    if (att.status === 'Hadir') hadir++;
                    else if (att.status === 'Sakit') sakit++;
                    else if (att.status === 'Izin') izin++;
                    else if (att.status === 'Alpha') alpha++;
                }
            });

            document.getElementById('detail-hadir').textContent = hadir;
            document.getElementById('detail-sakit').textContent = sakit;
            document.getElementById('detail-izin').textContent = izin;
            document.getElementById('detail-alpha').textContent = alpha;

            if (students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada data</td></tr>';
            } else {
                tbody.innerHTML = students.map((s, i) => {
                    const att = s.attendances?.find(a => jamKeArray.includes(a.jam_ke)) || s.attendances?.[0] || {};
                    return `
                        <tr>
                            <td class="num-cell">${i + 1}</td>
                            <td style="font-family: var(--font-mono); font-size: 12.5px;">${s.nisn}</td>
                            <td><strong>${s.nama}</strong></td>
                            <td><span class="badge badge-${getStatusClass(att.status)}">${att.status || '-'}</span></td>
                            <td style="color: var(--text-muted); font-size: 13px;">${att.keterangan || '—'}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading detail:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Gagal memuat data</td></tr>';
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'Hadir': return 'success';
        case 'Sakit': return 'warning';
        case 'Izin': return 'info';
        case 'Alpha': return 'danger';
        default: return 'secondary';
    }
}

function closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('open');
}

function printDetail() {
    window.print();
}

// ==================== JURNAL DETAIL MODAL (v2.3.11) ====================

/**
 * Open jurnal detail modal with data
 * @param {Object} jurnalData - The jurnal record data
 */
function openJurnalDetailModal(jurnalData) {
    if (!jurnalData) return;

    const modal = document.getElementById('jurnal-detail-modal');
    if (!modal) return;

    // Populate fields
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || '-';
    };

    setField('jurnal-detail-tanggal', formatDate(jurnalData.tanggal));

    // Format jam_ke
    const jamKe = Array.isArray(jurnalData.jam_ke)
        ? jurnalData.jam_ke.map(j => `JP ${j}`).join(', ')
        : `JP ${jurnalData.jam_ke || '-'}`;
    setField('jurnal-detail-jam', jamKe);

    setField('jurnal-detail-kelas', jurnalData.kelas);
    setField('jurnal-detail-mapel', jurnalData.mata_pelajaran);

    // Tipe pengajar
    const tipePengajarDisplay = jurnalData.tipe_pengajar === 'guru_piket'
        ? 'Guru Piket'
        : 'Guru Pengampu';
    setField('jurnal-detail-tipe', tipePengajarDisplay);

    // Guru piket (only show if guru_piket)
    const piketEl = document.getElementById('jurnal-detail-piket');
    if (piketEl) {
        if (jurnalData.tipe_pengajar === 'guru_piket' && jurnalData.guru_piket_nama) {
            piketEl.textContent = jurnalData.guru_piket_nama;
            piketEl.closest('.jurnal-detail-item').style.display = '';
        } else {
            piketEl.closest('.jurnal-detail-item').style.display = 'none';
        }
    }

    setField('jurnal-detail-materi', jurnalData.materi);
    setField('jurnal-detail-tujuan', jurnalData.tujuan_pembelajaran);
    setField('jurnal-detail-catatan', jurnalData.catatan);

    // Ketuntasan materi with progress bar
    const ketuntasan = jurnalData.ketuntasan_materi || 0;
    const ketuntasanPct = document.getElementById('jurnal-detail-ketuntasan');
    const ketuntasanFill = document.getElementById('jurnal-detail-ketuntasan-fill');
    if (ketuntasanPct) ketuntasanPct.textContent = ketuntasan + '%';
    if (ketuntasanFill) {
        ketuntasanFill.style.width = ketuntasan + '%';
        // Color based on percentage
        if (ketuntasan >= 80) {
            ketuntasanFill.className = 'jurnal-ketuntasan-fill high';
        } else if (ketuntasan >= 50) {
            ketuntasanFill.className = 'jurnal-ketuntasan-fill medium';
        } else {
            ketuntasanFill.className = 'jurnal-ketuntasan-fill low';
        }
    }

    // Ada penilaian
    const adaPenilaian = jurnalData.ada_penilaian;
    const penilaianEl = document.getElementById('jurnal-detail-penilaian');
    if (penilaianEl) {
        if (adaPenilaian) {
            penilaianEl.innerHTML = '<span class="badge badge-success">✓ Ya</span>';
        } else {
            penilaianEl.innerHTML = '<span class="badge badge-secondary">✗ Tidak</span>';
        }
    }

    modal.classList.add('open');
}

/**
 * Close jurnal detail modal
 */
function closeJurnalDetailModal() {
    const modal = document.getElementById('jurnal-detail-modal');
    if (modal) modal.classList.remove('open');
}

// ==================== EXPORT ====================

function openExportModal() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    document.getElementById('export-start').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('export-end').value = today.toISOString().split('T')[0];
    document.getElementById('export-kelas').value = '';

    document.getElementById('export-modal').classList.add('open');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('open');
}

async function executeExport() {
    const kelas = document.getElementById('export-kelas').value;
    const startDate = document.getElementById('export-start').value;
    const endDate = document.getElementById('export-end').value;
    const format = document.querySelector('input[name="export-format"]:checked').value;

    if (!startDate || !endDate) {
        showToast('Pilih rentang tanggal', 'warning');
        return;
    }

    try {
        const params = new URLSearchParams({ page: 1, page_size: 1000 });
        if (kelas) params.append('kelas', kelas);
        params.append('start_date', startDate);
        params.append('end_date', endDate);

        const response = await window.apiFetch(`/attendance/history/?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch data');

        const data = await response.json();

        if (data.success && data.results) {
            if (format === 'csv') {
                exportToCSV(data.results, kelas, startDate, endDate);
            } else {
                exportToPDF(data.results, kelas, startDate, endDate);
            }
            closeExportModal();
            showToast('Export berhasil', 'success');
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast('Gagal export data', 'error');
    }
}

function exportToCSV(results, kelas, startDate, endDate) {
    const headers = ['Tanggal', 'Kelas', 'Jam Pelajaran', 'Mata Pelajaran', 'Total', 'Hadir', 'Sakit', 'Izin', 'Alpha'];

    const rows = results.map(item => {
        let jpDisplay = Array.isArray(item.jam_ke) ? item.jam_ke.map(j => `JP ${j}`).join(', ') : `JP ${item.jam_ke || 1}`;
        return [item.tanggal, item.kelas || '-', jpDisplay, item.mata_pelajaran || '-', item.total_students || 0, item.hadir || 0, item.sakit || 0, item.izin || 0, item.alpha || 0];
    });

    let csv = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => csv += row.map(cell => `"${cell}"`).join(',') + '\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `absensi_${kelas || 'semua'}_${startDate}_${endDate}.csv`;
    link.click();
}

function exportToPDF(results, kelas, startDate, endDate) {
    const printWindow = window.open('', '_blank');
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Absensi</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; }
                .info { text-align: center; margin-bottom: 20px; color: #666; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background: #f5f5f5; }
                .text-center { text-align: center; }
            </style>
        </head>
        <body>
            <h1>Laporan Absensi</h1>
            <div class="info">${kelas ? `Kelas: ${kelas} | ` : ''}Periode: ${formatDate(startDate)} - ${formatDate(endDate)}</div>
            <table>
                <thead><tr><th>Tanggal</th><th>Kelas</th><th>JP</th><th>Mapel</th><th class="text-center">Total</th><th class="text-center">Hadir</th><th class="text-center">Sakit</th><th class="text-center">Izin</th><th class="text-center">Alpha</th></tr></thead>
                <tbody>
                    ${results.map(item => {
                        let jpDisplay = Array.isArray(item.jam_ke) ? item.jam_ke.map(j => 'JP ' + j).join(', ') : 'JP ' + (item.jam_ke || 1);
                        return `<tr><td>${formatDate(item.tanggal)}</td><td>${item.kelas || '-'}</td><td>${jpDisplay}</td><td>${item.mata_pelajaran || '-'}</td><td class="text-center">${item.total_students || 0}</td><td class="text-center">${item.hadir || 0}</td><td class="text-center">${item.sakit || 0}</td><td class="text-center">${item.izin || 0}</td><td class="text-center">${item.alpha || 0}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
            <script>window.print();</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
}

// ==================== TOAST ====================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (toastMsg) toastMsg.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Export to window
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.modalNext = modalNext;
window.modalBack = modalBack;
window.setStatus = setStatus;
window.markAllPresent = markAllPresent;
window.saveAttendance = saveAttendance;
window.viewDetail = viewDetail;
window.closeDetailModal = closeDetailModal;
window.printDetail = printDetail;
window.openJurnalDetailModal = openJurnalDetailModal;
window.closeJurnalDetailModal = closeJurnalDetailModal;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.executeExport = executeExport;
window.loadAttendanceData = loadAttendanceData;
window.loadWeeklyChartData = loadWeeklyChartData;
window.updateAttendanceCards = updateAttendanceCards;
window.resetFilters = resetFilters;
window.goToPage = goToPage;
window.toggleJPChip = toggleJPChip;
window.toggleDailyAccordion = toggleDailyAccordion;
window.applyFilters = function() {
    loadAttendanceData();
    updateAttendanceCards();
};
