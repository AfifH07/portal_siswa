/**
 * Titipan Tugas - Portal Ponpes Baron v2.3.9
 * ==========================================
 */

// State
let kelasMapelOptions = [];
let riwayatData = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[TitipanTugas] Initializing...');

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inputTanggal = document.getElementById('input-tanggal');
    if (inputTanggal) {
        inputTanggal.value = tomorrow.toISOString().split('T')[0];
        // Set min date to today
        inputTanggal.min = new Date().toISOString().split('T')[0];
    }

    // Set topbar date
    setTopbarDate();

    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Setup form handler
    const form = document.getElementById('form-titipan');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Load data
    await Promise.all([
        loadKelasMapel(),
        loadRiwayat()
    ]);
});

// ============================================
// DATA LOADING
// ============================================

async function loadKelasMapel() {
    console.log('[TitipanTugas] Loading kelas & mapel...');
    const select = document.getElementById('input-kelas-mapel');
    if (!select) return;

    try {
        const response = await window.apiFetch('/attendance/titipan-tugas/kelas-saya/');

        if (!response || !response.ok) {
            throw new Error('Failed to load kelas & mapel');
        }

        const result = await response.json();

        if (result.success && result.data) {
            kelasMapelOptions = result.data;

            // Clear and populate options
            select.innerHTML = '<option value="">-- Pilih Kelas & Mapel --</option>';

            result.data.forEach((item, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = item.label;
                option.dataset.kelas = item.kelas;
                option.dataset.mapel = item.mata_pelajaran;
                select.appendChild(option);
            });

            if (result.data.length === 0) {
                select.innerHTML = '<option value="">Tidak ada assignment aktif</option>';
            }
        }
    } catch (error) {
        console.error('[TitipanTugas] Error loading kelas/mapel:', error);
        select.innerHTML = '<option value="">Gagal memuat data</option>';
    }
}

