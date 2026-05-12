let allGuru = [];
let poinList = [];
let integritasCount = {};
let allIntegritasGuru = [];
let currentGuruId = null;
let currentGuruName = null;
let userRole = '';

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    userRole = user.role || window.userRole || '';

    if (!['pimpinan', 'admin', 'superadmin'].includes(userRole)) {
        window.location.href = '/evaluations';
        return;
    }

    setupPage();
    await Promise.all([loadPoinIntegritas(), loadGuruList()]);
    renderGuruTable(allGuru);
}

function setupPage() {
    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        topbarDate.textContent = '📅 ' + new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn && typeof window.logout === 'function') {
        logoutBtn.onclick = window.logout;
    }

    const searchInput = document.getElementById('search-guru');
    if (searchInput) {
        searchInput.oninput = function () {
            const q = (this.value || '').toLowerCase();
            const filtered = allGuru.filter(g => {
                const name = (g.name || g.username || '').toLowerCase();
                return name.includes(q);
            });
            renderGuruTable(filtered);
        };
    }

    const konfigWrap = document.getElementById('konfig-button-wrap');
    const btnOpenKonfig = document.getElementById('btn-open-konfig');
    const canManagePoints = ['superadmin', 'admin', 'pimpinan'].includes(userRole);
    if (konfigWrap) konfigWrap.style.display = canManagePoints ? '' : 'none';
    if (btnOpenKonfig) btnOpenKonfig.onclick = openKonfigModal;

    const closeDetail = document.getElementById('btn-close-guru-detail');
    const detailBackdrop = document.getElementById('guru-detail-backdrop');
    const scoreBtn = document.getElementById('btn-detail-score-guru');
    if (closeDetail) closeDetail.onclick = closeDetailModal;
    if (detailBackdrop) detailBackdrop.onclick = closeDetailModal;
    if (scoreBtn) scoreBtn.onclick = openFormPenilaian;

    const closeForm = document.getElementById('btn-close-guru-form');
    const cancelForm = document.getElementById('btn-cancel-guru-form');
    const saveForm = document.getElementById('btn-save-guru-form');
    const formBackdrop = document.getElementById('guru-form-backdrop');
    if (closeForm) closeForm.onclick = closeFormModal;
    if (cancelForm) cancelForm.onclick = closeFormModal;
    if (saveForm) saveForm.onclick = submitIntegritasGuru;
    if (formBackdrop) formBackdrop.onclick = closeFormModal;

    const closeKonfig = document.getElementById('btn-close-konfig');
    const konfigBackdrop = document.getElementById('konfig-poin-backdrop');
    const tambahPoinBtn = document.getElementById('btn-tambah-poin');
    if (closeKonfig) closeKonfig.onclick = closeKonfigModal;
    if (konfigBackdrop) konfigBackdrop.onclick = closeKonfigModal;
    if (tambahPoinBtn) tambahPoinBtn.onclick = tambahPoin;

    refreshIcons();
}

async function loadGuruList() {
    const tbody = document.getElementById('guru-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';
    }

    try {
        const [guruResponse, integritasResponse] = await Promise.all([
            window.apiFetch('/admin/users/?role=guru&page_size=200'),
            window.apiFetch('/evaluations/integritas-guru/')
        ]);

        const guruResult = await guruResponse.json();
        const integritasResult = await integritasResponse.json();

        allGuru = (guruResult.data || guruResult.results || []).filter(item => item && item.id);
        allIntegritasGuru = integritasResult.data || [];
        integritasCount = buildIntegritasSummary(allIntegritasGuru);
    } catch (err) {
        console.error('[EvaluasiGuru] Gagal memuat daftar guru:', err);
        allGuru = [];
        allIntegritasGuru = [];
        integritasCount = {};
    }
}

function buildIntegritasSummary(records) {
    const summary = {};
    records.forEach(record => {
        const guruId = record.guru || record.guru_id;
        if (!guruId) return;
        if (!summary[guruId]) {
            summary[guruId] = { count: 0, last_date: null };
        }
        summary[guruId].count += 1;
        if (!summary[guruId].last_date || new Date(record.tanggal) > new Date(summary[guruId].last_date)) {
            summary[guruId].last_date = record.tanggal;
        }
    });
    return summary;
}

