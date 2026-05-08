/**
 * Pertemuan Pengasuhan - Portal Ponpes Baron v2.4.3
 */

let isAdmin = false;
let pertemuanData = [];
let activePertemuanId = null;
let walisantriList = [];

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || '';

    isAdmin = ['superadmin', 'admin', 'pimpinan'].includes(role);

    if (isAdmin) {
        const formSection = document.getElementById('form-section');
        if (formSection) formSection.style.display = '';
        const thAksi = document.getElementById('th-aksi-pertemuan');
        if (thAksi) thAksi.style.display = '';
        await loadWalisantriList();
    }

    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        topbarDate.textContent = '📅 ' + new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
    await loadPertemuan();
});

// ============================================
// LOAD DATA
// ============================================

async function loadPertemuan() {
    const tbody = document.getElementById('tbody-pertemuan');
    const badge = document.getElementById('pertemuan-badge');
    const empty = document.getElementById('pertemuan-empty');
    const tableContainer = document.getElementById('pertemuan-table-container');

    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">
        <div class="loading-spinner" style="margin:30px auto;"></div></td></tr>`;

    try {
        const response = await window.apiFetch('/kesantrian/pertemuan/');
        const result = await response.json();
        if (!result.success) throw new Error(result.message);

        pertemuanData = result.data || [];
        if (badge) badge.textContent = `${pertemuanData.length} data`;

        if (pertemuanData.length === 0) {
            if (tableContainer) tableContainer.style.display = 'none';
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (tableContainer) tableContainer.style.display = '';
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = '';
        pertemuanData.forEach(item => {
            const tr = document.createElement('tr');
            const tanggal = item.tanggal
                ? new Date(item.tanggal).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                  })
                : '-';
            const waktu = `${item.waktu_mulai || '-'} - ${item.waktu_selesai || '-'}`;

            let aksiHtml = '';
            if (isAdmin) {
                aksiHtml = `
                    <td>
                        <button class="btn btn-sm btn-outline" style="margin-right:4px;"
                            onclick="openPresensiModal(${item.id})">
                            <i data-lucide="clipboard-list"></i> Presensi
                        </button>
                        <button class="btn btn-sm btn-outline"
                            style="color:var(--danger,#ef4444);"
                            onclick="hapusPertemuan(${item.id})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                `;
            }

            tr.innerHTML = `
                <td>
                    <strong>${escapeHtml(item.judul)}</strong>
                    ${item.deskripsi ? `<div class="text-muted" style="font-size:12px;margin-top:2px;">${escapeHtml(truncateText(item.deskripsi, 60))}</div>` : ''}
                </td>
                <td>${tanggal}</td>
                <td>${escapeHtml(waktu)}</td>
                <td>${escapeHtml(item.lokasi)}</td>
                <td><span class="status-badge badge-green">${item.jumlah_hadir} hadir</span></td>
                ${aksiHtml}
            `;
            tbody.appendChild(tr);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">
            Gagal memuat: ${err.message}</td></tr>`;
    }
}

async function loadWalisantriList() {
    try {
        const response = await window.apiFetch('/users/?role=walisantri');
        const result = await response.json();
        walisantriList = result.data || result.results || result || [];
    } catch (err) {
        console.error('[Pertemuan] Gagal load walisantri:', err);
    }
}

// ============================================
// BUAT PERTEMUAN
// ============================================

async function submitPertemuan() {
    const judul = document.getElementById('input-judul')?.value.trim();
    const tanggal = document.getElementById('input-tanggal')?.value;
    const waktuMulai = document.getElementById('input-waktu-mulai')?.value;
    const waktuSelesai = document.getElementById('input-waktu-selesai')?.value;
    const lokasi = document.getElementById('input-lokasi')?.value.trim();
    const deskripsi = document.getElementById('input-deskripsi')?.value.trim();
    const btn = document.getElementById('btn-submit');

    if (!judul || !tanggal || !waktuMulai || !waktuSelesai || !lokasi) {
        alert('⚠️ Harap lengkapi semua field wajib.'); return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch('/kesantrian/pertemuan/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                judul, tanggal,
                waktu_mulai: waktuMulai,
                waktu_selesai: waktuSelesai,
                lokasi, deskripsi
            })
        });
        const result = await response.json();
        if (result.success) {
            alert('✅ Pertemuan berhasil dibuat!');
            document.getElementById('input-judul').value = '';
            document.getElementById('input-tanggal').value = '';
            document.getElementById('input-waktu-mulai').value = '';
            document.getElementById('input-waktu-selesai').value = '';
            document.getElementById('input-lokasi').value = '';
            document.getElementById('input-deskripsi').value = '';
            await loadPertemuan();
        } else {
            alert('❌ Gagal: ' + (result.message || 'Unknown error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="calendar-plus"></i> Simpan Pertemuan'; lucide.createIcons(); }
    }
}

// ============================================
// HAPUS PERTEMUAN
// ============================================

async function hapusPertemuan(id) {
    if (!confirm('Hapus pertemuan ini? Data presensi juga akan terhapus.')) return;
    try {
        const response = await window.apiFetch(`/kesantrian/pertemuan/${id}/`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            await loadPertemuan();
        } else {
            alert('❌ Gagal hapus: ' + (result.message || 'Error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
}

// ============================================
// PRESENSI MODAL
// ============================================

async function openPresensiModal(id) {
    activePertemuanId = id;
    const modal = document.getElementById('presensi-modal');
    const title = document.getElementById('presensi-modal-title');
    const list = document.getElementById('presensi-list');

    const item = pertemuanData.find(p => p.id === id);
    if (title && item) title.textContent = `Presensi — ${item.judul}`;
    if (list) list.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    if (modal) modal.classList.add('show');

    try {
        // Load presensi yang sudah ada
        const response = await window.apiFetch(`/kesantrian/pertemuan/${id}/presensi/`);
        const result = await response.json();
        const existingPresensi = result.data || [];

        // Buat map walisantri_id → status
        const presensiMap = {};
        existingPresensi.forEach(p => {
            presensiMap[p.walisantri] = { status: p.status, catatan: p.catatan };
        });

        if (walisantriList.length === 0) {
            list.innerHTML = '<p class="text-muted">Belum ada data walisantri terdaftar.</p>';
            return;
        }

        list.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nama Walisantri</th>
                        <th>Status</th>
                        <th>Catatan</th>
                    </tr>
                </thead>
                <tbody>
                    ${walisantriList.map(w => {
                        const current = presensiMap[w.id] || { status: 'tidak_hadir', catatan: '' };
                        return `
                            <tr>
                                <td>${escapeHtml(w.name || w.username)}</td>
                                <td>
                                    <select class="filter-input presensi-status"
                                        data-wali-id="${w.id}" style="min-width:130px;">
                                        <option value="hadir" ${current.status === 'hadir' ? 'selected' : ''}>Hadir</option>
                                        <option value="tidak_hadir" ${current.status === 'tidak_hadir' ? 'selected' : ''}>Tidak Hadir</option>
                                        <option value="izin" ${current.status === 'izin' ? 'selected' : ''}>Izin</option>
                                    </select>
                                </td>
                                <td>
                                    <input type="text" class="filter-input presensi-catatan"
                                        data-wali-id="${w.id}"
                                        value="${escapeHtml(current.catatan)}"
                                        placeholder="Catatan (opsional)">
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        if (list) list.innerHTML = `<p class="text-muted">Gagal memuat presensi: ${err.message}</p>`;
    }
}

