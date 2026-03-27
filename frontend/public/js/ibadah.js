/**
 * Ibadah Module - Portal Ponpes Baron v2.3
 * Sholat 5 Waktu Tracking & Worship History
 */

// ============================================
// GLOBALS
// ============================================
let currentUser = null;
let selectedChild = null;
let childrenData = [];
let ibadahCharts = {};

const API_BASE = '/api';
const WAKTU_SHOLAT = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const HARI_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Ibadah] Admin page detected, skipping init');
        return;
    }

    updateDate();
    await initPage();
});

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.textContent = dateStr;
}

async function initPage() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        // Get current user
        const userRes = await fetch(`${API_BASE}/users/me/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userRes.ok) {
            window.location.href = '/login';
            return;
        }

        currentUser = await userRes.json();

        // Load children data for walisantri
        if (currentUser.role === 'walisantri') {
            await loadChildrenData();
            if (childrenData.length > 0) {
                // Check localStorage for persisted child selection
                const savedNisn = localStorage.getItem('selected_child_nisn');
                const childExists = savedNisn && childrenData.some(c => c.nisn === savedNisn);

                // Use saved selection if valid, otherwise use first child
                const initialNisn = childExists ? savedNisn : childrenData[0].nisn;
                selectChild(initialNisn);
            }

            // Listen for child switch events from other pages
            window.addEventListener('childSwitched', (e) => {
                if (e.detail && e.detail.nisn && e.detail.nisn !== selectedChild?.nisn) {
                    selectChild(e.detail.nisn);
                }
            });
        } else {
            // For non-walisantri, hide child selector
            document.getElementById('child-selector').style.display = 'none';
        }

    } catch (error) {
        console.error('Init error:', error);
        showToast('Gagal memuat data', 'error');
    }
}

// ============================================
// CHILDREN DATA
// ============================================
async function loadChildrenData() {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/kesantrian/my-children-summary/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success && data.children) {
            childrenData = data.children;
            renderChildSelector();
        } else {
            showNoChildrenState();
        }
    } catch (error) {
        console.error('Load children error:', error);
        showNoChildrenState();
    }
}

function renderChildSelector() {
    const container = document.getElementById('child-selector');

    if (childrenData.length === 0) {
        showNoChildrenState();
        return;
    }

    // Get saved selection from localStorage
    const savedNisn = localStorage.getItem('selected_child_nisn');

    container.innerHTML = childrenData.map((child, idx) => {
        // Mark active based on saved selection or first child
        const isActive = savedNisn ? child.nisn === savedNisn : idx === 0;

        return `
        <div class="child-tab ${isActive ? 'active' : ''}" data-nisn="${child.nisn}" onclick="selectChild('${child.nisn}')">
            <div class="child-avatar">${getInitials(child.nama)}</div>
            <div class="child-info">
                <h4>${child.nama}</h4>
                <span>Kelas ${child.kelas || '-'} | NISN: ${child.nisn}</span>
            </div>
        </div>
    `;
    }).join('');
}

function selectChild(nisn) {
    selectedChild = childrenData.find(c => c.nisn === nisn);

    if (!selectedChild) return;

    // Persist selection to localStorage for cross-page state
    localStorage.setItem('selected_child_nisn', nisn);
    localStorage.setItem('selected_child_nama', selectedChild.nama);
    localStorage.setItem('selected_child_kelas', selectedChild.kelas || '');
    localStorage.setItem('selected_child_data', JSON.stringify(selectedChild));

    // Update active tab
    document.querySelectorAll('.child-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.nisn === nisn);
    });

    // IMPORTANT: Destroy all existing charts BEFORE loading new data
    // This prevents "Chart Ghosting" where old data shadows new data
    destroyAllCharts();

    // Clear any cached data structures
    clearDataCache();

    // Broadcast event for any listening components
    window.dispatchEvent(new CustomEvent('childSwitched', {
        detail: { nisn, child: selectedChild }
    }));

    // Load ibadah data
    loadIbadahSummary(nisn);

    // Use current filter value for sholat grid
    const periodFilter = document.getElementById('filter-period');
    const days = periodFilter ? parseInt(periodFilter.value) || 7 : 7;
    loadWeeklySholat(nisn, days);

    loadIbadahHistory(nisn);
    loadHeatmapData(nisn);
}

/**
 * Destroy all Chart.js instances to prevent ghosting
 */
function destroyAllCharts() {
    Object.keys(ibadahCharts).forEach(key => {
        if (ibadahCharts[key] && typeof ibadahCharts[key].destroy === 'function') {
            ibadahCharts[key].destroy();
        }
    });
    ibadahCharts = {};
}

/**
 * Clear any cached data to ensure fresh state
 */
function clearDataCache() {
    // Clear weekly sholat grid
    const sholatGrid = document.getElementById('weekly-sholat-grid');
    if (sholatGrid) {
        sholatGrid.innerHTML = '<div class="loading-placeholder">Memuat data...</div>';
    }

    // Clear history list
    const historyList = document.getElementById('ibadah-history-list');
    if (historyList) {
        historyList.innerHTML = '<div class="loading-placeholder">Memuat riwayat...</div>';
    }

    // Clear heatmap
    const heatmapGrid = document.getElementById('heatmap-grid');
    if (heatmapGrid) {
        heatmapGrid.innerHTML = '';
    }

    // Reset summary text elements
    const resetElements = [
        'sholat-wajib-pct', 'sholat-hadir', 'sholat-total',
        'sholat-sunnah-pct', 'dhuha-count', 'tahajud-count',
        'tilawah-pct', 'tilawah-count', 'dzikir-count',
        'heatmap-total', 'heatmap-streak', 'heatmap-avg'
    ];

    resetElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id.includes('pct')) {
                el.textContent = '0%';
            } else {
                el.textContent = '0';
            }
        }
    });
}

// ============================================
// IBADAH SUMMARY (Donut Charts)
// ============================================
async function loadIbadahSummary(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        // Load worship tracker for sholat wajib
        const trackerRes = await fetch(`${API_BASE}/kesantrian/worship-tracker/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (trackerRes.ok) {
            const data = await trackerRes.json();
            if (data.success) {
                updateSholatWajibChart(data.summary);
            }
        }

        // Load ibadah detail for sunnah and others
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const startDate = monthStart.toISOString().split('T')[0];
        const endDate = today.toISOString().split('T')[0];

        const ibadahRes = await fetch(`${API_BASE}/kesantrian/ibadah/${nisn}/?start_date=${startDate}&end_date=${endDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (ibadahRes.ok) {
            const ibadahData = await ibadahRes.json();
            if (ibadahData.success) {
                updateSunnahChart(ibadahData.data);
                updateTilawahChart(ibadahData.data);
            }
        }

    } catch (error) {
        console.error('Load ibadah summary error:', error);
    }
}

function updateSholatWajibChart(summary) {
    const pct = summary.persentase || 0;
    const hadir = summary.total_hadir || 0;
    const total = summary.total_sholat || 35; // 7 days × 5 waktu

    createDonutChart('chart-sholat-wajib', pct, '#178560');
    document.getElementById('sholat-wajib-pct').textContent = `${Math.round(pct)}%`;
    document.getElementById('sholat-hadir').textContent = hadir;
    document.getElementById('sholat-total').textContent = total;
}

function updateSunnahChart(ibadahData) {
    const sunnahRecords = ibadahData.filter(r => r.jenis === 'sholat_sunnah');
    const dhuhaCount = sunnahRecords.filter(r => r.waktu === 'dhuha' && r.status === 'hadir').length;
    const tahajudCount = sunnahRecords.filter(r => r.waktu === 'tahajud' && r.status === 'hadir').length;

    // Calculate percentage (assuming 30 days in month)
    const expectedDays = new Date().getDate();
    const totalSunnah = dhuhaCount + tahajudCount;
    const maxSunnah = expectedDays * 2; // dhuha + tahajud each day
    const pct = maxSunnah > 0 ? Math.round((totalSunnah / maxSunnah) * 100) : 0;

    createDonutChart('chart-sholat-sunnah', pct, '#c8961c');
    document.getElementById('sholat-sunnah-pct').textContent = `${pct}%`;
    document.getElementById('dhuha-count').textContent = dhuhaCount;
    document.getElementById('tahajud-count').textContent = tahajudCount;
}

function updateTilawahChart(ibadahData) {
    const tilawahRecords = ibadahData.filter(r => r.jenis === 'tilawah' && r.status === 'hadir');
    const dzikirRecords = ibadahData.filter(r => r.jenis === 'dzikir' && r.status === 'hadir');

    const tilawahCount = tilawahRecords.length;
    const dzikirCount = dzikirRecords.length;

    const expectedDays = new Date().getDate();
    const totalAmalan = tilawahCount + dzikirCount;
    const maxAmalan = expectedDays * 2;
    const pct = maxAmalan > 0 ? Math.round((totalAmalan / maxAmalan) * 100) : 0;

    createDonutChart('chart-tilawah', pct, '#8b5cf6');
    document.getElementById('tilawah-pct').textContent = `${pct}%`;
    document.getElementById('tilawah-count').textContent = tilawahCount;
    document.getElementById('dzikir-count').textContent = dzikirCount;
}

function createDonutChart(canvasId, percentage, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (ibadahCharts[canvasId]) {
        ibadahCharts[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');

    ibadahCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [color, '#e5e7eb'],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                animateRotate: true,
                duration: 800
            }
        }
    });
}

// ============================================
// WEEKLY SHOLAT GRID
// ============================================
async function loadWeeklySholat(nisn, days = 7) {
    const token = localStorage.getItem('access_token');
    const grid = document.getElementById('sholat-grid');
    const sectionTitle = document.querySelector('#weekly-sholat .card-head h3');

    // Clear grid first to prevent stale data
    if (grid) {
        grid.innerHTML = '<div class="loading-placeholder"><span>Memuat data sholat...</span></div>';
    }

    // Update section title dynamically
    if (sectionTitle) {
        sectionTitle.textContent = `Rekap Sholat 5 Waktu (${days} Hari Terakhir)`;
    }

    try {
        // Pass days parameter to API
        const response = await fetch(`${API_BASE}/kesantrian/worship-tracker/${nisn}/?days=${days}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            grid.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
            return;
        }

        const data = await response.json();

        if (data.success && data.week_data) {
            renderSholatGrid(data.week_data, days);
        } else {
            grid.innerHTML = '<div class="loading-placeholder">Tidak ada data</div>';
        }

    } catch (error) {
        console.error('Load weekly sholat error:', error);
        grid.innerHTML = '<div class="loading-placeholder">Gagal memuat data</div>';
    }
}

