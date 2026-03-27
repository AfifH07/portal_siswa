/**
 * Dashboard Parent (Wali Santri) - Portal Ponpes Baron v2.3
 * Bento UI Dashboard with Donut Charts & BLP Integration
 */

// ============================================
// GLOBALS
// ============================================
let currentUser = null;
let selectedChild = null;
let childrenData = [];
let donutCharts = {};

const API_BASE = '/api';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Skip initialization on admin pages
    if (window.isAdminPage && window.isAdminPage()) {
        console.log('[Dashboard-Parent] Admin page detected, skipping init');
        return;
    }

    updateDate();

    // Wait a small delay to ensure localStorage is fully synced after login
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        await checkAuth();
        await loadDashboardData();
    } catch (error) {
        console.error('[Dashboard-Parent] Init error:', error);
        showToast('Gagal memuat dashboard', 'error');
    }
});

function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const dateEl = document.getElementById('topbar-date');
    if (dateEl) dateEl.textContent = `📅 ${dateStr}`;
}

async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.warn('[Dashboard] No access token found');
        window.location.href = '/login';
        return;
    }

    try {
        // Use apiFetch if available, fallback to direct fetch
        let response;
        if (window.apiFetch) {
            response = await window.apiFetch('users/me/');
        } else {
            response = await fetch(`${API_BASE}/users/me/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        // apiFetch returns null on auth failure (already handled redirect)
        if (!response) {
            console.warn('[Dashboard] apiFetch returned null - auth handled');
            return;
        }

        if (!response.ok) {
            // Don't immediately kick out - could be temporary server error
            console.error('[Dashboard] Auth check failed:', response.status);
            if (response.status === 401) {
                // Only redirect on 401 if we don't have cached user data
                const cachedUser = localStorage.getItem('user');
                if (!cachedUser) {
                    window.location.href = '/login';
                    return;
                }
                // Use cached data
                currentUser = JSON.parse(cachedUser);
                console.warn('[Dashboard] Using cached user data');
            } else {
                throw new Error('Server error');
            }
        } else {
            currentUser = await response.json();
            // Update cache
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        if (currentUser.role !== 'walisantri') {
            showToast('Akses ditolak. Halaman ini untuk Wali Santri.', 'error');
            setTimeout(() => window.location.href = '/dashboard', 2000);
            return;
        }

        // Update UI elements safely
        const nameEl = document.getElementById('user-name') || document.getElementById('user-name-display');
        const avatarEl = document.getElementById('user-avatar') || document.getElementById('user-avatar-initials');

        if (nameEl) nameEl.textContent = currentUser.name || currentUser.username;
        if (avatarEl) avatarEl.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();

    } catch (error) {
        console.error('[Dashboard] Auth error:', error);

        // DON'T immediately kick out - try to use cached data
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
            console.warn('[Dashboard] Using cached user data due to error');
            currentUser = JSON.parse(cachedUser);
            return;
        }

        // Only redirect if we truly have no user data
        window.location.href = '/login';
    }
}

// ============================================
// LOAD DASHBOARD DATA
// ============================================
async function loadDashboardData() {
    try {
        // Load children summary
        await loadChildrenData();

        if (childrenData.length > 0) {
            selectChild(childrenData[0].nisn);
        }

        // Initialize clickable cards
        initClickableCards();
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('Gagal memuat data dashboard', 'error');
    }
}

async function loadChildrenData() {
    const token = localStorage.getItem('access_token');

    if (!token) {
        console.warn('[Dashboard] No token for loadChildrenData');
        showNoChildrenState();
        return;
    }

    try {
        // Use apiFetch if available for better error handling
        let response;
        if (window.apiFetch) {
            response = await window.apiFetch('kesantrian/my-children-summary/');
        } else {
            response = await fetch(`${API_BASE}/kesantrian/my-children-summary/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        // apiFetch returns null on auth failure - don't kick user, just show empty state
        if (!response) {
            console.warn('[Dashboard] loadChildrenData - response is null, showing empty state');
            showNoChildrenState();
            return;
        }

        if (!response.ok) {
            console.warn('[Dashboard] loadChildrenData failed:', response.status);
            // Don't kick user out on API errors - just show empty state
            showNoChildrenState();
            return;
        }

        const data = await response.json();

        if (data.success && data.children) {
            childrenData = data.children;
            renderChildSelector();
            updateSidebarUserInfo();
        } else {
            showNoChildrenState();
        }
    } catch (error) {
        console.error('[Dashboard] Load children error:', error);
        // Don't kick user out - just show empty state
        showNoChildrenState();
    }
}

function updateSidebarUserInfo() {
    // Update children count in sidebar
    const childrenEl = document.getElementById('user-children');
    if (childrenEl && childrenData.length > 0) {
        const count = childrenData.length;
        childrenEl.textContent = `${count} Anak Terdaftar`;
        childrenEl.style.display = 'block';

        // Store in localStorage for other pages
        localStorage.setItem('children_count', count);
    }

    // Also update via createRoleBasedNav if available
    if (typeof window.createRoleBasedNav === 'function') {
        window.createRoleBasedNav();
    }
}

function renderChildSelector() {
    const container = document.getElementById('child-selector');

    if (childrenData.length === 0) {
        container.innerHTML = `
            <div class="child-tab" style="background: #fef2f2; border-color: #fecaca;">
                <div class="child-avatar" style="background: #fca5a5;">!</div>
                <div class="child-info">
                    <h4 style="color: #dc2626;">Tidak ada anak terhubung</h4>
                    <span>Hubungi admin untuk menghubungkan data anak</span>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = childrenData.map((child, idx) => `
        <div class="child-tab ${idx === 0 ? 'active' : ''}" data-nisn="${child.nisn}" onclick="selectChild('${child.nisn}')">
            <div class="child-avatar">${getInitials(child.nama)}</div>
            <div class="child-info">
                <h4>${child.nama}</h4>
                <span>Kelas ${child.kelas || '-'} | NISN: ${child.nisn}</span>
            </div>
        </div>
    `).join('');
}

function selectChild(nisn) {
    selectedChild = childrenData.find(c => c.nisn === nisn);

    if (!selectedChild) return;

    // Store selected child in localStorage for use in other pages
    localStorage.setItem('selected_child_nisn', nisn);
    localStorage.setItem('selected_child_nama', selectedChild.nama);
    localStorage.setItem('selected_child_kelas', selectedChild.kelas || '');
    localStorage.setItem('selected_child_data', JSON.stringify(selectedChild));

    // Clear any cached incident data to force refresh on next page visit
    sessionStorage.removeItem('incidents_cache');
    sessionStorage.removeItem('incident_summary_cache');

    // IMPORTANT: Destroy ALL charts BEFORE loading new data
    // This prevents "Chart Ghosting" where old child data shadows new child
    destroyAllDashboardCharts();
    resetDashboardValues();

    // Update active tab
    document.querySelectorAll('.child-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.nisn === nisn);
    });

    // Load child-specific data (all modules refresh on child switch)
    loadTunggakanData(nisn);
    loadBLPData(nisn);
    loadBadgesData(nisn);
    loadAttendanceDonutData(nisn);
    loadAcademicData(nisn);
    loadHafalanData(nisn);
    loadPembinaanData(nisn);
    loadIncidentSummaryForChild(nisn);

    // Broadcast child change event for any listening components
    window.dispatchEvent(new CustomEvent('childSwitched', {
        detail: { nisn, child: selectedChild }
    }));
}

/**
 * Destroy all donut chart instances to prevent ghosting
 */
function destroyAllDashboardCharts() {
    Object.keys(donutCharts).forEach(key => {
        if (donutCharts[key] && typeof donutCharts[key].destroy === 'function') {
            donutCharts[key].destroy();
        }
    });
    donutCharts = {};
}

/**
 * Reset dashboard values to loading state before new data arrives
 */
function resetDashboardValues() {
    // Reset donut percentages
    const pctElements = ['pct-sholat', 'pct-kbm', 'pct-diniyah', 'pct-kegiatan'];
    pctElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0%';
    });

    // Reset BLP scores
    const blpElements = ['blp-score', 'blp-akhlak', 'blp-ibadah', 'blp-akademik', 'blp-disiplin', 'blp-sosial', 'blp-pdiri'];
    blpElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'blp-score') {
                el.textContent = '0';
            } else {
                el.textContent = '0/' + (id === 'blp-ibadah' ? '30' : id === 'blp-akhlak' ? '25' : '20');
            }
        }
    });

    // Reset academic
    const academicEl = document.getElementById('academic-avg');
    if (academicEl) academicEl.textContent = '0';

    // Reset hafalan
    const hafalanElements = ['hafalan-current', 'hafalan-target', 'hafalan-pct'];
    hafalanElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = id.includes('pct') ? '0%' : '0';
    });

    // Reset hafalan progress bar
    const hafalanBar = document.getElementById('hafalan-bar');
    if (hafalanBar) hafalanBar.style.width = '0%';

    // Reset tunggakan
    const tunggakanEl = document.getElementById('tunggakan-value');
    if (tunggakanEl) tunggakanEl.textContent = '0';

    // Clear pembinaan list
    const pembinaanList = document.getElementById('pembinaan-list');
    if (pembinaanList) {
        pembinaanList.innerHTML = '<div class="loading-placeholder">Memuat data...</div>';
    }

    // Reset insight banner
    const insightBanner = document.getElementById('insight-banner');
    const insightTitle = document.getElementById('insight-title');
    const insightDetails = document.getElementById('insight-details');
    const insightIcon = document.getElementById('insight-icon');

    if (insightBanner) {
        insightBanner.className = 'insight-banner';
        insightIcon.textContent = '📊';
        insightTitle.textContent = 'Memuat analisis...';
        insightDetails.innerHTML = '<span class="insight-tag insight-loading">Menganalisis data ananda</span>';
    }
}

// ============================================
// DYNAMIC INSIGHT BANNER
// ============================================
// Store computed metrics for insight generation
let insightMetrics = {
    sholat: { current: 0, previous: 0 },
    blp: { current: 0, previous: 0 },
    academic: { current: 0, previous: 0 },
    hafalan: { current: 0, target: 0 }
};

/**
 * Update insight banner with computed trends
 * Called after all data is loaded
 */
function updateInsightBanner() {
    const banner = document.getElementById('insight-banner');
    const titleEl = document.getElementById('insight-title');
    const detailsEl = document.getElementById('insight-details');
    const iconEl = document.getElementById('insight-icon');

    if (!banner || !titleEl || !detailsEl) return;

    const insights = generateInsights();

    // Determine overall sentiment
    const positiveCount = insights.filter(i => i.type === 'up' || i.type === 'success').length;
    const negativeCount = insights.filter(i => i.type === 'down').length;
    const warningCount = insights.filter(i => i.type === 'warning').length;

    // Set banner style
    banner.className = 'insight-banner';
    if (positiveCount > negativeCount && negativeCount === 0) {
        banner.classList.add('insight-positive');
        iconEl.textContent = '🌟';
        titleEl.textContent = 'Alhamdulillah, perkembangan ananda sangat baik!';
    } else if (negativeCount > positiveCount) {
        banner.classList.add('insight-negative');
        iconEl.textContent = '📉';
        titleEl.textContent = 'Perlu perhatian di beberapa aspek';
    } else if (warningCount > 0) {
        banner.classList.add('insight-warning');
        iconEl.textContent = '⚠️';
        titleEl.textContent = 'Ada beberapa hal yang perlu diperhatikan';
    } else {
        iconEl.textContent = '📊';
        titleEl.textContent = 'Ringkasan perkembangan ananda';
    }

    // Render insight tags
    if (insights.length > 0) {
        detailsEl.innerHTML = insights.map(insight => `
            <span class="insight-tag insight-${insight.type}">${insight.icon} ${insight.text}</span>
        `).join('');
    } else {
        detailsEl.innerHTML = '<span class="insight-tag insight-stable">Data sedang diproses</span>';
    }
}

/**
 * Generate insights from collected metrics
 */
function generateInsights() {
    const insights = [];

    // Sholat insight
    if (insightMetrics.sholat.current > 0) {
        const pct = insightMetrics.sholat.current;
        if (pct >= 90) {
            insights.push({ type: 'success', icon: '🕌', text: `Sholat ${pct}% - Istiqomah!` });
        } else if (pct >= 70) {
            insights.push({ type: 'stable', icon: '🕌', text: `Sholat ${pct}% - Baik` });
        } else if (pct >= 50) {
            insights.push({ type: 'warning', icon: '🕌', text: `Sholat ${pct}% - Perlu tingkatkan` });
        } else {
            insights.push({ type: 'down', icon: '🕌', text: `Sholat ${pct}% - Butuh perhatian` });
        }
    }

    // BLP insight
    if (insightMetrics.blp.current > 0) {
        const score = insightMetrics.blp.current;
        const pct = Math.round((score / 125) * 100);
        if (pct >= 90) {
            insights.push({ type: 'success', icon: '📋', text: `BLP Mumtaz (${score}/125)` });
        } else if (pct >= 75) {
            insights.push({ type: 'up', icon: '📋', text: `BLP Jayyid Jiddan (${score}/125)` });
        } else if (pct >= 60) {
            insights.push({ type: 'stable', icon: '📋', text: `BLP Jayyid (${score}/125)` });
        } else {
            insights.push({ type: 'warning', icon: '📋', text: `BLP perlu peningkatan (${score}/125)` });
        }
    }

    // Academic insight
    if (insightMetrics.academic.current > 0) {
        const avg = insightMetrics.academic.current;
        if (avg >= 85) {
            insights.push({ type: 'success', icon: '📚', text: `Akademik excellent (${avg})` });
        } else if (avg >= 75) {
            insights.push({ type: 'up', icon: '📚', text: `Akademik baik (${avg})` });
        } else if (avg >= 60) {
            insights.push({ type: 'stable', icon: '📚', text: `Akademik cukup (${avg})` });
        } else {
            insights.push({ type: 'down', icon: '📚', text: `Akademik perlu perhatian (${avg})` });
        }
    }

    // Hafalan insight
    if (insightMetrics.hafalan.current > 0 || insightMetrics.hafalan.target > 0) {
        const current = insightMetrics.hafalan.current;
        const target = insightMetrics.hafalan.target || 30;
        const pct = Math.round((current / target) * 100);

        if (pct >= 80) {
            insights.push({ type: 'success', icon: '📖', text: `Hafalan ${current}/${target} juz - Hampir khatam!` });
        } else if (pct >= 50) {
            insights.push({ type: 'up', icon: '📖', text: `Hafalan ${current}/${target} juz - On track` });
        } else if (current > 0) {
            insights.push({ type: 'stable', icon: '📖', text: `Hafalan ${current}/${target} juz` });
        }
    }

    return insights;
}

// ============================================
// TUNGGAKAN (FINANCE) CARD
// ============================================
async function loadTunggakanData(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        // Use correct endpoint: /api/finance/student/<nisn>/
        const response = await fetch(`${API_BASE}/finance/student/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // API not available, show placeholder
            setTunggakanPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.summary) {
            // Pass recent_tagihan for showing unpaid months
            updateTunggakanCard(data.summary, data.recent_tagihan || []);
        } else {
            setTunggakanPlaceholder();
        }
    } catch (error) {
        console.error('Load tunggakan error:', error);
        setTunggakanPlaceholder();
    }
}

