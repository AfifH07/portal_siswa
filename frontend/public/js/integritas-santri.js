let integritasSantriState = {
    currentUser: null,
    poin: [],
    allSantri: [],
    records: [],
    summary: {},
    filteredSantri: [],
    currentSantriNisn: null,
    initialized: false,
    modalReady: false,
};

document.addEventListener('DOMContentLoaded', () => {
    const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (cachedUser && cachedUser.role) {
        initIntegritasSantri(cachedUser);
    }
});

window.addEventListener('evaluations:user-ready', (event) => {
    if (event?.detail) {
        initIntegritasSantri(event.detail);
    }
});

function initIntegritasSantri(user) {
    if (!user || !user.role) return;
    if (integritasSantriState.initialized && integritasSantriState.currentUser?.id === user.id) return;

    integritasSantriState.initialized = true;
    integritasSantriState.currentUser = user;

    setupTabButtons();
    setupMainControls();
    setupModalControls();

    const tabButton = document.querySelector('[data-tab="integritas"]');
    if (user.role === 'walisantri') {
        if (tabButton) tabButton.style.display = 'none';
        return;
    }

    if (tabButton) tabButton.style.display = '';

    initTab();
}

function setupTabButtons() {
    document.querySelectorAll('.module-tabs .tab-btn').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        btn.onclick = () => switchTab(tab);
    });
}

function setupMainControls() {
    const search = document.getElementById('search-integritas');
    if (search) {
        search.oninput = function () {
            handleSearch(this.value);
        };
    }

    const configBtn = document.getElementById('btn-integritas-config');
    const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    if (configBtn) {
        configBtn.onclick = () => {
            window.location.href = '/evaluasi-guru';
        };
        configBtn.style.display = ['superadmin', 'admin', 'pimpinan'].includes(user.role) ? '' : 'none';
    }
}

function setupModalControls() {
    if (integritasSantriState.modalReady) return;

    const closeDetail = document.getElementById('btn-close-integritas-detail');
    const scoreBtn = document.getElementById('btn-detail-score-integritas');
    const closeScore = document.getElementById('btn-close-integritas-modal');
    const cancelScore = document.getElementById('btn-cancel-integritas-modal');
    const saveScore = document.getElementById('btn-save-integritas-modal');

    if (closeDetail) closeDetail.onclick = closeDetailModal;
    if (scoreBtn) scoreBtn.onclick = openIntegritasModal;
    if (closeScore) closeScore.onclick = closeIntegritasModal;
    if (cancelScore) cancelScore.onclick = closeIntegritasModal;
    if (saveScore) saveScore.onclick = submitIntegritasSantri;

    integritasSantriState.modalReady = true;
}

async function initTab() {
    await loadPoinIntegritas();
    await loadSantriList();
    await loadIntegritasSummary();
    handleSearch(document.getElementById('search-integritas')?.value || '');
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    tabs.forEach(tab => {
        const isActive = tab.id === `tab-${tabName}`;
        tab.style.display = isActive ? '' : 'none';
        tab.classList.toggle('active', isActive);
    });

    if (tabName === 'integritas') {
        handleSearch(document.getElementById('search-integritas')?.value || '');
    }
}

async function loadPoinIntegritas() {
    try {
        const response = await window.apiFetch('/evaluations/poin-integritas/');
        const result = await response.json();
        integritasSantriState.poin = result.data || [];
    } catch (err) {
        console.error('[Integritas] Gagal load poin:', err);
        integritasSantriState.poin = [];
    }
}

