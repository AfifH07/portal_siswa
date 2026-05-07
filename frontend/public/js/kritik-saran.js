/**
 * Kritik & Saran - Portal Ponpes Baron v2.4.3
 */

let isInbox = false;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || '';

    isInbox = ['superadmin', 'admin', 'pimpinan'].includes(role);

    if (isInbox) {
        const inboxFilterSection = document.getElementById('inbox-filter-section');
        if (inboxFilterSection) inboxFilterSection.style.display = '';
        const inboxSection = document.getElementById('inbox-section');
        if (inboxSection) inboxSection.style.display = '';
        await loadInbox();
    }

    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        const today = new Date();
        topbarDate.textContent = '📅 ' + today.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ============================================
// KIRIM
// ============================================

async function submitKritikSaran() {
    const jenis = document.getElementById('input-jenis')?.value;
    const unit = document.getElementById('input-unit')?.value || 'umum';
    const isi = document.getElementById('input-isi')?.value.trim();
    const isAnonim = document.getElementById('input-anonim')?.checked || false;
    const btn = document.getElementById('btn-submit');

    if (!jenis) { alert('⚠️ Pilih jenis terlebih dahulu.'); return; }
    if (!isi) { alert('⚠️ Isi tidak boleh kosong.'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader"></i> Mengirim...'; lucide.createIcons(); }

    try {
        const response = await window.apiFetch('/kesantrian/kritik-saran/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jenis, unit, isi, is_anonim: isAnonim })
        });
        const result = await response.json();

        if (result.success) {
            alert('✅ Terima kasih! Kritik/saran Anda telah dikirim.');
            document.getElementById('input-jenis').value = '';
            document.getElementById('input-unit').value = 'umum';
            document.getElementById('input-isi').value = '';
            document.getElementById('input-anonim').checked = false;
            if (isInbox) await loadInbox();
        } else {
            alert('❌ Gagal: ' + (result.message || 'Unknown error'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send"></i> Kirim'; lucide.createIcons(); }
    }
}

// ============================================
// INBOX
// ============================================

async function loadInbox() {
    const tbody = document.getElementById('tbody-inbox');
    const badge = document.getElementById('inbox-badge');
    const empty = document.getElementById('inbox-empty');
    const tableContainer = document.getElementById('inbox-table-container');

    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center">
        <div class="loading-spinner" style="margin:30px auto;"></div></td></tr>`;

    try {
        const params = new URLSearchParams();
        const fJenis = document.getElementById('filter-jenis')?.value;
        const fUnit = document.getElementById('filter-unit')?.value;
        const fStatus = document.getElementById('filter-status')?.value;
        if (fJenis) params.append('jenis', fJenis);
        if (fUnit) params.append('unit', fUnit);
        if (fStatus) params.append('status', fStatus);

        const url = `/kesantrian/kritik-saran/${params.toString() ? '?' + params.toString() : ''}`;
        const response = await window.apiFetch(url);
        const result = await response.json();

        if (!result.success) throw new Error(result.message || 'Gagal');

        const data = result.data || [];
        if (badge) badge.textContent = `${data.length} data`;

        if (data.length === 0) {
            if (tableContainer) tableContainer.style.display = 'none';
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (tableContainer) tableContainer.style.display = '';
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            if (item.status === 'baru') tr.style.fontWeight = '600';

            const jenisBadge = item.jenis === 'kritik'
                ? '<span class="status-badge badge-red">Kritik</span>'
                : '<span class="status-badge badge-blue">Saran</span>';

            const unitBadge = {
                putra: '<span class="status-badge badge-blue">Putra</span>',
                putri: '<span class="status-badge badge-purple">Putri</span>',
                umum:  '<span class="status-badge badge-gray">Umum</span>',
            }[item.unit] || '-';

            const statusBadge = item.status === 'baru'
                ? '<span class="status-badge badge-yellow">Baru</span>'
                : '<span class="status-badge badge-green">Dibaca</span>';

            const waktu = item.created_at
                ? new Date(item.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })
                : '-';

            tr.innerHTML = `
                <td>${escapeHtml(item.pengirim_name || 'Anonim')}</td>
                <td>${jenisBadge}</td>
                <td>${unitBadge}</td>
                <td class="keterangan-cell">${escapeHtml(truncateText(item.isi, 60))}</td>
                <td>${statusBadge}</td>
                <td>${waktu}</td>
                <td>
                    <button class="btn btn-sm btn-outline"
                        onclick="openDetail(${item.id})">
                        <i data-lucide="eye"></i> Lihat
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">
            Gagal memuat: ${err.message}</td></tr>`;
    }
}

async function openDetail(id) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('detail-modal-body');
    const title = document.getElementById('detail-modal-title');

    if (!modal) return;

    if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    modal.classList.add('show');

    try {
        const response = await window.apiFetch(`/kesantrian/kritik-saran/?status=`);
        const result = await response.json();
        const allData = result.data || [];
        const item = allData.find(d => d.id === id);

        if (!item) { if (body) body.innerHTML = '<p>Data tidak ditemukan.</p>'; return; }

        if (title) title.textContent = item.jenis === 'kritik' ? '📝 Detail Kritik' : '💡 Detail Saran';

        if (body) body.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div><strong>Dari:</strong> ${escapeHtml(item.pengirim_name)}</div>
                <div><strong>Unit:</strong> ${escapeHtml(item.unit)}</div>
                <div><strong>Waktu:</strong> ${new Date(item.created_at).toLocaleString('id-ID')}</div>
                <hr style="border:none;border-top:1px solid var(--border,#e2e8f0);">
                <div style="line-height:1.7;white-space:pre-wrap;">${escapeHtml(item.isi)}</div>
            </div>
        `;

        // Tandai dibaca jika masih baru
        if (item.status === 'baru') {
            await window.apiFetch(`/kesantrian/kritik-saran/${id}/baca/`, { method: 'PATCH' });
            await loadInbox();
        }

    } catch (err) {
        if (body) body.innerHTML = `<p class="text-muted">Gagal memuat detail.</p>`;
    }
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) modal.classList.remove('show');
}

function resetInboxFilter() {
    document.getElementById('filter-jenis').value = '';
    document.getElementById('filter-unit').value = '';
    document.getElementById('filter-status').value = '';
    loadInbox();
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
window.submitKritikSaran = submitKritikSaran;
window.loadInbox = loadInbox;
window.openDetail = openDetail;
window.closeDetailModal = closeDetailModal;
window.resetInboxFilter = resetInboxFilter;