function updateTunggakanCard(summary, recentTagihan) {
    const card = document.getElementById('card-tunggakan');
    const badge = document.getElementById('tunggakan-badge');
    const amount = parseFloat(summary.total_tunggakan) || 0;
    const isLunas = amount === 0;

    // Update class based on status
    card.classList.toggle('lunas', isLunas);

    // Update badge (top-right corner)
    if (isLunas) {
        badge.textContent = '✓ LUNAS';
        badge.className = 'tunggakan-badge badge-lunas';
    } else {
        badge.textContent = '⏳ Belum Lunas';
        badge.className = 'tunggakan-badge badge-pending';
    }

    // Update amount display
    const valueEl = document.getElementById('tunggakan-value');
    if (isLunas) {
        valueEl.innerHTML = '<span class="lunas-check">✓</span> LUNAS';
        valueEl.classList.add('lunas-display');
    } else {
        // Show amount with subtle warning icon
        valueEl.innerHTML = formatCurrency(amount) + '<span class="warning-icon">⚠️</span>';
        valueEl.classList.remove('lunas-display');
    }

    // Update months display - show which months are unpaid
    const monthsEl = document.getElementById('tunggakan-months');
    if (isLunas) {
        monthsEl.textContent = 'Semua tagihan sudah lunas';
        monthsEl.classList.remove('unpaid-months');
    } else {
        // Get list of unpaid months from recent_tagihan
        const unpaidMonths = recentTagihan
            .filter(t => t.status !== 'lunas')
            .map(t => {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
                return monthNames[t.bulan - 1] + ' ' + t.tahun;
            })
            .slice(0, 3); // Show max 3 months

        if (unpaidMonths.length > 0) {
            const moreCount = (summary.bulan_tertunggak || 0) - unpaidMonths.length;
            let text = unpaidMonths.join(', ');
            if (moreCount > 0) {
                text += ` +${moreCount} lainnya`;
            }
            monthsEl.innerHTML = text;
        } else {
            monthsEl.textContent = `${summary.bulan_tertunggak || 0} bulan tertunggak`;
        }
        monthsEl.classList.add('unpaid-months');
    }

    // Update due date
    const dueEl = document.getElementById('tunggakan-due');
    dueEl.textContent = isLunas ? '-' : (summary.jatuh_tempo || '-');

    // Update status
    const statusEl = document.getElementById('tunggakan-status');
    if (isLunas) {
        statusEl.innerHTML = '<span class="status-lunas">Lunas</span>';
    } else {
        statusEl.innerHTML = '<span class="status-belum">Menunggu Pembayaran</span>';
    }
}