async function loadSantriList() {
    try {
        const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
        let santri = [];

        if (['superadmin', 'admin', 'pimpinan'].includes(user.role)) {
            const response = await window.apiFetch('/students/?page_size=1000');
            const result = await response.json();
            santri = result.results || result.data || [];
        } else if (['guru', 'musyrif'].includes(user.role)) {
            const response = await window.apiFetch(`users/${user.id}/assignments/`);
            const assignments = await response.json();
            const classes = [...new Set(
                (assignments || [])
                    .filter(a => a.status === 'active' && a.kelas)
                    .map(a => a.kelas)
            )];

            const list = [];
            for (const kelas of classes) {
                const studentsRes = await window.apiFetch(`/students/?kelas=${encodeURIComponent(kelas)}&page_size=1000`);
                const studentsData = await studentsRes.json();
                const students = studentsData.results || studentsData.data || [];
                students.forEach(s => list.push(s));
            }
            santri = list;
        }

        integritasSantriState.allSantri = santri
            .filter(s => s && s.nisn)
            .sort((a, b) => (a.nama || a.name || '').localeCompare(b.nama || b.name || ''));
    } catch (err) {
        console.error('[Integritas] Gagal load santri:', err);
        integritasSantriState.allSantri = [];
    }
}

async function loadIntegritasSummary() {
    try {
        const response = await window.apiFetch('/evaluations/integritas-santri/');
        const result = await response.json();
        const records = result.data || [];
        integritasSantriState.records = records;
        integritasSantriState.summary = buildSummary(records);
    } catch (err) {
        console.error('[Integritas] Gagal load ringkasan:', err);
        integritasSantriState.records = [];
        integritasSantriState.summary = {};
    }
}

function buildSummary(records) {
    const summary = {};
    records.forEach(record => {
        const nisn = record.santri_nisn || record.santri;
        if (!nisn) return;
        if (!summary[nisn]) {
            summary[nisn] = { count: 0, last_date: null };
        }
        summary[nisn].count += 1;
        if (!summary[nisn].last_date || new Date(record.tanggal) > new Date(summary[nisn].last_date)) {
            summary[nisn].last_date = record.tanggal;
        }
    });
    return summary;
}

function handleSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const filtered = !q
        ? [...integritasSantriState.allSantri]
        : integritasSantriState.allSantri.filter(s => {
            const nama = (s.nama || s.name || '').toLowerCase();
            const nisn = String(s.nisn || '').toLowerCase();
            return nama.includes(q) || nisn.includes(q);
        });

    integritasSantriState.filteredSantri = filtered;
    renderSantriTable(filtered);
}