function renderSholatGrid(weekData, days = 7) {
    const grid = document.getElementById('sholat-grid');

    if (!grid) return;

    // Clear grid first
    grid.innerHTML = '';

    // Reverse so oldest date is on left
    const sortedData = [...weekData].reverse();
    const columnCount = sortedData.length + 1; // +1 for waktu label column

    // Set dynamic grid columns based on data length
    grid.style.gridTemplateColumns = `60px repeat(${sortedData.length}, minmax(36px, 1fr))`;

    // Build header row
    let html = `
        <div class="sholat-grid-cell header waktu-label">Waktu</div>
    `;

    sortedData.forEach(day => {
        const date = new Date(day.tanggal);
        const dayName = day.hari.substring(0, 3);
        const dateStr = date.getDate();
        html += `<div class="sholat-grid-cell header">${dayName}<br>${dateStr}</div>`;
    });

    // Build rows for each waktu sholat
    WAKTU_SHOLAT.forEach(waktu => {
        const waktuDisplay = waktu.charAt(0).toUpperCase() + waktu.slice(1);
        html += `<div class="sholat-grid-cell waktu-label">${waktuDisplay}</div>`;

        sortedData.forEach(day => {
            const status = day[waktu];
            const icon = getStatusIcon(status);
            html += `<div class="sholat-grid-cell">${icon}</div>`;
        });
    });

    grid.innerHTML = html;
    console.log(`[SholatGrid] Rendered ${sortedData.length} days, ${columnCount} columns`);
}