function setTunggakanPlaceholder() {
    const card = document.getElementById('card-tunggakan');
    const badge = document.getElementById('tunggakan-badge');

    card.classList.add('lunas');
    badge.textContent = '✓ LUNAS';
    badge.className = 'tunggakan-badge badge-lunas';

    const valueEl = document.getElementById('tunggakan-value');
    valueEl.innerHTML = '<span class="lunas-check">✓</span> LUNAS';
    valueEl.classList.add('lunas-display');

    document.getElementById('tunggakan-months').textContent = 'Tidak ada tagihan';
    document.getElementById('tunggakan-due').textContent = '-';
    document.getElementById('tunggakan-status').innerHTML = '<span class="status-lunas">Lunas</span>';
}

// ============================================
// BLP SUMMARY CARD
// ============================================
async function loadBLPData(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/kesantrian/blp/student/${nisn}/?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            setBLPPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            updateBLPCard(data.data[0], data.summary);
        } else {
            setBLPPlaceholder();
        }
    } catch (error) {
        console.error('Load BLP error:', error);
        setBLPPlaceholder();
    }
}

function updateBLPCard(blpEntry, summary) {
    // BLP Core 25 Indicators max scores
    const CORE_MAX = {
        akhlak: 25,
        ibadah: 30,
        akademik: 20,
        kedisiplinan: 20,
        sosial: 15,
        pengembangan_diri: 15
    };
    const TOTAL_CORE_MAX = 125;

    // Update domain scores
    const domains = blpEntry.domain_scores || {};

    // Helper to get domain score safely (map to core max)
    const getDomainScore = (domainKey) => {
        const domain = domains[domainKey];
        if (!domain) return 0;
        const rawScore = typeof domain === 'object' ? (domain.score || 0) : domain;
        // Scale score to core indicator max (proportional mapping)
        const originalMax = domain.max_score || (domainKey === 'akhlak' ? 60 :
            domainKey === 'ibadah' ? 75 :
            domainKey === 'akademik' ? 40 :
            domainKey === 'kedisiplinan' ? 50 :
            domainKey === 'sosial' ? 40 : 30);
        const coreMax = CORE_MAX[domainKey] || 20;
        // Scale proportionally to core max
        return Math.round((rawScore / originalMax) * coreMax);
    };

    // Calculate core scores
    const akhlakScore = getDomainScore('akhlak');
    const ibadahScore = getDomainScore('ibadah');
    const akademikScore = getDomainScore('akademik');
    const kedisiplinanScore = getDomainScore('kedisiplinan');
    const sosialScore = getDomainScore('sosial');
    const pdiriScore = getDomainScore('pengembangan_diri');

    // Calculate total core score
    const totalCoreScore = akhlakScore + ibadahScore + akademikScore + kedisiplinanScore + sosialScore + pdiriScore;
    document.getElementById('blp-score').textContent = totalCoreScore;

    // Update insight metrics for dynamic banner
    insightMetrics.blp.current = totalCoreScore;
    scheduleInsightUpdate();

    // Update predikat based on core percentage
    const predikatEl = document.getElementById('blp-predikat');
    const corePercentage = (totalCoreScore / TOTAL_CORE_MAX) * 100;
    let predikat = 'Perlu Pembinaan';
    if (corePercentage >= 90) predikat = 'Mumtaz';
    else if (corePercentage >= 75) predikat = 'Jayyid Jiddan';
    else if (corePercentage >= 60) predikat = 'Jayyid';
    else if (corePercentage >= 40) predikat = 'Maqbul';
    predikatEl.textContent = predikat.toUpperCase();
    predikatEl.className = 'blp-predikat ' + getPredikatClass(predikat);

    // Update each domain display with core max
    document.getElementById('blp-akhlak').textContent = `${akhlakScore}/${CORE_MAX.akhlak}`;
    document.getElementById('blp-ibadah').textContent = `${ibadahScore}/${CORE_MAX.ibadah}`;
    document.getElementById('blp-akademik').textContent = `${akademikScore}/${CORE_MAX.akademik}`;
    document.getElementById('blp-disiplin').textContent = `${kedisiplinanScore}/${CORE_MAX.kedisiplinan}`;
    document.getElementById('blp-sosial').textContent = `${sosialScore}/${CORE_MAX.sosial}`;
    document.getElementById('blp-pdiri').textContent = `${pdiriScore}/${CORE_MAX.pengembangan_diri}`;

    // Add visual indicator for scores (color coding)
    const domainElements = {
        'blp-akhlak': { score: akhlakScore, max: CORE_MAX.akhlak },
        'blp-ibadah': { score: ibadahScore, max: CORE_MAX.ibadah },
        'blp-akademik': { score: akademikScore, max: CORE_MAX.akademik },
        'blp-disiplin': { score: kedisiplinanScore, max: CORE_MAX.kedisiplinan },
        'blp-sosial': { score: sosialScore, max: CORE_MAX.sosial },
        'blp-pdiri': { score: pdiriScore, max: CORE_MAX.pengembangan_diri }
    };

    Object.entries(domainElements).forEach(([id, data]) => {
        const el = document.getElementById(id);
        const percentage = (data.score / data.max) * 100;
        el.classList.remove('score-low', 'score-medium', 'score-high');
        if (percentage >= 75) {
            el.classList.add('score-high');
        } else if (percentage >= 50) {
            el.classList.add('score-medium');
        } else {
            el.classList.add('score-low');
        }
    });
}

