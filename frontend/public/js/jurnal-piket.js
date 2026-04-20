/**
 * Jurnal Piket - Portal Ponpes Baron v2.3.9
 * ==========================================
 */

// State
let jurnalData = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[JurnalPiket] Initializing...');

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const filterTanggal = document.getElementById('filter-tanggal');
    if (filterTanggal) {
        filterTanggal.value = today;
        filterTanggal.addEventListener('change', loadJurnalPiket);
    }

    // Set topbar date
    setTopbarDate();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Load data
    await loadJurnalPiket();
});

// ============================================
// DATA LOADING
// ============================================

async function loadJurnalPiket() {
    const filterTanggal = document.getElementById('filter-tanggal');
    const tanggal = filterTanggal?.value || new Date().toISOString().split('T')[0];

    console.log('[JurnalPiket] Loading data for:', tanggal);

    try {
        const response = await window.apiFetch(`/attendance/jurnal-piket/?tanggal=${tanggal}`);

        if (!response.ok) {
            throw new Error('Failed to load data');
        }

        const result = await response.json();

        if (result.success) {
            jurnalData = result.data || [];

            // Update stats
            updateStats(result.summary);

            // Update badge
            updateTanggalBadge(result.tanggal_display);

            // Render list
            renderJurnalList(jurnalData);
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('[JurnalPiket] Error:', error);
        showToast('Gagal memuat data jurnal piket', 'error');
    }
}

// ============================================
// RENDERING
// ============================================

function updateStats(summary) {
    const statTotal = document.getElementById('stat-total');
    const statHandled = document.getElementById('stat-handled');
    const statPending = document.getElementById('stat-pending');

    if (statTotal) statTotal.textContent = summary?.total_sesi || 0;
    if (statHandled) statHandled.textContent = summary?.sudah_ditangani || 0;
    if (statPending) statPending.textContent = summary?.belum_pengganti || 0;
}

function updateTanggalBadge(tanggalDisplay) {
    const badge = document.getElementById('tanggal-badge');
    if (badge) {
        badge.textContent = tanggalDisplay || 'Hari Ini';
    }
}

function renderJurnalList(data) {
    const container = document.getElementById('jurnal-list');
    const emptyState = document.getElementById('empty-state');

    if (!container) return;

    // Clear existing items (except empty state)
    const items = container.querySelectorAll('.jurnal-item');
    items.forEach(item => item.remove());

    if (!data || data.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    data.forEach((item, index) => {
        const itemHtml = createJurnalItemHtml(item, index);
        container.insertAdjacentHTML('beforeend', itemHtml);
    });

    // Re-init Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function createJurnalItemHtml(item, index) {
    const statusClass = item.status === 'handled' ? 'status-handled' : 'status-pending';
    const iconName = item.status === 'handled' ? 'check-circle' : 'alert-circle';

    const guruPenggantiHtml = item.guru_pengganti_nama
        ? `<span class="jurnal-meta-item guru-pengganti">
               <i data-lucide="user-check"></i>
               ${escapeHtml(item.guru_pengganti_nama)}
           </span>`
        : '';

    return `
        <div class="jurnal-item ${statusClass}" data-index="${index}">
            <div class="jurnal-icon">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="jurnal-content">
                <div class="jurnal-title">${escapeHtml(item.kelas)} - ${escapeHtml(item.mata_pelajaran || 'Mata Pelajaran')}</div>
                <div class="jurnal-meta">
                    <span class="jurnal-meta-item">
                        <i data-lucide="clock"></i>
                        ${escapeHtml(item.jam_ke_label)}
                    </span>
                    <span class="jurnal-meta-item">
                        <i data-lucide="users"></i>
                        ${item.hadir}/${item.total_siswa} hadir
                    </span>
                    ${guruPenggantiHtml}
                </div>
            </div>
            <div class="jurnal-status">
                <span class="status-badge ${item.status}">${escapeHtml(item.status_display)}</span>
            </div>
            <div class="jurnal-actions">
                <button class="btn-detail" onclick="openDetailModal(${index})">
                    <i data-lucide="eye"></i>
                    Detail
                </button>
            </div>
        </div>
    `;
}

// ============================================
// DETAIL MODAL
// ============================================

function openDetailModal(index) {
    const item = jurnalData[index];
    if (!item) return;

    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalBody) return;

    modalTitle.textContent = `${item.kelas} - ${item.mata_pelajaran || 'Detail Sesi'}`;

    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-row">
                <div class="detail-label">Kelas</div>
                <div class="detail-value">${escapeHtml(item.kelas)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Mata Pelajaran</div>
                <div class="detail-value">${escapeHtml(item.mata_pelajaran || '-')}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Jam Pelajaran</div>
                <div class="detail-value">${escapeHtml(item.jam_ke_label)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Tipe Pengajar</div>
                <div class="detail-value">${item.tipe_pengajar === 'guru_pengganti' ? 'Guru Pengganti' : 'Guru Asli'}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Guru Pengganti</div>
                <div class="detail-value ${!item.guru_pengganti_nama ? 'empty' : ''}">${escapeHtml(item.guru_pengganti_nama || 'Belum ada')}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Kehadiran</div>
                <div class="detail-value">${item.hadir} dari ${item.total_siswa} siswa (${item.persen_hadir}%)</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Status</div>
                <div class="detail-value">
                    <span class="status-badge ${item.status}">${escapeHtml(item.status_display)}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i data-lucide="book-open"></i>
                Materi yang Diajarkan
            </div>
            <div class="detail-text-box ${!item.materi ? 'empty' : ''}">${escapeHtml(item.materi || 'Tidak ada materi yang dicatat')}</div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i data-lucide="target"></i>
                Capaian Pembelajaran
            </div>
            <div class="detail-text-box ${!item.capaian_pembelajaran ? 'empty' : ''}">${escapeHtml(item.capaian_pembelajaran || 'Tidak ada capaian yang dicatat')}</div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i data-lucide="message-square"></i>
                Catatan Guru
            </div>
            <div class="detail-text-box ${!item.catatan ? 'empty' : ''}">${escapeHtml(item.catatan || 'Tidak ada catatan')}</div>
        </div>
    `;

    modal.classList.add('show');

    // Re-init icons in modal
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// ============================================
// UTILITIES
// ============================================

function setTopbarDate() {
    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        const today = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        topbarDate.textContent = '📅 ' + today.toLocaleDateString('id-ID', options);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Simple toast - you can enhance this
    console.log(`[Toast] ${type}: ${message}`);
    alert(message);
}

// Make functions globally available
window.loadJurnalPiket = loadJurnalPiket;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