function getStatusIcon(status) {
    if (!status) {
        return '<span class="status-icon empty">-</span>';
    }

    const icons = {
        'hadir': '<span class="status-icon hadir">✓</span>',
        'terlambat': '<span class="status-icon terlambat">⏱</span>',
        'tidak_hadir': '<span class="status-icon tidak_hadir">✗</span>',
        'izin': '<span class="status-icon izin">i</span>',
        'sakit': '<span class="status-icon sakit">s</span>'
    };

    return icons[status] || '<span class="status-icon empty">-</span>';
}

// ============================================
// IBADAH HISTORY
// ============================================
async function loadIbadahHistory(nisn, jenis = '') {
    const token = localStorage.getItem('access_token');
    const historyList = document.getElementById('history-list');

    const today = new Date();
    const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    let url = `${API_BASE}/kesantrian/ibadah/${nisn}/?start_date=${startStr}&end_date=${endStr}`;
    if (jenis) {
        url += `&jenis=${jenis}`;
    }

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            historyList.innerHTML = '<div class="loading-placeholder">Gagal memuat riwayat</div>';
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderHistoryList(data.data.slice(0, 20));
        } else {
            historyList.innerHTML = `
                <div class="loading-placeholder">
                    <span>Belum ada riwayat ibadah</span>
                </div>
            `;
        }

    } catch (error) {
        console.error('Load history error:', error);
        historyList.innerHTML = '<div class="loading-placeholder">Gagal memuat riwayat</div>';
    }
}