function setBLPPlaceholder() {
    document.getElementById('blp-score').textContent = '-';
    document.getElementById('blp-predikat').textContent = 'BELUM ADA DATA';
    document.getElementById('blp-predikat').className = 'blp-predikat';

    // Reset all domain scores to show "-" with core max values
    document.getElementById('blp-akhlak').textContent = '-/25';
    document.getElementById('blp-ibadah').textContent = '-/30';
    document.getElementById('blp-akademik').textContent = '-/20';
    document.getElementById('blp-disiplin').textContent = '-/20';
    document.getElementById('blp-sosial').textContent = '-/15';
    document.getElementById('blp-pdiri').textContent = '-/15';
}

function getPredikatClass(predikat) {
    const map = {
        'mumtaz': 'mumtaz',
        'jayyid jiddan': 'jayyid-jiddan',
        'jayyid': 'jayyid',
        'maqbul': 'maqbul',
        'perlu pembinaan': 'perlu-pembinaan'
    };
    return map[predikat.toLowerCase()] || '';
}

// ============================================
// SERTIFIKASI BADGES
// ============================================
async function loadBadgesData(nisn) {
    // For now, use static data based on student progress
    // In production, this would come from an API

    const student = selectedChild;

    // Check Tahfidz badge (5 juz)
    const hafalanJuz = student.hafalan_progress?.tercapai_juz || 0;
    updateBadge('badge-tahfidz', hafalanJuz >= 5, hafalanJuz >= 2.5);

    // Check Tartil badge (placeholder logic)
    updateBadge('badge-tartil', false, true);

    // Check Khidmat badge (placeholder logic)
    updateBadge('badge-khidmat', false, false);
}