async function savePresensi() {
    if (!activePertemuanId) return;
    const btn = document.getElementById('btn-save-presensi');

    const statusInputs = document.querySelectorAll('.presensi-status');
    const presensiPayload = [];

    statusInputs.forEach(select => {
        const waliId = select.getAttribute('data-wali-id');
        const catInput = document.querySelector(`.presensi-catatan[data-wali-id="${waliId}"]`);
        presensiPayload.push({
            walisantri_id: parseInt(waliId),
            status: select.value,
            catatan: catInput ? catInput.value : ''
        });
    });

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Menyimpan...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch(
            `/kesantrian/pertemuan/${activePertemuanId}/presensi/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ presensi: presensiPayload })
            }
        );
        const result = await response.json();
        if (result.success) {
            alert('✅ Presensi berhasil disimpan!');
            closePresensiModal();
            await loadPertemuan();
        } else {
            alert('❌ Gagal: ' + (result.message || 'Error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save"></i> Simpan Presensi'; lucide.createIcons(); }
    }
}

function closePresensiModal() {
    const modal = document.getElementById('presensi-modal');
    if (modal) modal.classList.remove('show');
    activePertemuanId = null;
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('show');
}

// ============================================
// UTILS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, max) {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max) + '...';
}

// Exports
window.submitPertemuan = submitPertemuan;
window.hapusPertemuan = hapusPertemuan;
window.openPresensiModal = openPresensiModal;
window.savePresensi = savePresensi;
window.closePresensiModal = closePresensiModal;
window.closeDetailModal = closeDetailModal;