function renderHistoryList(items) {
    const historyList = document.getElementById('history-list');

    historyList.innerHTML = items.map(item => {
        const jenisDisplay = getJenisDisplay(item.jenis);
        const waktuDisplay = item.waktu ? ` (${item.waktu.charAt(0).toUpperCase() + item.waktu.slice(1)})` : '';
        const statusClass = item.status || 'hadir';
        const statusDisplay = getStatusDisplay(item.status);
        const dateDisplay = formatDate(item.tanggal);
        const icon = getJenisIcon(item.jenis);

        return `
            <div class="history-item">
                <div class="history-icon ${item.jenis}">${icon}</div>
                <div class="history-content">
                    <div class="history-title">${jenisDisplay}${waktuDisplay}</div>
                    <div class="history-sub">${item.catatan || 'Dicatat oleh ' + (item.pencatat || '-')}</div>
                </div>
                <div class="history-time">
                    <div>${dateDisplay}</div>
                    <span class="history-status ${statusClass}">${statusDisplay}</span>
                </div>
            </div>
        `;
    }).join('');
}

function getJenisDisplay(jenis) {
    const map = {
        'sholat_wajib': 'Sholat Wajib',
        'sholat_sunnah': 'Sholat Sunnah',
        'puasa': 'Puasa',
        'dzikir': 'Dzikir/Wirid',
        'tilawah': 'Tilawah Al-Quran'
    };
    return map[jenis] || jenis;
}

function getJenisIcon(jenis) {
    const icons = {
        'sholat_wajib': '🕌',
        'sholat_sunnah': '🌙',
        'puasa': '🍽️',
        'dzikir': '📿',
        'tilawah': '📖'
    };
    return icons[jenis] || '📋';
}

function getStatusDisplay(status) {
    const map = {
        'hadir': 'Hadir',
        'terlambat': 'Terlambat',
        'tidak_hadir': 'Tidak Hadir',
        'izin': 'Izin',
        'sakit': 'Sakit'
    };
    return map[status] || status || 'Hadir';
}

// ============================================
// HEATMAP CALENDAR (GitHub-style) - Fixed 90-Day Range
// ============================================
async function loadHeatmapData(nisn) {
    const token = localStorage.getItem('access_token');
    const heatmapGrid = document.getElementById('heatmap-grid');
    const heatmapMonths = document.getElementById('heatmap-months');

    if (!heatmapGrid) {
        console.warn('[Heatmap] Grid container not found');
        return;
    }

    // Calculate date range - EXACTLY 90 days back from today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to midnight

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89); // 90 days including today

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    console.log(`[Heatmap] Loading data from ${startStr} to ${endStr} (90 days)`);

    try {
        const response = await fetch(`${API_BASE}/kesantrian/ibadah/${nisn}/?start_date=${startStr}&end_date=${endStr}&jenis=sholat_wajib`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let apiData = [];

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                apiData = data.data;
            }
        }

        // ALWAYS generate 90-day grid, even with empty API data
        const dailyScores = calculateDailyScores(apiData, startDate, today);
        renderHeatmap(dailyScores, startDate, today);
        calculateHeatmapStats(dailyScores);

        if (apiData.length > 0) {
            calculateInsightComparison(apiData);
        }

    } catch (error) {
        console.error('[Heatmap] Load error:', error);

        // Still render empty 90-day grid on error
        const dailyScores = calculateDailyScores([], startDate, today);
        renderHeatmap(dailyScores, startDate, today);
        calculateHeatmapStats(dailyScores);
    }
}