async function loadRiwayat() {
    console.log('[TitipanTugas] Loading riwayat...');

    try {
        const response = await window.apiFetch('/attendance/titipan-tugas/riwayat/');

        if (!response || !response.ok) {
            throw new Error('Failed to load riwayat');
        }

        const result = await response.json();

        if (result.success) {
            riwayatData = result.data || [];
            renderRiwayat(riwayatData);
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('[TitipanTugas] Error loading riwayat:', error);
        showToast('Gagal memuat riwayat titipan tugas', 'error');
    }
}

// ============================================
// FORM HANDLING
// ============================================

async function handleSubmit(e) {
    e.preventDefault();

    const select = document.getElementById('input-kelas-mapel');
    const tanggalInput = document.getElementById('input-tanggal');
    const jamKeInput = document.getElementById('input-jam-ke');
    const deskripsiInput = document.getElementById('input-deskripsi');
    const btnSimpan = document.getElementById('btn-simpan');

    // Validate
    const selectedIndex = select.value;
    if (selectedIndex === '' || !kelasMapelOptions[selectedIndex]) {
        showToast('Pilih kelas & mata pelajaran terlebih dahulu', 'error');
        return;
    }

    const tanggal = tanggalInput.value;
    const jamKe = jamKeInput.value ? parseInt(jamKeInput.value) : null;
    const deskripsi = deskripsiInput.value.trim();

    if (!tanggal) {
        showToast('Pilih tanggal berlaku', 'error');
        return;
    }

    if (!deskripsi) {
        showToast('Isi deskripsi tugas', 'error');
        return;
    }

    const selectedOption = kelasMapelOptions[selectedIndex];

    // Disable button
    btnSimpan.disabled = true;
    btnSimpan.innerHTML = '<i data-lucide="loader"></i> Menyimpan...';

    try {
        const payload = {
            kelas: selectedOption.kelas,
            mata_pelajaran: selectedOption.mata_pelajaran,
            tanggal_berlaku: tanggal,
            deskripsi_tugas: deskripsi
        };

        // Only include jam_ke if provided
        if (jamKe !== null) {
            payload.jam_ke = jamKe;
        }

        const response = await window.apiFetch('/attendance/titipan-tugas/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            const errorData = await response?.json();
            throw new Error(errorData?.message || 'Gagal menyimpan');
        }

        const result = await response.json();

        if (result.success) {
            showToast('Titipan tugas berhasil disimpan', 'success');

            // Reset form
            select.value = '';
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tanggalInput.value = tomorrow.toISOString().split('T')[0];
            jamKeInput.value = '';
            deskripsiInput.value = '';

            // Reload riwayat
            await loadRiwayat();
        } else {
            throw new Error(result.message || 'Unknown error');
        }

    } catch (error) {
        console.error('[TitipanTugas] Error saving:', error);
        showToast(error.message || 'Gagal menyimpan titipan tugas', 'error');
    } finally {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = '<i data-lucide="save"></i> Simpan Titipan Tugas';
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

// ============================================
// RENDERING
// ============================================

function renderRiwayat(data) {
    const tbody = document.getElementById('tbody-riwayat');
    const emptyState = document.getElementById('empty-state');
    const table = document.getElementById('table-riwayat');
    const badge = document.getElementById('riwayat-badge');
    const tableContainer = table?.closest('.table-container');

    if (!tbody) return;

    tbody.innerHTML = '';

    // Update badge
    if (badge) {
        badge.textContent = `${data?.length || 0} data`;
    }

    if (!data || data.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }

    if (tableContainer) tableContainer.style.display = '';
    if (emptyState) emptyState.style.display = 'none';

    data.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'riwayat-row';
        tr.onclick = () => openDetailModal(index);

        const statusClass = item.status === 'dikerjakan' ? 'handled' : 'pending';
        const statusText = item.status_display || (item.status === 'dikerjakan' ? 'Dikerjakan' : 'Menunggu');

        const jpDisplay = item.jam_ke ? `JP ${item.jam_ke}` : '-';

        tr.innerHTML = `
            <td>${formatDate(item.tanggal_berlaku)}</td>
            <td>${escapeHtml(item.kelas)}</td>
            <td>${jpDisplay}</td>
            <td>${escapeHtml(item.mata_pelajaran)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${item.guru_piket_nama ? escapeHtml(item.guru_piket_nama) : '<span class="text-muted">-</span>'}</td>
        `;

        tbody.appendChild(tr);
    });

    // Re-init Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ============================================
// DETAIL MODAL
// ============================================

function openDetailModal(index) {
    const item = riwayatData[index];
    if (!item) return;

    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalBody) return;

    modalTitle.textContent = `${item.kelas} — ${item.mata_pelajaran}`;

    const statusClass = item.status === 'dikerjakan' ? 'handled' : 'pending';
    const statusText = item.status_display || (item.status === 'dikerjakan' ? 'Dikerjakan' : 'Menunggu');

    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-row">
                <div class="detail-label">Kelas</div>
                <div class="detail-value">${escapeHtml(item.kelas)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Mata Pelajaran</div>
                <div class="detail-value">${escapeHtml(item.mata_pelajaran)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Tanggal Berlaku</div>
                <div class="detail-value">${formatDate(item.tanggal_berlaku)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Status</div>
                <div class="detail-value">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Guru Piket</div>
                <div class="detail-value ${!item.guru_piket_nama ? 'empty' : ''}">${escapeHtml(item.guru_piket_nama || 'Belum ada')}</div>
            </div>
        </div>

        <div class="detail-section">
            <div class="detail-section-title">
                <i data-lucide="file-text"></i>
                Deskripsi Tugas
            </div>
            <div class="detail-text-box">${escapeHtml(item.deskripsi_tugas)}</div>
        </div>

        ${item.catatan_piket ? `
        <div class="detail-section">
            <div class="detail-section-title">
                <i data-lucide="message-square"></i>
                Catatan Guru Piket
            </div>
            <div class="detail-text-box">${escapeHtml(item.catatan_piket)}</div>
        </div>
        ` : ''}
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

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Simple toast - can be enhanced
    console.log(`[Toast] ${type}: ${message}`);
    alert(message);
}

// Make functions globally available
window.loadRiwayat = loadRiwayat;
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
