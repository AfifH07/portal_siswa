let evaluasiGuruState = {
    currentUser: null,
    poin: [],
    guruList: [],
    selectedGuru: null,
    initialized: false,
};

document.addEventListener('DOMContentLoaded', () => {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (cachedUser && cachedUser.role) {
        initEvaluasiGuru(cachedUser);
    }
});

function initEvaluasiGuru(user) {
    if (!user || !user.role) return;
    if (evaluasiGuruState.initialized && evaluasiGuruState.currentUser?.id === user.id) return;

    evaluasiGuruState.initialized = true;
    evaluasiGuruState.currentUser = user;

    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        topbarDate.textContent = '📅 ' + new Date().toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    const role = user.role;
    const configSection = document.getElementById('poin-config-section');
    const formAllowed = ['superadmin', 'pimpinan'].includes(role);

    if (configSection) configSection.style.display = ['superadmin', 'admin', 'pimpinan'].includes(role) ? '' : 'none';

    setupEvents();
    loadPoinIntegritas().then(() => {
        if (formAllowed) renderPoinConfig();
    });
    loadGuruList();
}

function setupEvents() {
    const btnTambah = document.getElementById('btn-tambah-poin');
    if (btnTambah) btnTambah.onclick = tambahPoin;
}

async function loadGuruList() {
    try {
        const response = await window.apiFetch('/admin/users/?role=guru');
        const result = await response.json();
        evaluasiGuruState.guruList = result.data || result.results || [];
        renderGuruList();
    } catch (err) {
        console.error('[EvaluasiGuru] Gagal load guru:', err);
    }
}