function calculateDailyScores(ibadahData, startDate, endDate) {
    // Create a map of date -> count of hadir sholat
    const scoreMap = {};

    // Process API data if available
    if (ibadahData && Array.isArray(ibadahData)) {
        ibadahData.forEach(record => {
            if (record.status === 'hadir' || record.status === 'terlambat') {
                const date = record.tanggal;
                scoreMap[date] = (scoreMap[date] || 0) + 1;
            }
        });
    }

    // Build array of EXACTLY 90 days with scores (regardless of API data)
    const result = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0); // Normalize

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include full end day

    let dayCount = 0;
    const maxDays = 90; // Fixed 90 days

    while (current <= end && dayCount < maxDays) {
        const dateStr = current.toISOString().split('T')[0];
        result.push({
            date: dateStr,
            score: scoreMap[dateStr] || 0, // 0-5 for sholat wajib, 0 if no data
            dayOfWeek: current.getDay()
        });
        current.setDate(current.getDate() + 1);
        dayCount++;
    }

    console.log(`[Heatmap] Generated ${result.length} days from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    return result;
}

function renderHeatmap(dailyScores, startDate, endDate) {
    const heatmapGrid = document.getElementById('heatmap-grid');
    const heatmapMonths = document.getElementById('heatmap-months');

    if (!heatmapGrid || !heatmapMonths) {
        console.warn('[Heatmap] Grid or months container not found');
        return;
    }

    if (!dailyScores || dailyScores.length === 0) {
        heatmapGrid.innerHTML = '<div class="loading-placeholder">Tidak ada data</div>';
        return;
    }

    // Build month labels - track each month change with proper week calculation
    const months = [];
    let currentMonth = -1;
    const firstDayOfWeek = dailyScores[0]?.dayOfWeek || 0;

    dailyScores.forEach((day, idx) => {
        const date = new Date(day.date);
        const month = date.getMonth();

        // Calculate which week column this day is in
        const cellIndex = firstDayOfWeek + idx;
        const currentWeek = Math.floor(cellIndex / 7);

        if (month !== currentMonth) {
            months.push({
                month: BULAN_NAMES[month],
                weekStart: currentWeek,
                position: idx
            });
            currentMonth = month;
        }
    });

    // Calculate total weeks for proper width distribution
    const totalCells = firstDayOfWeek + dailyScores.length;
    const totalWeeks = Math.ceil(totalCells / 7);

    // Render month labels with dynamic width based on weeks covered
    heatmapMonths.innerHTML = months.map((m, i) => {
        let weekSpan;
        if (i < months.length - 1) {
            weekSpan = months[i + 1].weekStart - m.weekStart;
        } else {
            weekSpan = totalWeeks - m.weekStart;
        }
        // Each week column is ~17px (12px cell + 5px gap)
        const width = Math.max(weekSpan * 17, 30);
        return `<span style="min-width: ${width}px; text-align: left;">${m.month}</span>`;
    }).join('');

    // Build heatmap cells
    // GitHub style: 7 rows (days of week), columns are weeks
    let html = '';

    // Add VISIBLE placeholder cells for alignment (level-0, no tooltip)
    // These fill the gap before the first actual day
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div class="heatmap-cell level-0 placeholder-cell"></div>';
    }

    // Add actual data cells - ALWAYS render with level-0 if no data
    dailyScores.forEach(day => {
        const level = getHeatmapLevel(day.score);
        const dateFormatted = formatDateLong(day.date);
        const tooltip = day.score > 0
            ? `${dateFormatted}: ${day.score}/5 sholat`
            : `${dateFormatted}: Tidak ada data`;

        html += `<div class="heatmap-cell level-${level}" data-date="${day.date}" data-tooltip="${tooltip}"></div>`;
    });

    heatmapGrid.innerHTML = html;
    console.log(`[Heatmap] Rendered ${dailyScores.length} cells + ${firstDayOfWeek} padding = ${totalCells} total, ${totalWeeks} weeks`);
}

function getHeatmapLevel(score) {
    // score is 0-5 (number of sholat wajib hadir)
    if (score === 0) return 0;
    if (score <= 1) return 1;
    if (score <= 2) return 2;
    if (score <= 4) return 3;
    return 4; // 5 = perfect
}

function calculateHeatmapStats(dailyScores) {
    // Total hadir
    const totalHadir = dailyScores.reduce((sum, day) => sum + day.score, 0);
    document.getElementById('total-hadir-90').textContent = totalHadir;

    // Calculate best streak (consecutive days with score >= 3)
    let currentStreak = 0;
    let bestStreak = 0;

    dailyScores.forEach(day => {
        if (day.score >= 3) {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    document.getElementById('streak-terbaik').textContent = `${bestStreak} hari`;

    // Average per week
    const weeks = Math.ceil(dailyScores.length / 7);
    const avgPerWeek = weeks > 0 ? Math.round(totalHadir / weeks) : 0;
    document.getElementById('avg-per-minggu').textContent = avgPerWeek;
}

function calculateInsightComparison(ibadahData) {
    const insightTitle = document.getElementById('insight-title');
    const insightDesc = document.getElementById('insight-desc');
    const insightIcon = document.querySelector('.insight-icon');

    // Get this week's data
    const today = new Date();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    // Count hadir for this week and last week
    let thisWeekCount = 0;
    let lastWeekCount = 0;

    ibadahData.forEach(record => {
        const recordDate = new Date(record.tanggal);
        if (record.status === 'hadir' || record.status === 'terlambat') {
            if (recordDate >= thisWeekStart && recordDate <= today) {
                thisWeekCount++;
            } else if (recordDate >= lastWeekStart && recordDate <= lastWeekEnd) {
                lastWeekCount++;
            }
        }
    });

    // Calculate percentage change
    let percentChange = 0;
    if (lastWeekCount > 0) {
        percentChange = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
    } else if (thisWeekCount > 0) {
        percentChange = 100;
    }

    // Update insight card
    if (percentChange > 0) {
        insightIcon.textContent = '📈';
        insightTitle.innerHTML = `Kedisiplinan Sholat Ananda <span class="trend-up">naik ${percentChange}%</span> dibanding pekan lalu`;
        insightDesc.textContent = `Pekan ini: ${thisWeekCount} sholat hadir | Pekan lalu: ${lastWeekCount} sholat hadir`;
    } else if (percentChange < 0) {
        insightIcon.textContent = '📉';
        insightTitle.innerHTML = `Kedisiplinan Sholat Ananda <span class="trend-down">turun ${Math.abs(percentChange)}%</span> dibanding pekan lalu`;
        insightDesc.textContent = `Pekan ini: ${thisWeekCount} sholat hadir | Pekan lalu: ${lastWeekCount} sholat hadir. Mari tingkatkan lagi!`;
    } else {
        insightIcon.textContent = '📊';
        insightTitle.innerHTML = `Kedisiplinan Sholat Ananda <span class="trend-neutral">stabil</span> seperti pekan lalu`;
        insightDesc.textContent = `Pekan ini: ${thisWeekCount} sholat hadir. Pertahankan dan tingkatkan!`;
    }
}

function formatDateLong(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('id-ID', options);
}

// ============================================
// FILTER HANDLERS
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Period filter
    const periodFilter = document.getElementById('filter-period');
    if (periodFilter) {
        periodFilter.addEventListener('change', (e) => {
            if (selectedChild) {
                loadWeeklySholat(selectedChild.nisn, parseInt(e.target.value));
            }
        });
    }

    // Jenis filter
    const jenisFilter = document.getElementById('filter-jenis');
    if (jenisFilter) {
        jenisFilter.addEventListener('change', (e) => {
            if (selectedChild) {
                loadIbadahHistory(selectedChild.nisn, e.target.value);
            }
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('id-ID', options);
}

function showNoChildrenState() {
    const container = document.getElementById('child-selector');
    container.innerHTML = `
        <div class="child-tab" style="background: #fef2f2; border-color: #fecaca;">
            <div class="child-avatar" style="background: #fca5a5;">!</div>
            <div class="child-info">
                <h4 style="color: #dc2626;">Tidak ada anak terhubung</h4>
                <span>Hubungi admin untuk menghubungkan data anak</span>
            </div>
        </div>
    `;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    if (toast && msgEl) {
        msgEl.textContent = message;
        toast.className = `toast active ${type}`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
}