function updateBadge(badgeId, earned, inProgress) {
    const badge = document.getElementById(badgeId);
    const statusEl = badge.querySelector('.badge-status');

    badge.classList.toggle('earned', earned);

    if (earned) {
        statusEl.className = 'badge-status earned';
        statusEl.textContent = 'Diraih';
    } else if (inProgress) {
        statusEl.className = 'badge-status in-progress';
        statusEl.textContent = 'Proses';
    } else {
        statusEl.className = 'badge-status locked';
        statusEl.textContent = 'Belum';
    }
}

// ============================================
// DONUT CHART CLUSTER (Attendance)
// ============================================
async function loadAttendanceDonutData(nisn) {
    const token = localStorage.getItem('access_token');

    // Use worship-tracker for Sholat data
    try {
        const sholatRes = await fetch(`${API_BASE}/kesantrian/worship-tracker/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (sholatRes.ok) {
            const sholatData = await sholatRes.json();
            if (sholatData.success) {
                const pct = sholatData.summary?.persentase || 0;
                createDonutChart('chart-sholat', pct, '#178560');
                document.getElementById('pct-sholat').textContent = `${Math.round(pct)}%`;

                // Update insight metrics
                insightMetrics.sholat.current = Math.round(pct);
                scheduleInsightUpdate();
            }
        }
    } catch (e) {
        console.error('Sholat data error:', e);
    }

    // Placeholder data for other categories (would come from API in production)
    const placeholders = {
        kbm: { pct: 95, color: '#3b82f6' },
        diniyah: { pct: 88, color: '#c8961c' },
        halaqoh: { pct: 92, color: '#8b5cf6' },
        puasa: { pct: 75, color: '#ec4899' }
    };

    Object.entries(placeholders).forEach(([key, data]) => {
        createDonutChart(`chart-${key}`, data.pct, data.color);
        document.getElementById(`pct-${key}`).textContent = `${data.pct}%`;
    });
}

// Debounce timer for insight updates
let insightUpdateTimer = null;

/**
 * Schedule insight banner update with debounce
 * This ensures we wait for multiple data loads before updating
 */
function scheduleInsightUpdate() {
    if (insightUpdateTimer) {
        clearTimeout(insightUpdateTimer);
    }
    insightUpdateTimer = setTimeout(() => {
        updateInsightBanner();
    }, 500); // Wait 500ms after last data update
}

function createDonutChart(canvasId, percentage, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy existing chart
    if (donutCharts[canvasId]) {
        donutCharts[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');

    donutCharts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [color, '#e5e7eb'],
                borderWidth: 0,
                cutout: '75%'
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
                duration: 1000
            }
        }
    });
}

// ============================================
// ACADEMIC DATA
// ============================================
async function loadAcademicData(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/grades/?nisn=${nisn}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            setAcademicPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success || Array.isArray(data)) {
            const grades = data.data || data;

            if (grades.length > 0) {
                const avg = grades.reduce((sum, g) => sum + (g.nilai || 0), 0) / grades.length;
                const subjects = [...new Set(grades.map(g => g.mata_pelajaran))].length;

                document.getElementById('academic-avg').textContent = avg.toFixed(1);
                document.getElementById('academic-subjects').textContent = subjects;
                document.getElementById('academic-rank').textContent = '-'; // Would need ranking API

                // Update insight metrics for dynamic banner
                insightMetrics.academic.current = Math.round(avg * 10) / 10;
                scheduleInsightUpdate();
            } else {
                setAcademicPlaceholder();
            }
        }
    } catch (error) {
        console.error('Academic data error:', error);
        setAcademicPlaceholder();
    }
}

function setAcademicPlaceholder() {
    document.getElementById('academic-avg').textContent = '-';
    document.getElementById('academic-subjects').textContent = '-';
    document.getElementById('academic-rank').textContent = '-';
}

// ============================================
// HAFALAN DATA
// ============================================
async function loadHafalanData(nisn) {
    const student = selectedChild;

    if (student && student.hafalan_progress) {
        const hp = student.hafalan_progress;
        const current = hp.tercapai_juz || 0;
        const target = hp.target_juz || 30;
        const pct = hp.persentase || 0;

        document.getElementById('hafalan-current').textContent = current.toFixed(1);
        document.getElementById('hafalan-target').textContent = target;
        document.getElementById('hafalan-pct').textContent = `${pct.toFixed(0)}%`;
        document.getElementById('hafalan-bar').style.width = `${Math.min(pct, 100)}%`;
        document.getElementById('hafalan-last').textContent = '-';

        // Update insight metrics for dynamic banner
        insightMetrics.hafalan.current = current;
        insightMetrics.hafalan.target = target;
        scheduleInsightUpdate();
    } else {
        document.getElementById('hafalan-current').textContent = '0';
        document.getElementById('hafalan-target').textContent = '0';
        document.getElementById('hafalan-pct').textContent = '0%';
        document.getElementById('hafalan-bar').style.width = '0%';

        // Reset insight metrics
        insightMetrics.hafalan.current = 0;
        insightMetrics.hafalan.target = 30;
    }
}

// ============================================
// PEMBINAAN DATA
// ============================================
async function loadPembinaanData(nisn) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/kesantrian/pembinaan/${nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            setPembinaanPlaceholder();
            return;
        }

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderPembinaanList(data.data.slice(0, 5));
        } else {
            setPembinaanPlaceholder();
        }
    } catch (error) {
        console.error('Pembinaan data error:', error);
        setPembinaanPlaceholder();
    }
}

function renderPembinaanList(items) {
    const container = document.getElementById('pembinaan-list');

    container.innerHTML = items.map(item => {
        const icon = getCategoryIcon(item.kategori);
        const dotClass = getCategoryDotClass(item.kategori);

        return `
            <div class="activity-item">
                <div class="activity-dot ${dotClass}">${icon}</div>
                <div class="activity-content">
                    <div class="activity-title">${item.judul}</div>
                    <div class="activity-sub">${item.kategori_display} - ${item.tingkat_display}</div>
                </div>
                <div class="activity-time">${formatDate(item.tanggal)}</div>
            </div>
        `;
    }).join('');
}

function setPembinaanPlaceholder() {
    document.getElementById('pembinaan-list').innerHTML = `
        <div class="activity-item">
            <div class="activity-dot dot-green">📋</div>
            <div class="activity-content">
                <div class="activity-title">Belum ada catatan pembinaan</div>
                <div class="activity-sub">Data akan muncul setelah ada pembinaan dari Ustadz</div>
            </div>
        </div>
    `;
}

// ============================================
// INCIDENT/CASE MANAGEMENT SUMMARY
// ============================================
async function loadIncidentSummaryForChild(nisn) {
    const token = localStorage.getItem('access_token');

    // Check if incident summary card exists on dashboard
    const incidentBadge = document.getElementById('incident-count-badge');
    if (!incidentBadge) return; // Card not on this page

    try {
        const response = await fetch(`${API_BASE}/kesantrian/incidents/?siswa=${nisn}&status=open,in_discussion`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (incidentBadge) incidentBadge.style.display = 'none';
            return;
        }

        const data = await response.json();
        const incidents = data.results || data || [];

        if (incidentBadge) {
            const openCount = incidents.length;
            if (openCount > 0) {
                incidentBadge.textContent = openCount;
                incidentBadge.style.display = 'inline-flex';
            } else {
                incidentBadge.style.display = 'none';
            }
        }

        // Cache the summary for the evaluations page
        sessionStorage.setItem('incident_summary_cache', JSON.stringify({
            nisn: nisn,
            count: incidents.length,
            timestamp: Date.now()
        }));

    } catch (error) {
        console.error('Incident summary error:', error);
        if (incidentBadge) incidentBadge.style.display = 'none';
    }
}

function getCategoryIcon(kategori) {
    const icons = {
        'hafalan': '📖',
        'akhlak': '🤲',
        'kedisiplinan': '⏰',
        'akademik': '📚',
        'kesehatan': '🏥',
        'sosial': '👥',
        'bakat': '⭐',
        'lainnya': '📝'
    };
    return icons[kategori] || '📝';
}

function getCategoryDotClass(kategori) {
    const classes = {
        'hafalan': 'dot-purple',
        'akhlak': 'dot-green',
        'kedisiplinan': 'dot-gold',
        'akademik': 'dot-blue',
        'kesehatan': 'dot-green',
        'sosial': 'dot-purple',
        'bakat': 'dot-gold',
        'lainnya': 'dot-green'
    };
    return classes[kategori] || 'dot-green';
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID').format(amount);
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function showNoChildrenState() {
    const container = document.getElementById('child-selector');
    container.innerHTML = `
        <div class="child-tab" style="background: #fef2f2; border-color: #fecaca;">
            <div class="child-avatar" style="background: #fca5a5;">!</div>
            <div class="child-info">
                <h4 style="color: #dc2626;">Tidak ada anak terhubung</h4>
                <span>Hubungi admin untuk menghubungkan NISN anak Anda</span>
            </div>
        </div>
    `;

    document.getElementById('dashboard-content').innerHTML = `
        <div class="bento-card bento-span-12" style="padding: 60px; text-align: center;">
            <div style="font-size: 64px; margin-bottom: 20px;">👨‍👩‍👧‍👦</div>
            <h2 style="color: var(--text-main); margin-bottom: 10px;">Belum Ada Data Anak</h2>
            <p style="color: var(--text-muted);">Akun Anda belum terhubung dengan data santri. Silakan hubungi admin pesantren.</p>
        </div>
    `;
}

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

// ============================================
// DRILL-DOWN NAVIGATION (Clickable Cards)
// ============================================
function navigateToDetail(module) {
    if (!selectedChild) {
        showToast('Pilih anak terlebih dahulu', 'error');
        return;
    }

    // Store selected child NISN for use in detail pages
    localStorage.setItem('selected_child_nisn', selectedChild.nisn);
    localStorage.setItem('selected_child_nama', selectedChild.nama);

    // Navigation mapping with smooth transition
    const routes = {
        'blp': '/blp/',
        'attendance': '/attendance/',
        'academic': '/grades/',
        'hafalan': '/hafalan/',
        'finance': '/finance/',
        'pembinaan': '/evaluations/',
        'ibadah': '/ibadah/'
    };

    const targetUrl = routes[module];

    if (targetUrl) {
        // Add smooth page transition
        document.body.classList.add('page-transition-out');

        setTimeout(() => {
            window.location.href = targetUrl;
        }, 200);
    }
}

// Add click indicators to clickable cards on load
function initClickableCards() {
    const clickableCards = document.querySelectorAll('.bento-clickable');

    clickableCards.forEach(card => {
        // Add click indicator if not already present
        if (!card.querySelector('.click-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'click-indicator';
            indicator.innerHTML = '→';
            card.appendChild(indicator);
        }
    });
}

// ============================================
// PDF DOWNLOAD FUNCTIONS
// ============================================
async function downloadRaporPDF() {
    if (!selectedChild) {
        showToast('Pilih anak terlebih dahulu', 'error');
        return;
    }

    const btn = event.target.closest('.btn-action');
    const originalContent = btn.innerHTML;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="btn-icon">⏳</span><span>Mengunduh...</span>';
    btn.disabled = true;

    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/kesantrian/download-rapor/${selectedChild.nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal mengunduh rapor');
        }

        // Get the blob and download it
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rapor_${selectedChild.nama.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Rapor berhasil diunduh', 'success');
    } catch (error) {
        console.error('Download rapor error:', error);
        showToast(error.message || 'Gagal mengunduh rapor', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

async function downloadBLPReport() {
    if (!selectedChild) {
        showToast('Pilih anak terlebih dahulu', 'error');
        return;
    }

    const btn = event.target.closest('.btn-action');
    const originalContent = btn.innerHTML;
    btn.classList.add('loading');
    btn.innerHTML = '<span class="btn-icon">⏳</span><span>Mengunduh...</span>';
    btn.disabled = true;

    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_BASE}/kesantrian/download-blp/${selectedChild.nisn}/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Gagal mengunduh laporan BLP');
        }

        // Get the blob and download it
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BLP_${selectedChild.nama.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Laporan BLP berhasil diunduh', 'success');
    } catch (error) {
        console.error('Download BLP error:', error);
        showToast(error.message || 'Gagal mengunduh laporan BLP', 'error');
    } finally {
        btn.classList.remove('loading');
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

function printRaporHTML() {
    if (!selectedChild) {
        showToast('Pilih anak terlebih dahulu', 'error');
        return;
    }

    // Open print-friendly rapor in new window
    const token = localStorage.getItem('access_token');
    const printUrl = `${API_BASE}/kesantrian/print-rapor-html/${selectedChild.nisn}/`;

    window.open(printUrl, '_blank', 'width=900,height=700');
}