function renderSantriTable(list) {
    const tbody = document.getElementById('integritas-santri-body');
    const badge = document.getElementById('integritas-count');
    const empty = document.getElementById('integritas-empty-state');
    if (!tbody) return;

    const sorted = [...list].sort((a, b) => {
        const aMeta = integritasSantriState.summary[a.nisn] || { count: 0, last_date: null };
        const bMeta = integritasSantriState.summary[b.nisn] || { count: 0, last_date: null };
        const aHas = aMeta.count > 0;
        const bHas = bMeta.count > 0;

        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
            return new Date(bMeta.last_date) - new Date(aMeta.last_date);
        }
        return (a.nama || a.name || '').localeCompare(b.nama || b.name || '');
    });

    if (badge) badge.textContent = String(sorted.length);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada santri yang cocok.</td></tr>';
        if (empty) {
            empty.textContent = 'Tidak ada santri yang cocok dengan pencarian.';
            empty.style.display = '';
        }
        return;
    }

    if (empty) {
        empty.textContent = 'Klik "Detail" untuk melihat riwayat penilaian integritas per santri.';
        empty.style.display = '';
    }
    tbody.innerHTML = sorted.map(s => {
        const meta = integritasSantriState.summary[s.nisn] || { count: 0, last_date: null };
        return `
            <tr>
                <td><strong>${escapeHtml(s.nama || s.name || '-')}</strong></td>
                <td><code>${escapeHtml(s.nisn)}</code></td>
                <td>${escapeHtml(s.kelas || '-')}</td>
                <td><span class="status-badge badge-blue">${meta.count}</span></td>
                <td>${meta.last_date ? escapeHtml(formatDate(meta.last_date)) : '—'}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline" data-action="lihat-detail" data-nisn="${escapeHtml(s.nisn)}">
                        Detail
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-action="lihat-detail"]').forEach(btn => {
        btn.onclick = () => openDetailModal(btn.getAttribute('data-nisn'));
    });
}

function getStudentByNisn(nisn) {
    return integritasSantriState.allSantri.find(s => String(s.nisn) === String(nisn));
}

function getRecordsByNisn(nisn) {
    return integritasSantriState.records.filter(r => String(r.santri_nisn || r.santri) === String(nisn));
}

async function openDetailModal(nisn) {
    const student = getStudentByNisn(nisn);
    if (!student) return;

    integritasSantriState.currentSantriNisn = nisn;

    const title = document.getElementById('integritas-detail-title');
    const body = document.getElementById('integritas-detail-body');
    const scoreBtn = document.getElementById('btn-detail-score-integritas');

    if (title) title.textContent = `Penilaian Integritas — ${student.nama || student.name || '-'} (${student.nisn})`;
    if (scoreBtn) scoreBtn.style.display = canScore() ? '' : 'none';
    if (body) body.innerHTML = '<div class="loading-spinner" style="margin:20px auto;"></div>';

    document.getElementById('integritas-detail-modal')?.classList.add('show');
    await renderDetailContent();
}

async function fetchHistoryByNisn(nisn) {
    const response = await window.apiFetch(`/evaluations/integritas-santri/?santri_nisn=${encodeURIComponent(nisn)}`);
    const result = await response.json();
    if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Gagal memuat riwayat penilaian');
    }
    return result.data || [];
}

function getLatestPerPoin(riwayat, poinList) {
    const result = {};
    poinList.forEach(poin => {
        const records = riwayat
            .filter(r => r.poin === poin.id || r.poin_nama === poin.nama)
            .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        result[poin.id] = records.length > 0 ? records[0] : null;
    });
    return result;
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

function renderLatestCards(latestPerPoin) {
    if (integritasSantriState.poin.length === 0) {
        return '<p class="text-muted">Poin integritas belum tersedia.</p>';
    }

    return `
        <p style="font-size:12px; color:var(--color-text-secondary); margin: 0 0 10px;">
            Menampilkan nilai terbaru per poin dari seluruh penilai
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
            ${integritasSantriState.poin.map(poin => {
                const record = latestPerPoin[poin.id];
                const skala = record?.skala || 0;
                const width = Math.max(0, Math.min(100, (skala / 5) * 100));
                return `
                    <div style="background:var(--color-background-secondary); border:0.5px solid var(--color-border-tertiary); border-radius:var(--border-radius-md); padding:12px;">
                        <p style="font-size:11px; color:var(--color-text-secondary); margin:0 0 6px;">${escapeHtml(poin.nama)}</p>
                        <p style="font-size:22px; font-weight:500; margin:0; color:${record ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'};">
                            ${record ? escapeHtml(String(skala)) + '<span style="font-size:12px; color:var(--color-text-secondary);">/5</span>' : '—'}
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

function renderHistoryTable(records) {
    if (records.length === 0) {
        return '<p class="text-muted">Belum ada penilaian integritas untuk santri ini.</p>';
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
                        ${records.map(item => `
                            <tr>
                                <td>${escapeHtml(formatDate(item.tanggal))}</td>
                                <td>${escapeHtml(item.poin_nama || '-')}</td>
                                <td>
                                    <span style="${getScoreBadgeStyle(Number(item.skala))} padding:2px 10px; border-radius:var(--border-radius-md); font-size:12px; display:inline-block;">
                                        ${escapeHtml(String(item.skala || '-'))}
                                    </span>
                                </td>
                                <td>${escapeHtml(item.catatan || '—')}</td>
                                <td>${escapeHtml(item.penilai_name || '—')}</td>
                                <td>
                                    <button type="button" class="btn btn-sm btn-outline" data-delete-integritas="${item.id}">Hapus</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderDetailContent() {
    const body = document.getElementById('integritas-detail-body');
    const nisn = integritasSantriState.currentSantriNisn;
    if (!body || !nisn) return;

    try {
        const records = await fetchHistoryByNisn(nisn);
        const latestPerPoin = getLatestPerPoin(records, integritasSantriState.poin);

        body.innerHTML = `
            ${renderLatestCards(latestPerPoin)}
            ${renderHistoryTable(records)}
        `;

        body.querySelectorAll('[data-delete-integritas]').forEach(btn => {
            btn.onclick = () => hapusIntegritasSantri(parseInt(btn.getAttribute('data-delete-integritas'), 10));
        });
    } catch (err) {
        body.innerHTML = `<p class="text-muted">${escapeHtml(err.message || 'Gagal memuat detail penilaian.')}</p>`;
    }
}

function closeDetailModal() {
    document.getElementById('integritas-detail-modal')?.classList.remove('show');
    integritasSantriState.currentSantriNisn = null;
}

async function openIntegritasModal() {
    const nisn = integritasSantriState.currentSantriNisn;
    if (!nisn) {
        showMessage('Pilih santri terlebih dahulu.', 'warning');
        return;
    }

    const student = getStudentByNisn(nisn);
    const title = document.getElementById('integritas-modal-title');
    const body = document.getElementById('integritas-modal-body');
    if (title) title.textContent = `Penilaian Integritas — ${student?.nama || student?.name || nisn}`;

    if (body) {
        if (integritasSantriState.poin.length === 0) {
            body.innerHTML = '<p class="text-muted">Poin integritas belum tersedia.</p>';
        } else {
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
                            ${integritasSantriState.poin.map(poin => `
                                <tr>
                                    <td><strong>${escapeHtml(poin.nama)}</strong></td>
                                    <td>
                                        <select class="glass-input integritas-skala" data-poin-id="${poin.id}">
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
                <div class="form-group" style="margin-top:12px;">
                    <label>Catatan</label>
                    <textarea id="integritas-catatan" class="glass-input" rows="3" placeholder="Catatan tambahan (opsional)..."></textarea>
                </div>
            `;
        }
    }

    document.getElementById('integritas-modal')?.classList.add('show');
}

function closeIntegritasModal() {
    document.getElementById('integritas-modal')?.classList.remove('show');
}

async function submitIntegritasSantri() {
    const nisn = integritasSantriState.currentSantriNisn;
    const catatanValue = document.getElementById('integritas-catatan')?.value || '';
    const selects = document.querySelectorAll('#integritas-modal .integritas-skala');
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

    const btn = document.getElementById('btn-save-integritas-modal');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
    }

    try {
        for (const item of payload) {
            const response = await window.apiFetch('/evaluations/integritas-santri/', {
                method: 'POST',
                body: JSON.stringify({
                    santri_nisn: nisn,
                    poin_id: item.poin_id,
                    skala: item.skala,
                    catatan: catatanValue
                })
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'Gagal menyimpan penilaian');
            }
        }

        closeIntegritasModal();
        await refreshIntegritasData();
        document.getElementById('integritas-detail-modal')?.classList.add('show');
        renderDetailContent();
        showMessage('Penilaian berhasil disimpan.', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Simpan';
        }
    }
}

async function hapusIntegritasSantri(id) {
    if (!confirm('Hapus penilaian ini?')) return;

    try {
        const response = await window.apiFetch(`/evaluations/integritas-santri/${id}/`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Gagal menghapus');

        await refreshIntegritasData();
        if (integritasSantriState.currentSantriNisn) {
            document.getElementById('integritas-detail-modal')?.classList.add('show');
            renderDetailContent();
        }
        showMessage('Penilaian dihapus.', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

async function refreshIntegritasData() {
    await loadIntegritasSummary();
    handleSearch(document.getElementById('search-integritas')?.value || '');
}

function canScore() {
    const user = integritasSantriState.currentUser || JSON.parse(localStorage.getItem('user') || '{}');
    return ['superadmin', 'admin', 'pimpinan', 'guru', 'musyrif'].includes(user.role);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function showMessage(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    alert(message);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

window.switchTab = switchTab;
window.loadPoinIntegritas = loadPoinIntegritas;
window.openIntegritasModal = openIntegritasModal;
window.closeIntegritasModal = closeIntegritasModal;
window.hapusIntegritasSantri = hapusIntegritasSantri;
window.closeDetailModal = closeDetailModal;
