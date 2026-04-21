/**
 * Hafalan Dashboard JavaScript - Executive Dashboard
 * Manager view for hafalan progress monitoring
 * v=20260326E - FIXED: Auth timeout race condition (localStorage polling)
 *
 * Features:
 * - Safe fetch with try-catch-finally
 * - localStorage polling for auth (no custom events needed)
 * - Auto-fetch dari API /api/kesantrian/hafalan/dashboard-stats/
 * - Summary Cards dengan animasi nilai
 * - Leaderboard Top 5 dengan FontAwesome medals
 * - Chart.js Bar Chart interaktif
 */

(function() {
    'use strict';

    // ============================================
    // GLOBALS
    // ============================================
    let chartCapaianKelas = null;
    let chartDistribusi = null;
    let dashboardData = null;
    let allStudentData = [];
    let currentPage = 1;
    const itemsPerPage = 10;
    let isInitialized = false;

    // ============================================
    // HEADER DATE INITIALIZATION
    // ============================================
    function initializeHeaderDate() {
        const dateEl = document.getElementById('topbar-date');
        if (!dateEl) return;

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date().toLocaleDateString('id-ID', options);
        dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${today}`;
    }

    // ============================================
    // INITIALIZATION - DOMContentLoaded
    // ============================================
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[HafalanDashboard] 🚀 DOM Ready, starting initialization...');

        // Initialize header date immediately (no API dependency)
        initializeHeaderDate();

        // Show loading state immediately
        showLoadingState();

        // Wait for auth data and initialize
        waitForAuthAndInit();
    });

    /**
     * Wait for auth data to be available in localStorage.
     * Uses polling instead of custom events (auth-check.js uses localStorage).
     *
     * Flow:
     * 1. Check if localStorage already has user_role (from previous session or auth-check.js)
     * 2. If yes, proceed immediately
     * 3. If no, poll every 100ms up to 3 seconds max
     */
    function waitForAuthAndInit() {
        const maxWaitTime = 3000; // 3 seconds max
        const pollInterval = 100; // Check every 100ms
        let elapsed = 0;

        function checkAndInit() {
            // Check if user data is available in localStorage
            const userRole = localStorage.getItem('user_role');
            const accessToken = localStorage.getItem('access_token');

            if (userRole && accessToken) {
                console.log('[HafalanDashboard] ✅ Auth data found in localStorage, initializing...');
                initDashboard();
                return;
            }

            // Keep polling until max time reached
            elapsed += pollInterval;
            if (elapsed < maxWaitTime) {
                setTimeout(checkAndInit, pollInterval);
            } else {
                // Timeout - try to initialize anyway (might have cached data)
                console.warn('[HafalanDashboard] ⚠️ Auth wait timeout, attempting init with available data...');
                initDashboard();
            }
        }

        // Start checking immediately
        checkAndInit();
    }

    /**
     * Initialize Dashboard after auth check
     */
    async function initDashboard() {
        if (isInitialized) {
            console.log('[HafalanDashboard] Already initialized, skipping...');
            return;
        }
        isInitialized = true;

        console.log('[HafalanDashboard] 🎯 Starting dashboard initialization...');

        try {
            // Check role access (with fallback)
            const user = window.currentUser || {};
            const userRole = user.role || localStorage.getItem('user_role') || '';

            console.log('[HafalanDashboard] 👤 User role:', userRole);

            const allowedRoles = ['superadmin', 'pimpinan'];

            if (userRole && !allowedRoles.includes(userRole)) {
                console.warn('[HafalanDashboard] ⛔ Unauthorized role:', userRole);
                showError('Akses ditolak. Halaman ini hanya untuk Pimpinan.');
                return;
            }

            // Set up event listeners
            setupEventListeners();

            // Fetch and render dashboard data
            await loadDashboardData();

        } catch (error) {
            console.error('[HafalanDashboard] ❌ Init error:', error);
            showError('Terjadi kesalahan saat memuat dashboard: ' + error.message);
        }
    }

    /**
     * Show loading state on all components
     */
    function showLoadingState() {
        // Summary cards
        ['stat-khatam', 'stat-avg-juz', 'stat-aktif'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="loading-pulse">...</span>';
        });

        // Badge
        const badge = document.getElementById('badge-avg-status');
        if (badge) badge.textContent = 'Memuat...';

        // Leaderboard
        const leaderboard = document.getElementById('top-santri-list');
        if (leaderboard) {
            leaderboard.innerHTML = `
                <li class="leaderboard-loading"><div class="skeleton-avatar"></div><div class="skeleton-text"></div></li>
                <li class="leaderboard-loading"><div class="skeleton-avatar"></div><div class="skeleton-text"></div></li>
                <li class="leaderboard-loading"><div class="skeleton-avatar"></div><div class="skeleton-text"></div></li>
            `;
        }
    }

    /**
     * Hide all loading states
     */
    function hideLoadingState() {
        // Remove pulse animation from cards
        ['stat-khatam', 'stat-avg-juz', 'stat-aktif'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.querySelector('.loading-pulse')) {
                el.textContent = '-';
            }
        });

        // Update badge
        const badge = document.getElementById('badge-avg-status');
        if (badge && badge.textContent === 'Memuat...') {
            badge.textContent = '-';
        }
    }

    // ============================================
    // SAFE FETCH - loadDashboardData()
    // ============================================
    async function loadDashboardData(kelasFilter = '') {
        console.log('[HafalanDashboard] 📡 Loading dashboard data...');

        try {
            // Build API URL
            let url = 'kesantrian/hafalan/dashboard-stats/';
            if (kelasFilter) {
                url += `?kelas=${encodeURIComponent(kelasFilter)}`;
            }

            // Check if apiFetch exists
            if (typeof window.apiFetch !== 'function') {
                console.error('[HafalanDashboard] ❌ window.apiFetch not available!');
                throw new Error('API tidak tersedia. Silakan refresh halaman.');
            }

            // Fetch with apiFetch wrapper
            const rawResponse = await window.apiFetch(url);

            // Check response validity
            if (!rawResponse) {
                throw new Error('Tidak ada response dari server');
            }

            if (!rawResponse.ok) {
                const errorText = await rawResponse.text().catch(() => '');
                console.error('[HafalanDashboard] ❌ API Error:', rawResponse.status, errorText);
                throw new Error(`Server error (${rawResponse.status})`);
            }

            // Parse JSON
            const response = await rawResponse.json();
            console.log('[HafalanDashboard] 📦 API Response:', response);

            if (!response.success) {
                throw new Error(response.message || 'API mengembalikan error');
            }

            // Store data globally
            dashboardData = response.data;
            allStudentData = dashboardData.top_performers || [];

            // ===== RENDER UI COMPONENTS =====
            renderSummaryCards(dashboardData);
            renderLeaderboard(dashboardData.top_performers || []);

            if (typeof Chart !== 'undefined') {
                renderChartCapaianKelas(dashboardData.chart_capaian_kelas || []);
                renderChartDistribusi(dashboardData.distribution || {});
            } else {
                console.warn('[HafalanDashboard] ⚠️ Chart.js not loaded');
            }

            renderGlobalTable(dashboardData);
            populateKelasDropdown(dashboardData.chart_capaian_kelas || []);

            console.log('[HafalanDashboard] ✅ Dashboard loaded successfully!');

        } catch (error) {
            console.error('[HafalanDashboard] ❌ Fetch Error:', error);
            showErrorAlert('Gagal memuat data: ' + error.message);
        } finally {
            // ALWAYS hide loading state, even on error
            hideLoadingState();
            console.log('[HafalanDashboard] 🏁 Loading complete (finally block)');
        }
    }

    // ============================================
    // RENDER SUMMARY CARDS
    // ============================================
    function renderSummaryCards(data) {
        console.log('[HafalanDashboard] 💳 Rendering summary cards...');

        // Card 1: Total Hafizh (Khatam 30 Juz)
        const totalKhatam = data.total_khatam || 0;
        animateCounter('stat-khatam', totalKhatam);

        // Update trend
        const trendKhatam = document.getElementById('trend-khatam');
        if (trendKhatam) {
            trendKhatam.textContent = totalKhatam > 0 ? `${totalKhatam} santri` : '0 santri';
        }

        // Card 2: Rata-rata Capaian Sekolah
        const avgJuz = data.avg_juz_sekolah || 0;
        const avgJuzEl = document.getElementById('stat-avg-juz');
        if (avgJuzEl) {
            avgJuzEl.innerHTML = `<span class="counter-value">${avgJuz.toFixed(1)}</span> <small>Juz</small>`;
        }
        updateAvgStatusBadge(avgJuz);

        // Card 3: Santri Aktif
        const totalSantri = data.total_santri_aktif || 0;
        animateCounter('stat-aktif', totalSantri);

        // Update progress bar
        const distribution = data.distribution || {};
        const santriSudahSetor = totalSantri - (distribution.below_5 || 0);
        const progressPct = totalSantri > 0 ? Math.round((santriSudahSetor / totalSantri) * 100) : 0;

        const progressFill = document.getElementById('progress-aktif');
        const progressText = document.getElementById('progress-text-aktif');
        if (progressFill) {
            progressFill.style.width = '0%';
            setTimeout(() => { progressFill.style.width = progressPct + '%'; }, 100);
        }
        if (progressText) {
            progressText.textContent = `${progressPct}% sudah menyetor`;
        }
    }

    /**
     * Animate counter from 0 to target value
     */
    function animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const duration = 800;
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(targetValue * easeOut);

            element.textContent = currentValue.toLocaleString('id-ID');

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    /**
     * Update average status badge
     */
    function updateAvgStatusBadge(avgJuz) {
        const badge = document.getElementById('badge-avg-status');
        if (!badge) return;

        let text, bgGradient, textColor;

        if (avgJuz >= 20) {
            text = '🌟 Istimewa';
            bgGradient = 'linear-gradient(135deg, #fef3c7, #fde68a)';
            textColor = '#92400e';
        } else if (avgJuz >= 15) {
            text = '✨ Sangat Baik';
            bgGradient = 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
            textColor = '#065f46';
        } else if (avgJuz >= 10) {
            text = '👍 Baik';
            bgGradient = 'linear-gradient(135deg, #eff6ff, #dbeafe)';
            textColor = '#1d4ed8';
        } else if (avgJuz >= 5) {
            text = '📈 Cukup';
            bgGradient = 'linear-gradient(135deg, #fffbeb, #fef3c7)';
            textColor = '#92400e';
        } else {
            text = '⚠️ Perlu Ditingkatkan';
            bgGradient = 'linear-gradient(135deg, #fef2f2, #fee2e2)';
            textColor = '#b91c1c';
        }

        badge.textContent = text;
        badge.style.background = bgGradient;
        badge.style.color = textColor;
    }

    // ============================================
    // RENDER LEADERBOARD TOP 5
    // ============================================
    function renderLeaderboard(topSantri) {
        console.log('[HafalanDashboard] 🏆 Rendering leaderboard...');

        const container = document.getElementById('top-santri-list');
        if (!container) return;

        if (!topSantri || topSantri.length === 0) {
            container.innerHTML = `
                <li class="leaderboard-empty">
                    <div class="empty-icon">📖</div>
                    <div class="empty-text">Belum ada data hafalan</div>
                </li>
            `;
            return;
        }

        // Take only top 5
        const top5 = topSantri.slice(0, 5);

        // FontAwesome medal icons
        const medalIcons = [
            '<i class="fas fa-medal" style="color: #fbbf24; font-size: 1.25rem;"></i>',
            '<i class="fas fa-medal" style="color: #9ca3af; font-size: 1.25rem;"></i>',
            '<i class="fas fa-medal" style="color: #f97316; font-size: 1.25rem;"></i>'
        ];

        container.innerHTML = top5.map((santri, index) => {
            const initials = getInitials(santri.nama);
            const isTopThree = index < 3;
            const rankDisplay = isTopThree ? medalIcons[index] : `<span class="rank-number">${index + 1}</span>`;
            const rankClass = isTopThree ? `rank-${index + 1}` : 'rank-other';

            let juzBadgeClass = 'juz-normal';
            if (santri.tercapai_juz >= 30) juzBadgeClass = 'juz-khatam';
            else if (santri.tercapai_juz >= 20) juzBadgeClass = 'juz-excellent';
            else if (santri.tercapai_juz >= 10) juzBadgeClass = 'juz-good';

            return `
                <li class="leaderboard-item ${isTopThree ? 'top-three' : ''}">
                    <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
                    <div class="leaderboard-avatar">${initials}</div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name" title="${santri.nama}">${santri.nama}</div>
                        <div class="leaderboard-class"><i class="fas fa-graduation-cap"></i> ${santri.kelas || '-'}</div>
                    </div>
                    <div class="leaderboard-juz ${juzBadgeClass}">
                        ${santri.tercapai_juz >= 30 ? '🏆 ' : ''}${santri.tercapai_juz} Juz
                    </div>
                </li>
            `;
        }).join('');

        // Entrance animation
        const items = container.querySelectorAll('.leaderboard-item');
        items.forEach((item, i) => {
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            }, 100 * (i + 1));
        });
    }

    // ============================================
    // RENDER CHART: CAPAIAN PER KELAS
    // ============================================
    function renderChartCapaianKelas(chartData) {
        console.log('[HafalanDashboard] 📊 Rendering bar chart...');

        if (chartCapaianKelas) {
            chartCapaianKelas.destroy();
            chartCapaianKelas = null;
        }

        const canvas = document.getElementById('chartCapaianKelas');
        if (!canvas) {
            console.warn('[HafalanDashboard] Canvas #chartCapaianKelas not found');
            return;
        }

        const ctx = canvas.getContext('2d');

        if (!chartData || chartData.length === 0) {
            ctx.font = '14px Plus Jakarta Sans, sans-serif';
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'center';
            ctx.fillText('Belum ada data per kelas', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labels = chartData.map(k => k.kelas);
        const dataValues = chartData.map(k => k.avg_juz);
        const studentCounts = chartData.map(k => k.total_siswa);

        const barColors = chartData.map((_, i) => `hsla(${150 + (i * 15)}, 70%, 40%, 0.85)`);
        const hoverColors = chartData.map((_, i) => `hsla(${150 + (i * 15)}, 80%, 35%, 1)`);

        chartCapaianKelas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rata-rata Hafalan (Juz)',
                    data: dataValues,
                    backgroundColor: barColors,
                    hoverBackgroundColor: hoverColors,
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(31, 41, 55, 0.95)',
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            title: (items) => `📚 Kelas ${items[0].label}`,
                            label: (ctx) => [
                                `Rata-rata: ${ctx.raw.toFixed(1)} Juz`,
                                `Total Siswa: ${studentCounts[ctx.dataIndex]} santri`
                            ]
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 30,
                        ticks: { stepSize: 5, callback: v => v + ' Juz' },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // ============================================
    // RENDER CHART: DISTRIBUSI
    // ============================================
    function renderChartDistribusi(distribution) {
        console.log('[HafalanDashboard] 🥧 Rendering distribution chart...');

        if (chartDistribusi) {
            chartDistribusi.destroy();
            chartDistribusi = null;
        }

        const canvas = document.getElementById('chartDistribusi');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const labels = ['Khatam (30 Juz)', '15-29 Juz', '10-14 Juz', '5-9 Juz', '< 5 Juz'];
        const data = [
            distribution.khatam || 0,
            distribution.above_15 || 0,
            distribution.above_10 || 0,
            distribution.above_5 || 0,
            distribution.below_5 || 0
        ];
        const colors = ['#fbbf24', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444'];

        chartDistribusi = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                                return `${ctx.raw} santri (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });

        // Update legend
        const legendContainer = document.getElementById('legend-distribusi');
        if (legendContainer) {
            legendContainer.innerHTML = labels.map((label, i) => `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${colors[i]}"></div>
                    <span>${label}: <strong>${data[i]}</strong></span>
                </div>
            `).join('');
        }
    }

    // ============================================
    // RENDER GLOBAL TABLE
    // ============================================
    function renderGlobalTable(data) {
        console.log('[HafalanDashboard] 📋 Rendering global table...');

        const tbody = document.getElementById('table-rekap-body');
        if (!tbody) return;

        const students = data.top_performers || [];

        if (students.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="table-empty-state">
                        <div class="empty-icon">📖</div>
                        <div class="empty-text">Belum ada data rekapitulasi</div>
                    </td>
                </tr>
            `;
            updateTableInfo(0, 0);
            return;
        }

        allStudentData = students;
        renderTablePage(1);
        updateTableInfo(Math.min(itemsPerPage, students.length), students.length);
    }

    function renderTablePage(page) {
        const tbody = document.getElementById('table-rekap-body');
        if (!tbody || !allStudentData.length) return;

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = allStudentData.slice(start, end);

        tbody.innerHTML = pageData.map((santri, index) => {
            const rank = start + index + 1;
            const target = 30;
            const tercapai = santri.tercapai_juz || 0;
            const progressPct = Math.min((tercapai / target) * 100, 100);
            const progressClass = progressPct >= 80 ? 'high' : progressPct >= 40 ? 'medium' : 'low';

            let statusBadge = '';
            if (tercapai >= 30) statusBadge = '<span class="status-badge khatam"><i class="fas fa-trophy"></i> Khatam</span>';
            else if (tercapai >= 15) statusBadge = '<span class="status-badge on-track"><i class="fas fa-check-circle"></i> On Track</span>';
            else if (tercapai >= 5) statusBadge = '<span class="status-badge baru"><i class="fas fa-clock"></i> Proses</span>';
            else statusBadge = '<span class="status-badge behind"><i class="fas fa-hourglass-start"></i> Baru</span>';

            return `
                <tr>
                    <td class="td-rank">${rank}</td>
                    <td>${santri.nisn || '-'}</td>
                    <td><strong>${santri.nama}</strong></td>
                    <td>${santri.kelas || '-'}</td>
                    <td class="td-center">${target}</td>
                    <td class="td-center"><strong>${tercapai}</strong></td>
                    <td>
                        <div class="table-progress">
                            <div class="table-progress-bar">
                                <div class="table-progress-fill ${progressClass}" style="width: ${progressPct}%"></div>
                            </div>
                            <span class="table-progress-text">${Math.round(progressPct)}%</span>
                        </div>
                    </td>
                    <td class="td-center">${statusBadge}</td>
                    <td class="td-center">
                        <button class="btn-table-action" onclick="viewSantriDetail('${santri.nisn}')" title="Lihat Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        currentPage = page;
        renderPagination();
    }

    function renderPagination() {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const totalPages = Math.ceil(allStudentData.length / itemsPerPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToTablePage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (totalPages > 7) {
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToTablePage(${i})">${i}</button>`;
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                    html += `<span class="pagination-ellipsis">...</span>`;
                }
            } else {
                html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToTablePage(${i})">${i}</button>`;
            }
        }

        html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToTablePage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;

        container.innerHTML = html;
    }

    function updateTableInfo(showing, total) {
        const showingEl = document.getElementById('showing-count');
        const totalEl = document.getElementById('total-count');
        if (showingEl) showingEl.textContent = showing;
        if (totalEl) totalEl.textContent = total;
    }

    function filterTableData(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            allStudentData = dashboardData?.top_performers || [];
        } else {
            const term = searchTerm.toLowerCase().trim();
            allStudentData = (dashboardData?.top_performers || []).filter(s =>
                s.nama?.toLowerCase().includes(term) ||
                s.kelas?.toLowerCase().includes(term) ||
                s.nisn?.toLowerCase().includes(term)
            );
        }
        renderTablePage(1);
        updateTableInfo(Math.min(itemsPerPage, allStudentData.length), allStudentData.length);
    }

    // ============================================
    // POPULATE KELAS DROPDOWN
    // ============================================
    function populateKelasDropdown(kelasData) {
        const select = document.getElementById('filter-kelas');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">📚 Semua Kelas</option>';

        if (kelasData && kelasData.length > 0) {
            kelasData.forEach(k => {
                const option = document.createElement('option');
                option.value = k.kelas;
                option.textContent = k.kelas;
                select.appendChild(option);
            });
        }

        if (currentValue) select.value = currentValue;
    }

    // ============================================
    // EVENT LISTENERS SETUP
    // ============================================
    function setupEventListeners() {
        document.getElementById('filter-kelas')?.addEventListener('change', function() {
            console.log('[HafalanDashboard] 🔍 Filter kelas:', this.value || 'ALL');
            loadDashboardData(this.value);
        });

        document.getElementById('chart-filter-semester')?.addEventListener('change', function() {
            console.log('[HafalanDashboard] 📅 Semester filter:', this.value);
        });

        const searchTable = document.getElementById('search-table');
        if (searchTable) {
            let debounceTimer;
            searchTable.addEventListener('input', function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => filterTableData(this.value), 300);
            });
        }

        document.getElementById('btn-export')?.addEventListener('click', exportSummaryData);
        document.getElementById('btn-export-table')?.addEventListener('click', exportTableToCSV);
        document.getElementById('btn-refresh-table')?.addEventListener('click', () => loadDashboardData());

        document.getElementById('btn-view-all-santri')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') closeModal();
        });
    }

    // ============================================
    // EXPORT FUNCTIONS
    // ============================================
    function exportSummaryData() {
        if (!dashboardData) {
            alert('⚠️ Data belum dimuat.');
            return;
        }

        const kelasData = dashboardData.chart_capaian_kelas || [];
        let csv = 'Kelas,Total Siswa,Rata-rata Juz\n';
        kelasData.forEach(k => {
            csv += `"${k.kelas}",${k.total_siswa},${k.avg_juz.toFixed(1)}\n`;
        });

        downloadCSV(csv, 'hafalan-per-kelas');
    }

    function exportTableToCSV() {
        if (!allStudentData.length) {
            alert('⚠️ Tidak ada data untuk diexport.');
            return;
        }

        let csv = 'No,NISN,Nama Santri,Kelas,Tercapai (Juz),Status\n';
        allStudentData.forEach((s, i) => {
            let status = s.tercapai_juz >= 30 ? 'Khatam' : s.tercapai_juz >= 15 ? 'On Track' : s.tercapai_juz >= 5 ? 'Proses' : 'Baru';
            csv += `${i + 1},"${s.nisn || ''}","${s.nama}","${s.kelas || ''}",${s.tercapai_juz},"${status}"\n`;
        });

        downloadCSV(csv, 'rekapitulasi-hafalan');
    }

    function downloadCSV(csvContent, filename) {
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // ============================================
    // MODAL FUNCTIONS
    // ============================================
    function viewSantriDetail(nisn) {
        const santri = allStudentData.find(s => s.nisn === nisn);
        if (!santri) return;

        const modalBody = document.getElementById('modal-body-content');
        if (!modalBody) return;

        const initials = getInitials(santri.nama);
        const tercapai = santri.tercapai_juz || 0;
        const sisa = 30 - tercapai;
        const progressPct = Math.min((tercapai / 30) * 100, 100);

        modalBody.innerHTML = `
            <div class="modal-santri-header">
                <div class="modal-avatar">${initials}</div>
                <div class="modal-santri-info">
                    <h3 class="modal-santri-name">${santri.nama}</h3>
                    <p class="modal-santri-meta">
                        <i class="fas fa-graduation-cap"></i> ${santri.kelas || '-'} |
                        <i class="fas fa-id-card"></i> ${santri.nisn || '-'}
                    </p>
                </div>
            </div>
            <div class="modal-stats-grid">
                <div class="modal-stat-box success">
                    <div class="modal-stat-value">${tercapai}</div>
                    <div class="modal-stat-label">Juz Tercapai</div>
                </div>
                <div class="modal-stat-box info">
                    <div class="modal-stat-value">${sisa}</div>
                    <div class="modal-stat-label">Sisa Target</div>
                </div>
                <div class="modal-stat-box warning">
                    <div class="modal-stat-value">${Math.round(progressPct)}%</div>
                    <div class="modal-stat-label">Progress</div>
                </div>
            </div>
            <div class="modal-progress-section">
                <div class="modal-progress-label">Progress menuju Khatam</div>
                <div class="modal-progress-bar">
                    <div class="modal-progress-fill" style="width: ${progressPct}%"></div>
                </div>
                <div class="modal-progress-info">
                    ${tercapai >= 30 ? '🏆 <strong>Alhamdulillah, sudah Khatam!</strong>' : `Tinggal <strong>${sisa} Juz</strong> lagi`}
                </div>
            </div>
        `;

        document.getElementById('modal-overlay')?.classList.add('show');
    }

    function closeModal() {
        document.getElementById('modal-overlay')?.classList.remove('show');
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function getInitials(name) {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length === 1) return words[0].charAt(0).toUpperCase();
        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    function showError(message) {
        hideLoadingState();
        const container = document.querySelector('.page-body');
        if (container) {
            container.innerHTML = `
                <div class="dashboard-error">
                    <div class="error-icon">⚠️</div>
                    <h3 class="error-title">Terjadi Kesalahan</h3>
                    <p class="error-message">${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Muat Ulang
                    </button>
                </div>
            `;
        }
    }

    function showErrorAlert(message) {
        // Show inline error alert without replacing entire content
        const container = document.querySelector('.page-body');
        if (container) {
            const alert = document.createElement('div');
            alert.className = 'alert-error';
            alert.innerHTML = `
                <span>⚠️ ${message}</span>
                <button onclick="this.parentElement.remove()">✕</button>
            `;
            container.insertBefore(alert, container.firstChild);

            // Auto remove after 5 seconds
            setTimeout(() => alert.remove(), 5000);
        }
    }

    // ============================================
    // EXPOSE GLOBAL FUNCTIONS
    // ============================================
    window.viewSantriDetail = viewSantriDetail;
    window.closeModal = closeModal;
    window.goToTablePage = function(page) {
        const totalPages = Math.ceil(allStudentData.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            renderTablePage(page);
            const showing = Math.min(itemsPerPage, allStudentData.length - (page - 1) * itemsPerPage);
            updateTableInfo(showing, allStudentData.length);
        }
    };

})();