function renderGuruList() {
    const tbody = document.getElementById('guru-table-body');
    const count = document.getElementById('guru-count');
    if (!tbody) return;

    if (count) count.textContent = `${evaluasiGuruState.guruList.length} data`;

    if (evaluasiGuruState.guruList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Belum ada guru.</td></tr>';
        return;
    }

    tbody.innerHTML = evaluasiGuruState.guruList.map(guru => `
        <tr>
            <td>${escapeHtml(guru.name || guru.username || '-')}</td>
            <td>${escapeHtml(guru.username || '-')}</td>
            <td>${escapeHtml(guru.kelas || '-')}</td>
            <td><span class="status-badge badge-blue">${guru.active_assignments_count || 0}</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-outline" data-action="lihat-guru" data-id="${guru.id}">Lihat Integritas</button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="lihat-guru"]').forEach(btn => {
        const guruId = parseInt(btn.getAttribute('data-id'), 10);
        const guru = evaluasiGuruState.guruList.find(item => item.id === guruId);
        btn.onclick = () => showDetailGuru(guruId, guru?.name || guru?.username || '-');
    });
}

async function loadPoinIntegritas() {
    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/');
        const result = await response.json();
        evaluasiGuruState.poin = result.data || [];
        const count = document.getElementById('poin-count');
        if (count) count.textContent = `${evaluasiGuruState.poin.length}`;
        renderPoinConfig();
        if (evaluasiGuruState.selectedGuru) {
            renderGuruForm();
        }
    } catch (err) {
        console.error('[EvaluasiGuru] Gagal load poin:', err);
    }
}

function showDetailGuru(guruId, guruName) {
    evaluasiGuruState.selectedGuru = { id: guruId, name: guruName };
    const section = document.getElementById('guru-detail-section');
    const title = document.getElementById('guru-detail-title');
    if (section) section.style.display = '';
    if (title) title.textContent = `Detail Integritas - ${guruName}`;
    renderGuruForm();
    loadHistoryIntegritasGuru(guruId);
}

function renderGuruForm() {
    const container = document.getElementById('guru-integritas-form-container');
    if (!container) return;

    const role = evaluasiGuruState.currentUser?.role || '';
    const canWrite = ['superadmin', 'pimpinan'].includes(role);

    if (!canWrite) {
        container.innerHTML = '<p class="text-muted">Anda hanya dapat melihat riwayat penilaian.</p>';
        return;
    }

    container.innerHTML = `
        <div class="glass-card" style="padding:16px; margin-bottom:16px;">
            <div class="card-head" style="margin-bottom:12px;">
                <h3><span class="ch-icon">📝</span> Form Penilaian Baru</h3>
                <div class="card-badge">${evaluasiGuruState.poin.length} poin</div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Poin</th>
                            <th>Skala</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${evaluasiGuruState.poin.map(p => `
                            <tr class="guru-integritas-row" data-poin-id="${p.id}">
                                <td><strong>${escapeHtml(p.nama)}</strong></td>
                                <td>
                                    <select class="glass-input guru-integritas-skala" style="min-width:120px;">
                                        <option value="0">-- Pilih --</option>
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
            <div class="form-group" style="margin-top:12px;">
                <label>Catatan</label>
                <textarea id="guru-integritas-catatan" class="glass-input" rows="3" placeholder="Catatan tambahan..."></textarea>
            </div>
            <div class="form-actions" style="margin-top:16px;">
                <button type="button" id="btn-submit-guru-integritas" class="btn btn-primary">Simpan Penilaian</button>
            </div>
        </div>
    `;

    const btn = document.getElementById('btn-submit-guru-integritas');
    if (btn) btn.onclick = submitIntegritasGuru;
}

async function loadHistoryIntegritasGuru(guruId) {
    const body = document.getElementById('guru-integritas-history-body');
    const count = document.getElementById('guru-integritas-count');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="6" class="text-center"><div class="loading-spinner" style="margin:20px auto;"></div></td></tr>';

    try {
        const response = await window.apiFetch(`/evaluations/integritas-guru/?guru_id=${guruId}`);
        const result = await response.json();
        const history = result.data || [];

        if (count) count.textContent = history.length;

        if (history.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada penilaian.</td></tr>';
            return;
        }

        body.innerHTML = history.map(item => `
            <tr data-id="${item.id}">
                <td>${escapeHtml(formatDate(item.tanggal))}</td>
                <td>${escapeHtml(item.poin_nama || '-')}</td>
                <td><span class="status-badge badge-blue">${escapeHtml(String(item.skala))}</span></td>
                <td>${escapeHtml(item.catatan || '-')}</td>
                <td>${escapeHtml(item.penilai_name || '-')}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline" data-action="hapus-guru-integritas" data-id="${item.id}">Hapus</button>
                </td>
            </tr>
        `).join('');

        body.querySelectorAll('[data-action="hapus-guru-integritas"]').forEach(btn => {
            btn.onclick = () => hapusIntegritasGuru(parseInt(btn.getAttribute('data-id'), 10));
        });
    } catch (err) {
        body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Gagal memuat: ${escapeHtml(err.message)}</td></tr>`;
    }
}

async function submitIntegritasGuru() {
    const role = evaluasiGuruState.currentUser?.role || '';
    if (!['superadmin', 'pimpinan'].includes(role)) return;
    if (!evaluasiGuruState.selectedGuru) return;

    const catatan = document.getElementById('guru-integritas-catatan')?.value || '';
    const rows = document.querySelectorAll('.guru-integritas-row');
    const payloads = [];
    rows.forEach(row => {
        const poinId = row.getAttribute('data-poin-id');
        const skala = row.querySelector('.guru-integritas-skala')?.value || '0';
        if (parseInt(skala, 10) > 0) payloads.push({ poin_id: parseInt(poinId, 10), skala: parseInt(skala, 10) });
    });

    if (payloads.length === 0) {
        showMessage('Pilih minimal satu skala.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-submit-guru-integritas');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
        for (const payload of payloads) {
            const response = await window.apiFetch('/evaluations/integritas-guru/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guru_id: evaluasiGuruState.selectedGuru.id,
                    poin_id: payload.poin_id,
                    skala: payload.skala,
                    catatan
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || 'Gagal menyimpan');
        }

        showMessage('Penilaian berhasil disimpan.', 'success');
        await loadHistoryIntegritasGuru(evaluasiGuruState.selectedGuru.id);
    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan Penilaian'; }
    }
}

async function hapusIntegritasGuru(id) {
    if (!confirm('Hapus penilaian ini?')) return;
    try {
        const response = await window.apiFetch(`/evaluations/integritas-guru/${id}/`, { method: 'DELETE' });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menghapus');

        showMessage('Penilaian dihapus.', 'success');
        if (evaluasiGuruState.selectedGuru) {
            await loadHistoryIntegritasGuru(evaluasiGuruState.selectedGuru.id);
        }
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function loadKonfigurasiPoin() {
    renderPoinConfig();
}

function renderPoinConfig() {
    const role = evaluasiGuruState.currentUser?.role || '';
    const allowed = ['superadmin', 'admin', 'pimpinan'].includes(role);
    const section = document.getElementById('poin-config-section');
    if (section) section.style.display = allowed ? '' : 'none';
    if (!allowed) return;

    const body = document.getElementById('poin-table-body');
    if (!body) return;

    if (evaluasiGuruState.poin.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada poin.</td></tr>';
        return;
    }

    body.innerHTML = evaluasiGuruState.poin.map(p => `
        <tr data-id="${p.id}">
            <td><input type="text" class="glass-input" id="poin-name-${p.id}" value="${escapeHtml(p.nama)}"></td>
            <td><input type="number" class="glass-input" id="poin-order-${p.id}" value="${p.urutan}" min="0" style="max-width:120px;"></td>
            <td>
                <button type="button" class="btn btn-sm btn-outline" data-action="edit-poin" data-id="${p.id}">Simpan</button>
                <button type="button" class="btn btn-sm btn-outline" data-action="hapus-poin" data-id="${p.id}">Hapus</button>
            </td>
        </tr>
    `).join('');

    body.querySelectorAll('[data-action="edit-poin"]').forEach(btn => {
        btn.onclick = () => editPoin(parseInt(btn.getAttribute('data-id'), 10));
    });
    body.querySelectorAll('[data-action="hapus-poin"]').forEach(btn => {
        btn.onclick = () => hapusPoin(parseInt(btn.getAttribute('data-id'), 10));
    });
}

async function tambahPoin() {
    const nama = document.getElementById('poin-baru-nama')?.value.trim();
    const urutan = parseInt(document.getElementById('poin-baru-urutan')?.value || '0', 10);
    if (!nama) return showMessage('Nama poin wajib diisi.', 'warning');

    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, urutan })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menambah poin');

        document.getElementById('poin-baru-nama').value = '';
        document.getElementById('poin-baru-urutan').value = '0';
        showMessage('Poin berhasil ditambahkan.', 'success');
        await loadPoinIntegritas();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function editPoin(id) {
    const nama = document.getElementById(`poin-name-${id}`)?.value.trim();
    const urutan = parseInt(document.getElementById(`poin-order-${id}`)?.value || '0', 10);
    if (!nama) return showMessage('Nama poin wajib diisi.', 'warning');

    try {
        const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, urutan })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal memperbarui poin');
        showMessage('Poin berhasil diperbarui.', 'success');
        await loadPoinIntegritas();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function hapusPoin(id) {
    if (!confirm('Hapus poin ini?')) return;
    try {
        const response = await window.apiFetch(`/evaluations/poin-integritas/${id}/`, { method: 'DELETE' });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menghapus poin');
        showMessage('Poin dihapus.', 'success');
        await loadPoinIntegritas();
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

function showMessage(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    alert(message);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.showDetailGuru = showDetailGuru;
window.loadGuruList = loadGuruList;
window.loadPoinIntegritas = loadPoinIntegritas;
window.loadHistoryIntegritasGuru = loadHistoryIntegritasGuru;
window.submitIntegritasGuru = submitIntegritasGuru;
window.hapusIntegritasGuru = hapusIntegritasGuru;
window.loadKonfigurasiPoin = loadKonfigurasiPoin;
window.tambahPoin = tambahPoin;
window.editPoin = editPoin;
window.hapusPoin = hapusPoin;