function renderGuruTable(list) {
    const tbody = document.getElementById('guru-table-body');
    const badge = document.getElementById('guru-count');
    const empty = document.getElementById('guru-empty-state');
    const tableContainer = document.getElementById('guru-table-container');
    if (!tbody) return;

    const sorted = [...list].sort((a, b) => {
        const aMeta = integritasCount[a.id] || { count: 0, last_date: null };
        const bMeta = integritasCount[b.id] || { count: 0, last_date: null };
        const aHas = aMeta.count > 0;
        const bHas = bMeta.count > 0;

        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
            return new Date(bMeta.last_date) - new Date(aMeta.last_date);
        }
        return (a.name || a.username || '').localeCompare(b.name || b.username || '');
    });

    if (badge) {
        badge.textContent = `${sorted.length} guru`;
    }

    if (sorted.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (tableContainer) tableContainer.style.display = '';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = sorted.map(guru => {
        const meta = integritasCount[guru.id] || { count: 0, last_date: null };
        return `
            <tr>
                <td><strong>${escapeHtml(guru.name || guru.username || '-')}</strong></td>
                <td><span class="status-badge badge-blue">${escapeHtml(guru.role || 'guru')}</span></td>
                <td><span class="status-badge badge-green">${meta.count}</span></td>
                <td>${meta.last_date ? escapeHtml(formatDate(meta.last_date)) : '—'}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline" data-detail-guru="${guru.id}">
                        Detail
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-detail-guru]').forEach(btn => {
        const guruId = parseInt(btn.getAttribute('data-detail-guru'), 10);
        const guru = allGuru.find(item => item.id === guruId);
        btn.onclick = () => openDetailModal(guruId, guru?.name || guru?.username || '-');
    });
}

async function loadPoinIntegritas() {
    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/');
        const result = await response.json();
        poinList = result.data || [];
    } catch (err) {
        console.error('[EvaluasiGuru] Gagal memuat poin integritas:', err);
        poinList = [];
    }
}

async function openDetailModal(guruId, guruName) {
    currentGuruId = guruId;
    currentGuruName = guruName;

    const title = document.getElementById('guru-detail-title');
    const body = document.getElementById('guru-detail-body');
    const scoreBtn = document.getElementById('btn-detail-score-guru');

    if (title) {
        title.textContent = `Penilaian Integritas — ${guruName}`;
    }
    if (body) {
        body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';
    }
    if (scoreBtn) {
        scoreBtn.style.display = ['pimpinan', 'superadmin'].includes(userRole) ? '' : 'none';
    }

    document.getElementById('guru-detail-modal')?.classList.add('show');
    await renderDetailModal();
}

async function renderDetailModal() {
    const body = document.getElementById('guru-detail-body');
    if (!body || !currentGuruId) return;

    try {
        const records = await loadHistoryIntegritasGuru(currentGuruId);
        const latestPerPoin = getLatestPerPoin(records, poinList);

        body.innerHTML = `
            ${renderSummaryCards(latestPerPoin)}
            ${renderRiwayatTable(records)}
        `;

        body.querySelectorAll('[data-delete-guru-integritas]').forEach(btn => {
            btn.onclick = () => hapusIntegritasGuru(parseInt(btn.getAttribute('data-delete-guru-integritas'), 10));
        });
    } catch (err) {
        body.innerHTML = `<p class="text-muted">${escapeHtml(err.message || 'Gagal memuat detail guru.')}</p>`;
    }
}

async function loadHistoryIntegritasGuru(guruId) {
    const response = await window.apiFetch(`/evaluations/integritas-guru/?guru_id=${guruId}`);
    const result = await response.json();
    if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Gagal memuat riwayat penilaian');
    }
    return result.data || [];
}

function getLatestPerPoin(riwayat, points) {
    const result = {};
    points.forEach(poin => {
        const records = riwayat
            .filter(r => r.poin === poin.id || r.poin_nama === poin.nama)
            .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        result[poin.id] = records.length > 0 ? records[0] : null;
    });
    return result;
}

function renderSummaryCards(latestPerPoin) {
    if (poinList.length === 0) {
        return '<p class="text-muted">Poin integritas belum tersedia.</p>';
    }

    return `
        <p style="font-size:12px; color:var(--color-text-secondary); margin: 0 0 10px;">
            Menampilkan nilai terbaru per poin dari seluruh penilai
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
            ${poinList.map(poin => {
                const record = latestPerPoin[poin.id];
                const skala = record?.skala || 0;
                const width = Math.max(0, Math.min(100, (skala / 5) * 100));
                return `
                    <div style="background:var(--color-background-secondary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-md); padding:12px;">
                        <p style="font-size:11px; color:var(--color-text-secondary); margin:0 0 6px;">${escapeHtml(poin.nama)}</p>
                        <p style="font-size:22px; font-weight:500; margin:0; color:${record ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};">
                            ${record ? `${escapeHtml(String(skala))}<span style="font-size:12px; color:var(--color-text-secondary);">/5</span>` : '—'}
                        </p>
                        <div style="height:4px; background:var(--color-border-tertiary); border-radius:2px; margin-top:8px;">
                            <div style="height:4px; background:#1d9e75; border-radius:2px; width:${width}%;"></div>
                        </div>
                        <p style="font-size:10px; color:var(--color-text-secondary); margin:6px 0 0;">
                            ${record ? `${escapeHtml(record.penilai_name || '—')} · ${escapeHtml(formatDate(record.tanggal))}` : 'belum dinilai'}
                        </p>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderRiwayatTable(records) {
    const canDelete = ['superadmin', 'admin', 'pimpinan'].includes(userRole);

    if (records.length === 0) {
        return `
            <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--color-border-tertiary);">
                <div style="font-size:13px; font-weight:500; margin-bottom:10px;">Riwayat semua penilaian</div>
                <p class="text-muted">Belum ada penilaian integritas untuk guru ini.</p>
            </div>
        `;
    }

    return `
        <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--color-border-tertiary);">
            <div style="font-size:13px; font-weight:500; margin-bottom:10px;">Riwayat semua penilaian</div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Poin</th>
                            <th>Skala</th>
                            <th>Catatan</th>
                            <th>Dinilai Oleh</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${escapeHtml(formatDate(r.tanggal))}</td>
                                <td>${escapeHtml(r.poin_nama || '-')}</td>
                                <td>
                                    <span style="${getScoreBadgeStyle(Number(r.skala))} padding:2px 10px; border-radius:var(--border-radius-md); font-size:12px; display:inline-block;">
                                        ${escapeHtml(String(r.skala || '-'))}
                                    </span>
                                </td>
                                <td>${escapeHtml(r.catatan || '—')}</td>
                                <td>${escapeHtml(r.penilai_name || '—')}</td>
                                <td>
                                    ${canDelete
                                        ? `<button type="button" class="btn btn-sm btn-outline" data-delete-guru-integritas="${r.id}">Hapus</button>`
                                        : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function openFormPenilaian() {
    if (!currentGuruId || !['pimpinan', 'superadmin'].includes(userRole)) return;

    const title = document.getElementById('guru-form-title');
    const body = document.getElementById('guru-form-body');
    const modalContent = document.getElementById('guru-form-content');
    if (title) {
        title.textContent = `Penilaian Integritas — ${currentGuruName || '-'}`;
    }
    if (modalContent) {
        modalContent.style.overflowY = 'auto';
        modalContent.style.maxHeight = '80vh';
    }
    if (body) {
        body.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Poin</th>
                            <th>Skala</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${poinList.map(poin => `
                            <tr>
                                <td><strong>${escapeHtml(poin.nama)}</strong></td>
                                <td>
                                    <select class="filter-input guru-integritas-skala" data-poin-id="${poin.id}">
                                        <option value="0">—</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                        <option value="5">5</option>
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="filter-group" style="margin-top:12px;">
                <label for="guru-integritas-catatan">Catatan</label>
                <textarea id="guru-integritas-catatan" class="filter-input textarea-input" rows="3" placeholder="Catatan tambahan (opsional)..."></textarea>
            </div>
        `;
    }

    document.getElementById('guru-form-modal')?.classList.add('show');
}

function closeFormModal() {
    document.getElementById('guru-form-modal')?.classList.remove('show');
}

async function submitIntegritasGuru() {
    if (!currentGuruId) return;

    const catatan = document.getElementById('guru-integritas-catatan')?.value || '';
    const selects = document.querySelectorAll('#guru-form-modal .guru-integritas-skala');
    const payload = [];

    selects.forEach(sel => {
        const skala = sel.value;
        const poinId = parseInt(sel.getAttribute('data-poin-id'), 10);
        if (skala && skala !== '0') {
            payload.push({ poin_id: poinId, skala: parseInt(skala, 10) });
        }
    });

    if (payload.length === 0) {
        showMessage('Pilih minimal 1 poin untuk dinilai.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-save-guru-form');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }

    try {
        for (const item of payload) {
            const response = await window.apiFetch('/evaluations/integritas-guru/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guru_id: currentGuruId,
                    poin_id: item.poin_id,
                    skala: item.skala,
                    catatan
                })
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || 'Gagal menyimpan penilaian');
            }
        }

        closeFormModal();
        await refreshGuruSummary();
        await renderDetailModal();
        renderGuruTable(filterGuruBySearch());
        showMessage('Penilaian berhasil disimpan.', 'success');
    } catch (err) {
        showMessage(err.message || 'Gagal menyimpan penilaian.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan';
        }
    }
}

async function hapusIntegritasGuru(id) {
    if (!confirm('Hapus penilaian ini?')) return;

    try {
        const response = await window.apiFetch(`/evaluations/integritas-guru/${id}/`, {
            method: 'DELETE'
        });

        if (!response.ok && response.status !== 204) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.message || result.error || 'Gagal menghapus penilaian');
        }

        await refreshGuruSummary();
        await renderDetailModal();
        renderGuruTable(filterGuruBySearch());
        showMessage('Penilaian dihapus.', 'success');
    } catch (err) {
        showMessage(err.message || 'Gagal menghapus penilaian.', 'error');
    }
}

function openKonfigModal() {
    loadKonfigPoin();
    document.getElementById('konfig-poin-modal')?.classList.add('show');
}

function closeKonfigModal() {
    document.getElementById('konfig-poin-modal')?.classList.remove('show');
}

async function loadKonfigPoin() {
    const tbody = document.getElementById('poin-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';
    }

    await loadPoinIntegritas();

    if (!tbody) return;
    if (poinList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada poin aktif.</td></tr>';
        return;
    }

    tbody.innerHTML = poinList.map(poin => `
        <tr data-poin-row="${poin.id}">
            <td>
                <div data-poin-label="${poin.id}" style="cursor:pointer; font-weight:600;">${escapeHtml(poin.nama)}</div>
                <input type="text" class="filter-input" data-poin-input="${poin.id}" value="${escapeAttr(poin.nama)}" style="display:none; margin-top:6px;">
            </td>
            <td>
                <input type="number" class="filter-input" data-poin-urutan="${poin.id}" value="${escapeAttr(String(poin.urutan || 0))}" min="0" style="max-width:120px;">
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-outline" data-poin-edit="${poin.id}">Edit</button>
                <button type="button" class="btn btn-sm btn-primary" data-poin-save="${poin.id}" style="display:none;">Simpan</button>
                <button type="button" class="btn btn-sm btn-outline" data-poin-delete="${poin.id}" style="color:var(--danger,#ef4444);">Hapus</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-poin-label]').forEach(el => {
        el.onclick = () => startEditPoin(parseInt(el.getAttribute('data-poin-label'), 10));
    });
    tbody.querySelectorAll('[data-poin-edit]').forEach(el => {
        el.onclick = () => startEditPoin(parseInt(el.getAttribute('data-poin-edit'), 10));
    });
    tbody.querySelectorAll('[data-poin-save]').forEach(el => {
        el.onclick = () => editPoin(parseInt(el.getAttribute('data-poin-save'), 10));
    });
    tbody.querySelectorAll('[data-poin-delete]').forEach(el => {
        el.onclick = () => hapusPoin(parseInt(el.getAttribute('data-poin-delete'), 10));
    });
}

function startEditPoin(id) {
    const label = document.querySelector(`[data-poin-label="${id}"]`);
    const input = document.querySelector(`[data-poin-input="${id}"]`);
    const editBtn = document.querySelector(`[data-poin-edit="${id}"]`);
    const saveBtn = document.querySelector(`[data-poin-save="${id}"]`);

    if (label) label.style.display = 'none';
    if (input) {
        input.style.display = '';
        input.focus();
    }
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = '';
}

async function tambahPoin() {
    const namaInput = document.getElementById('poin-baru-nama');
    const urutanInput = document.getElementById('poin-baru-urutan');
    const nama = namaInput?.value.trim() || '';
    const urutan = parseInt(urutanInput?.value || '0', 10);

    if (!nama) {
        showMessage('Nama poin wajib diisi.', 'warning');
        return;
    }

    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, urutan })
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Gagal menambah poin');
        }

        if (namaInput) namaInput.value = '';
        if (urutanInput) urutanInput.value = '0';
        await loadKonfigPoin();
        showMessage('Poin berhasil ditambahkan.', 'success');
    } catch (err) {
        showMessage(err.message || 'Gagal menambah poin.', 'error');
    }
}

async function editPoin(id) {
    const input = document.querySelector(`[data-poin-input="${id}"]`);
    const urutanInput = document.querySelector(`[data-poin-urutan="${id}"]`);
    const nama = input?.value.trim() || '';
    const urutan = parseInt(urutanInput?.value || '0', 10);

    if (!nama) {
        showMessage('Nama poin wajib diisi.', 'warning');
        return;
    }

    try {
        const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, urutan })
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Gagal memperbarui poin');
        }

        await loadKonfigPoin();
        showMessage('Poin berhasil diperbarui.', 'success');
    } catch (err) {
        showMessage(err.message || 'Gagal memperbarui poin.', 'error');
    }
}

async function hapusPoin(id) {
    if (!confirm('Hapus poin ini?')) return;

    try {
        const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok || result.success === false) {
            throw new Error(result.message || 'Gagal menghapus poin');
        }

        await loadKonfigPoin();
        showMessage('Poin dihapus.', 'success');
    } catch (err) {
        showMessage(err.message || 'Gagal menghapus poin.', 'error');
    }
}

async function refreshGuruSummary() {
    const response = await window.apiFetch('/evaluations/integritas-guru/');
    const result = await response.json();
    allIntegritasGuru = result.data || [];
    integritasCount = buildIntegritasSummary(allIntegritasGuru);
}

function filterGuruBySearch() {
    const q = (document.getElementById('search-guru')?.value || '').toLowerCase();
    if (!q) return allGuru;
    return allGuru.filter(g => (g.name || g.username || '').toLowerCase().includes(q));
}

function closeDetailModal() {
    document.getElementById('guru-detail-modal')?.classList.remove('show');
    currentGuruId = null;
    currentGuruName = null;
}

function getScoreBadgeStyle(skala) {
    if (skala === 5) {
        return 'background:var(--color-background-success); color:var(--color-text-success);';
    }
    if (skala === 4) {
        return 'background:var(--color-background-info); color:var(--color-text-info);';
    }
    if (skala === 3) {
        return 'background:var(--color-background-warning); color:var(--color-text-warning);';
    }
    return 'background:var(--color-background-danger); color:var(--color-text-danger);';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

function showMessage(message, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    alert(message);
}

function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.openFormPenilaian = openFormPenilaian;
window.closeFormModal = closeFormModal;
window.submitIntegritasGuru = submitIntegritasGuru;
window.hapusIntegritasGuru = hapusIntegritasGuru;
window.openKonfigModal = openKonfigModal;
window.closeKonfigModal = closeKonfigModal;
window.loadKonfigPoin = loadKonfigPoin;
window.tambahPoin = tambahPoin;
window.editPoin = editPoin;
window.hapusPoin = hapusPoin;
